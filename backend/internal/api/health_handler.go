package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/yourusername/loki-lite/internal/index"
	"github.com/yourusername/loki-lite/internal/ingest"
	"github.com/yourusername/loki-lite/internal/storage"
)

var startTime = time.Now()

// HealthHandler handles health and metrics endpoints
type HealthHandler struct {
	ingestor *ingest.Ingestor
	reader   *storage.Reader
	index    *index.Index
	writer   *storage.Writer
}

// NewHealthHandler creates a new health handler
func NewHealthHandler(ingestor *ingest.Ingestor, reader *storage.Reader, idx *index.Index) *HealthHandler {
	return &HealthHandler{
		ingestor: ingestor,
		reader:   reader,
		index:    idx,
	}
}

// SetWriter sets the storage writer for metrics
func (h *HealthHandler) SetWriter(w *storage.Writer) {
	h.writer = w
}

// Health handles GET /health
func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	lines, bytes := h.ingestor.GetMetrics()
	chunkCount, _ := h.index.Stats()

	var storageUsed int64
	if h.writer != nil {
		storageUsed = h.writer.GetStorageSize()
	}

	uptime := int64(time.Since(startTime).Seconds())

	// Calculate ingestion rate (simple approximation)
	ingestionRate := int(0)
	if uptime > 0 {
		ingestionRate = int(lines / uptime)
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{
		"status": "healthy",
		"ingestionRate": %d,
		"storageUsed": %d,
		"chunksCount": %d,
		"uptime": %d
	}`, ingestionRate, storageUsed, chunkCount, uptime)
}

// Metrics handles GET /metrics (Prometheus format)
func (h *HealthHandler) Metrics(w http.ResponseWriter, r *http.Request) {
	lines, bytes := h.ingestor.GetMetrics()
	chunkCount, _ := h.index.Stats()

	var storageUsed int64
	if h.writer != nil {
		storageUsed = h.writer.GetStorageSize()
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4")

	fmt.Fprintf(w, `# HELP lokiclone_ingested_bytes_total Total bytes ingested
# TYPE lokiclone_ingested_bytes_total counter
lokiclone_ingested_bytes_total %d

# HELP lokiclone_ingested_lines_total Total log lines ingested
# TYPE lokiclone_ingested_lines_total counter
lokiclone_ingested_lines_total %d

# HELP lokiclone_chunks_stored_total Total chunks stored on disk
# TYPE lokiclone_chunks_stored_total gauge
lokiclone_chunks_stored_total %d

# HELP lokiclone_storage_bytes Total storage used in bytes
# TYPE lokiclone_storage_bytes gauge
lokiclone_storage_bytes %d

# HELP lokiclone_uptime_seconds Server uptime in seconds
# TYPE lokiclone_uptime_seconds gauge
lokiclone_uptime_seconds %d
`, bytes, lines, chunkCount, storageUsed, int64(time.Since(startTime).Seconds()))
}
