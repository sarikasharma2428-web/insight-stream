package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/gorilla/websocket"
	"github.com/logpulse/backend/internal/models"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// StreamHub manages WebSocket connections for live streaming
type StreamHub struct {
	clients    map[*websocket.Conn]StreamFilter
	register   chan *clientRegistration
	unregister chan *websocket.Conn
	broadcast  chan *models.LogEntry
	mu         sync.RWMutex
}

type clientRegistration struct {
	conn   *websocket.Conn
	filter StreamFilter
}

type StreamFilter struct {
	Labels map[string]string `json:"labels"`
}

// NewStreamHub creates a new streaming hub
func NewStreamHub() *StreamHub {
	return &StreamHub{
		clients:    make(map[*websocket.Conn]StreamFilter),
		register:   make(chan *clientRegistration),
		unregister: make(chan *websocket.Conn),
		broadcast:  make(chan *models.LogEntry, 1000),
	}
}

// Run starts the hub's main loop
func (h *StreamHub) Run() {
	for {
		select {
		case reg := <-h.register:
			h.mu.Lock()
			h.clients[reg.conn] = reg.filter
			h.mu.Unlock()
			log.Printf("Client connected. Total: %d", len(h.clients))

		case conn := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[conn]; ok {
				delete(h.clients, conn)
				conn.Close()
			}
			h.mu.Unlock()
			log.Printf("Client disconnected. Total: %d", len(h.clients))

		case entry := <-h.broadcast:
			h.mu.RLock()
			for conn, filter := range h.clients {
				// Check if log matches client's filter
				if matchesFilter(entry.Labels, filter.Labels) {
					msg, _ := json.Marshal(map[string]interface{}{
						"type": "log",
						"data": map[string]interface{}{
							"id":        entry.ID,
							"timestamp": entry.Timestamp.Format(time.RFC3339Nano),
							"message":   entry.Line,
							"labels":    entry.Labels,
							"level":     entry.Labels["level"],
						},
					})

					err := conn.WriteMessage(websocket.TextMessage, msg)
					if err != nil {
						h.unregister <- conn
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a log entry to all matching clients
func (h *StreamHub) Broadcast(entry *models.LogEntry) {
	select {
	case h.broadcast <- entry:
	default:
		// Channel full, drop message
		log.Println("Broadcast channel full, dropping message")
	}
}

// matchesFilter checks if log labels match the filter
func matchesFilter(logLabels, filterLabels map[string]string) bool {
	if len(filterLabels) == 0 {
		return true // No filter means match all
	}
	for k, v := range filterLabels {
		if logLabels[k] != v {
			return false
		}
	}
	return true
}

// StreamHandler handles WebSocket connections for live log streaming
type StreamHandler struct {
	hub *StreamHub
}

// ServeMetricsSSE handles /metrics/stream SSE endpoint for real-time Prometheus metrics
func ServeMetricsSSE(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			// Capture Prometheus metrics as text
			w.Write([]byte("event: metrics\n"))
			w.Write([]byte("data: "))
			promhttp.Handler().ServeHTTP(&sseWriter{w}, r)
			w.Write([]byte("\n\n"))
			flusher.Flush()
		}
	}
}

// sseWriter wraps http.ResponseWriter to capture promhttp output as SSE data
type sseWriter struct {
	http.ResponseWriter
}

func (w *sseWriter) Write(p []byte) (int, error) {
	// Replace newlines with \ndata:  for SSE compliance
	s := string(p)
	s = s[:len(s)-1] // Remove last newline
	lines := []byte("")
	for _, line := range splitLines(s) {
		lines = append(lines, []byte("\ndata: "+line)...)
	}
	return w.ResponseWriter.Write(lines)
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}
}

// NewStreamHandler creates a new stream handler
func NewStreamHandler(hub *StreamHub) *StreamHandler {
	return &StreamHandler{hub: hub}
}

// HandleStream handles GET /stream WebSocket endpoint
func (h *StreamHandler) HandleStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Parse filter from query params
	filter := StreamFilter{
		Labels: make(map[string]string),
	}

	// Get labels from query string
	for key, values := range r.URL.Query() {
		if key != "query" && len(values) > 0 {
			filter.Labels[key] = values[0]
		}
	}

	// Register client
	h.hub.register <- &clientRegistration{
		conn:   conn,
		filter: filter,
	}

	// Send welcome message
	welcome, _ := json.Marshal(map[string]interface{}{
		"type":    "connected",
		"message": "Connected to log stream",
		"filter":  filter.Labels,
	})
	conn.WriteMessage(websocket.TextMessage, welcome)

	// Handle incoming messages (for filter updates)
	go func() {
		defer func() {
			h.hub.unregister <- conn
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				break
			}

			// Handle filter update messages
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}

			if msg["type"] == "filter" {
				if labels, ok := msg["labels"].(map[string]interface{}); ok {
					newFilter := StreamFilter{Labels: make(map[string]string)}
					for k, v := range labels {
						if str, ok := v.(string); ok {
							newFilter.Labels[k] = str
						}
					}
					h.hub.mu.Lock()
					h.hub.clients[conn] = newFilter
					h.hub.mu.Unlock()

					// Confirm filter update
					confirm, _ := json.Marshal(map[string]interface{}{
						"type":   "filter_updated",
						"filter": newFilter.Labels,
					})
					conn.WriteMessage(websocket.TextMessage, confirm)
				}
			}
		}
	}()
}

// GetClientCount returns the number of connected clients
func (h *StreamHub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
