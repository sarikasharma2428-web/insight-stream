package query

import (
	"sort"
	"time"

	"github.com/yourusername/loki-lite/internal/index"
	"github.com/yourusername/loki-lite/internal/models"
	"github.com/yourusername/loki-lite/internal/storage"
)

// Executor handles query execution
type Executor struct {
	index  *index.Index
	reader *storage.Reader
}

// NewExecutor creates a new query executor
func NewExecutor(idx *index.Index, reader *storage.Reader) *Executor {
	return &Executor{
		index:  idx,
		reader: reader,
	}
}

// QueryResult contains query results and stats
type QueryResult struct {
	Logs  []LogResponse `json:"logs"`
	Stats QueryStats    `json:"stats"`
}

type LogResponse struct {
	ID        string            `json:"id"`
	Timestamp string            `json:"timestamp"`
	Level     string            `json:"level"`
	Message   string            `json:"message"`
	Labels    map[string]string `json:"labels"`
}

type QueryStats struct {
	QueriedChunks int `json:"queriedChunks"`
	ScannedLines  int `json:"scannedLines"`
	ExecutionTime int `json:"executionTime"` // milliseconds
}

// Execute runs a query and returns matching logs
func (e *Executor) Execute(queryStr string, startTime, endTime time.Time, limit int) (*QueryResult, error) {
	startExec := time.Now()

	// Parse query
	labels, err := ParseQuery(queryStr)
	if err != nil {
		return nil, err
	}

	// Find matching chunks
	chunkIDs := e.index.FindChunks(labels, startTime, endTime)

	stats := QueryStats{
		QueriedChunks: len(chunkIDs),
	}

	var allLogs []models.LogEntry

	// Read logs from each chunk
	for _, chunkID := range chunkIDs {
		meta := e.index.GetChunkMeta(chunkID)
		if meta == nil {
			continue
		}

		entries, scanned, err := e.reader.ReadChunkFiltered(meta.Labels, chunkID, startTime, endTime)
		if err != nil {
			continue
		}

		stats.ScannedLines += scanned
		allLogs = append(allLogs, entries...)
	}

	// Sort by timestamp descending (newest first)
	sort.Slice(allLogs, func(i, j int) bool {
		return allLogs[i].Timestamp.After(allLogs[j].Timestamp)
	})

	// Apply limit
	if limit > 0 && len(allLogs) > limit {
		allLogs = allLogs[:limit]
	}

	// Convert to response format
	logs := make([]LogResponse, len(allLogs))
	for i, entry := range allLogs {
		level := "info"
		if l, ok := entry.Labels["level"]; ok {
			level = l
		}

		logs[i] = LogResponse{
			ID:        entry.ID,
			Timestamp: entry.Timestamp.Format(time.RFC3339Nano),
			Level:     level,
			Message:   entry.Line,
			Labels:    entry.Labels,
		}
	}

	stats.ExecutionTime = int(time.Since(startExec).Milliseconds())

	return &QueryResult{
		Logs:  logs,
		Stats: stats,
	}, nil
}
