package api

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/yourusername/loki-lite/internal/config"
	"github.com/yourusername/loki-lite/internal/index"
	"github.com/yourusername/loki-lite/internal/ingest"
	"github.com/yourusername/loki-lite/internal/query"
	"github.com/yourusername/loki-lite/internal/storage"
)

// NewRouter creates and configures the HTTP router
func NewRouter(
	ingestor *ingest.Ingestor,
	reader *storage.Reader,
	labelIndex *index.Index,
	cfg *config.Config,
	streamHub *StreamHub,
) *mux.Router {
	router := mux.NewRouter()

	// Create handlers
	healthHandler := NewHealthHandler(ingestor, reader, labelIndex)
	ingestHandler := NewIngestHandler(ingestor)
	queryHandler := NewQueryHandler(labelIndex, reader)
	streamHandler := NewStreamHandler(streamHub)
	lokiHandler := NewLokiHandler(labelIndex, reader)

	// Apply middleware
	router.Use(corsMiddleware)
	router.Use(loggingMiddleware)

	if cfg.Auth.Enabled {
		router.Use(authMiddleware(cfg.Auth.APIKey))
	}

	// Register routes
	router.HandleFunc("/health", healthHandler.Health).Methods("GET", "OPTIONS")
	router.HandleFunc("/metrics", healthHandler.Metrics).Methods("GET", "OPTIONS")

	router.HandleFunc("/ingest", ingestHandler.Ingest).Methods("POST", "OPTIONS")

	router.HandleFunc("/query", queryHandler.Query).Methods("GET", "OPTIONS")
	router.HandleFunc("/labels", queryHandler.Labels).Methods("GET", "OPTIONS")
	router.HandleFunc("/labels/{name}/values", queryHandler.LabelValues).Methods("GET", "OPTIONS")

	// WebSocket endpoint for live streaming
	router.HandleFunc("/stream", streamHandler.HandleStream).Methods("GET")

	// Loki-compatible API endpoints (for Grafana integration)
	router.HandleFunc("/ready", lokiHandler.Ready).Methods("GET", "OPTIONS")
	router.HandleFunc("/loki/api/v1/query_range", lokiHandler.QueryRange).Methods("GET", "OPTIONS")
	router.HandleFunc("/loki/api/v1/query", lokiHandler.Query).Methods("GET", "OPTIONS")
	router.HandleFunc("/loki/api/v1/labels", lokiHandler.Labels).Methods("GET", "OPTIONS")
	router.HandleFunc("/loki/api/v1/label/{name}/values", lokiHandler.LabelValues).Methods("GET", "OPTIONS")

	return router
}

// corsMiddleware adds CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware logs all requests
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
	})
}

// authMiddleware checks API key
func authMiddleware(apiKey string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == "OPTIONS" {
				next.ServeHTTP(w, r)
				return
			}

			// Skip auth for WebSocket upgrade
			if r.Header.Get("Upgrade") == "websocket" {
				next.ServeHTTP(w, r)
				return
			}

			key := r.Header.Get("X-API-Key")
			if key == "" {
				key = r.Header.Get("Authorization")
			}

			if key != apiKey {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
