package api

import (
	"encoding/json"
	"net/http"

	"github.com/logpulse/backend/internal/ingest"
	"github.com/logpulse/backend/internal/models"
)

// IngestHandler handles log ingestion
type IngestHandler struct {
	ingestor *ingest.Ingestor
}

// NewIngestHandler creates a new ingest handler
func NewIngestHandler(ingestor *ingest.Ingestor) *IngestHandler {
	return &IngestHandler{ingestor: ingestor}
}

// Ingest handles POST /ingest
func (h *IngestHandler) Ingest(w http.ResponseWriter, r *http.Request) {
	var req models.IngestRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := ingest.ValidateIngestRequest(&req); err != nil {
		http.Error(w, "Validation error: "+err.Error(), http.StatusBadRequest)
		return
	}

	accepted, err := h.ingestor.Ingest(&req)
	if err != nil {
		http.Error(w, "Ingestion error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.IngestResponse{
		Accepted: accepted,
	})
}
