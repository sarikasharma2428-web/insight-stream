package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/yourusername/loki-lite/internal/index"
	"github.com/yourusername/loki-lite/internal/query"
	"github.com/yourusername/loki-lite/internal/storage"
)

// LokiHandler handles Loki-compatible API endpoints for Grafana
type LokiHandler struct {
	index    *index.Index
	reader   *storage.Reader
	executor *query.Executor
}

// NewLokiHandler creates a new Loki-compatible handler
func NewLokiHandler(idx *index.Index, reader *storage.Reader) *LokiHandler {
	return &LokiHandler{
		index:    idx,
		reader:   reader,
		executor: query.NewExecutor(idx, reader),
	}
}

// LokiQueryRangeResponse represents Loki's query_range response format
type LokiQueryRangeResponse struct {
	Status string         `json:"status"`
	Data   LokiResultData `json:"data"`
}

// LokiResultData contains the result type and values
type LokiResultData struct {
	ResultType string       `json:"resultType"`
	Result     []LokiStream `json:"result"`
}

// LokiStream represents a single log stream
type LokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][]string        `json:"values"`
}

// QueryRange handles GET /loki/api/v1/query_range (Grafana-compatible)
func (h *LokiHandler) QueryRange(w http.ResponseWriter, r *http.Request) {
	queryStr := r.URL.Query().Get("query")
	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")
	limitStr := r.URL.Query().Get("limit")

	// Parse time range (Loki uses nanoseconds or RFC3339)
	var startTime, endTime time.Time
	var err error

	if startStr != "" {
		startTime, err = parseLokiTime(startStr)
		if err != nil {
			http.Error(w, "Invalid start time format", http.StatusBadRequest)
			return
		}
	} else {
		startTime = time.Now().Add(-1 * time.Hour)
	}

	if endStr != "" {
		endTime, err = parseLokiTime(endStr)
		if err != nil {
			http.Error(w, "Invalid end time format", http.StatusBadRequest)
			return
		}
	} else {
		endTime = time.Now()
	}

	// Parse limit
	limit := 1000
	if limitStr != "" {
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit <= 0 {
			limit = 1000
		}
	}

	// Execute query
	result, err := h.executor.Execute(queryStr, startTime, endTime, limit)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Convert to Loki format - group by labels
	streamMap := make(map[string]*LokiStream)

	for _, log := range result.Logs {
		// Create label key for grouping
		labelKey := labelsToKey(log.Labels)

		if stream, exists := streamMap[labelKey]; exists {
			// Add value to existing stream
			stream.Values = append(stream.Values, []string{
				strconv.FormatInt(log.Timestamp.UnixNano(), 10),
				log.Line,
			})
		} else {
			// Create new stream
			streamMap[labelKey] = &LokiStream{
				Stream: log.Labels,
				Values: [][]string{
					{strconv.FormatInt(log.Timestamp.UnixNano(), 10), log.Line},
				},
			}
		}
	}

	// Convert map to slice
	streams := make([]LokiStream, 0, len(streamMap))
	for _, stream := range streamMap {
		streams = append(streams, *stream)
	}

	response := LokiQueryRangeResponse{
		Status: "success",
		Data: LokiResultData{
			ResultType: "streams",
			Result:     streams,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Query handles GET /loki/api/v1/query (instant query)
func (h *LokiHandler) Query(w http.ResponseWriter, r *http.Request) {
	// Instant query - use small time window
	queryStr := r.URL.Query().Get("query")
	limitStr := r.URL.Query().Get("limit")

	endTime := time.Now()
	startTime := endTime.Add(-5 * time.Minute)

	limit := 100
	if limitStr != "" {
		limit, _ = strconv.Atoi(limitStr)
		if limit <= 0 {
			limit = 100
		}
	}

	result, err := h.executor.Execute(queryStr, startTime, endTime, limit)
	if err != nil {
		http.Error(w, "Query error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Convert to Loki format
	streamMap := make(map[string]*LokiStream)

	for _, log := range result.Logs {
		labelKey := labelsToKey(log.Labels)

		if stream, exists := streamMap[labelKey]; exists {
			stream.Values = append(stream.Values, []string{
				strconv.FormatInt(log.Timestamp.UnixNano(), 10),
				log.Line,
			})
		} else {
			streamMap[labelKey] = &LokiStream{
				Stream: log.Labels,
				Values: [][]string{
					{strconv.FormatInt(log.Timestamp.UnixNano(), 10), log.Line},
				},
			}
		}
	}

	streams := make([]LokiStream, 0, len(streamMap))
	for _, stream := range streamMap {
		streams = append(streams, *stream)
	}

	response := LokiQueryRangeResponse{
		Status: "success",
		Data: LokiResultData{
			ResultType: "streams",
			Result:     streams,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Labels handles GET /loki/api/v1/labels
func (h *LokiHandler) Labels(w http.ResponseWriter, r *http.Request) {
	labels := h.index.GetAllLabels()

	response := map[string]interface{}{
		"status": "success",
		"data":   labels,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// LabelValues handles GET /loki/api/v1/label/{name}/values
func (h *LokiHandler) LabelValues(w http.ResponseWriter, r *http.Request) {
	// Extract label name from URL path
	// Path: /loki/api/v1/label/{name}/values
	path := r.URL.Path
	var labelName string

	// Parse: /loki/api/v1/label/service/values
	if len(path) > 20 {
		// Find label name between /label/ and /values
		start := 18 // len("/loki/api/v1/label/")
		end := len(path) - 7 // Remove /values
		if end > start {
			labelName = path[start:end]
		}
	}

	if labelName == "" {
		http.Error(w, "Invalid label name", http.StatusBadRequest)
		return
	}

	values := h.index.GetLabelValues(labelName)

	response := map[string]interface{}{
		"status": "success",
		"data":   values,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Ready handles GET /ready (health check for Grafana)
func (h *LokiHandler) Ready(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ready"))
}

// parseLokiTime parses time in Loki format (nanoseconds or RFC3339)
func parseLokiTime(s string) (time.Time, error) {
	// Try nanoseconds first
	if ns, err := strconv.ParseInt(s, 10, 64); err == nil {
		return time.Unix(0, ns), nil
	}

	// Try RFC3339
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}

	// Try RFC3339Nano
	return time.Parse(time.RFC3339Nano, s)
}

// labelsToKey creates a unique key from labels map
func labelsToKey(labels map[string]string) string {
	key := ""
	for k, v := range labels {
		key += k + "=" + v + ","
	}
	return key
}
