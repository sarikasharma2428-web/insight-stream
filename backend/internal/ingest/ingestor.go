package ingest

import (
	"log"
	"sync"
	"time"

	"github.com/yourusername/loki-lite/internal/index"
	"github.com/yourusername/loki-lite/internal/models"
	"github.com/yourusername/loki-lite/internal/storage"
)

// StreamBroadcaster interface for live log streaming
type StreamBroadcaster interface {
	Broadcast(entry *models.LogEntry)
}

// Ingestor handles incoming logs and buffers them before writing
type Ingestor struct {
	index       *index.Index
	writer      *storage.Writer
	broadcaster StreamBroadcaster
	bufSize     int

	// Buffer per label set
	buffers  map[string]*logBuffer
	bufferMu sync.Mutex

	// Metrics
	ingestedLines int64
	ingestedBytes int64
	metricsMu     sync.RWMutex

	stopChan chan struct{}
	wg       sync.WaitGroup
}

type logBuffer struct {
	labels  map[string]string
	entries []models.LogEntry
	size    int
}

// NewIngestor creates a new log ingestor
func NewIngestor(idx *index.Index, writer *storage.Writer, bufferSize int, broadcaster StreamBroadcaster) *Ingestor {
	return &Ingestor{
		index:       idx,
		writer:      writer,
		broadcaster: broadcaster,
		bufSize:     bufferSize,
		buffers:     make(map[string]*logBuffer),
		stopChan:    make(chan struct{}),
	}
}

// Start begins the background flush worker
func (ing *Ingestor) Start() {
	ing.wg.Add(1)
	go ing.flushWorker()
}

// Stop gracefully shuts down the ingestor
func (ing *Ingestor) Stop() {
	close(ing.stopChan)
	ing.wg.Wait()
	ing.flushAll()
}

// Ingest processes incoming log streams
func (ing *Ingestor) Ingest(req *models.IngestRequest) (int, error) {
	accepted := 0

	for _, stream := range req.Streams {
		if err := ValidateStream(&stream); err != nil {
			log.Printf("Invalid stream: %v", err)
			continue
		}

		labelHash := models.Labels(stream.Labels).Hash()

		ing.bufferMu.Lock()
		buf, exists := ing.buffers[labelHash]
		if !exists {
			buf = &logBuffer{
				labels:  stream.Labels,
				entries: make([]models.LogEntry, 0, ing.bufSize),
			}
			ing.buffers[labelHash] = buf
		}

		for _, entry := range stream.Entries {
			ts, err := time.Parse(time.RFC3339, entry.Ts)
			if err != nil {
				ts = time.Now()
			}

			logEntry := models.LogEntry{
				ID:        generateLogID(),
				Timestamp: ts,
				Line:      entry.Line,
				Labels:    stream.Labels,
			}

			buf.entries = append(buf.entries, logEntry)
			buf.size += len(entry.Line)
			accepted++

			// Broadcast to live stream subscribers
			if ing.broadcaster != nil {
				ing.broadcaster.Broadcast(&logEntry)
			}

			// Update metrics
			ing.metricsMu.Lock()
			ing.ingestedLines++
			ing.ingestedBytes += int64(len(entry.Line))
			ing.metricsMu.Unlock()
		}

		// Flush if buffer is full
		if len(buf.entries) >= ing.bufSize {
			ing.flushBuffer(labelHash, buf)
			ing.buffers[labelHash] = &logBuffer{
				labels:  stream.Labels,
				entries: make([]models.LogEntry, 0, ing.bufSize),
			}
		}
		ing.bufferMu.Unlock()
	}

	return accepted, nil
}

// flushWorker periodically flushes buffers
func (ing *Ingestor) flushWorker() {
	defer ing.wg.Done()
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ing.flushAll()
		case <-ing.stopChan:
			return
		}
	}
}

// flushAll flushes all buffers
func (ing *Ingestor) flushAll() {
	ing.bufferMu.Lock()
	defer ing.bufferMu.Unlock()

	for hash, buf := range ing.buffers {
		if len(buf.entries) > 0 {
			ing.flushBuffer(hash, buf)
			buf.entries = buf.entries[:0]
			buf.size = 0
		}
	}
}

// flushBuffer writes a buffer to disk
func (ing *Ingestor) flushBuffer(hash string, buf *logBuffer) {
	if len(buf.entries) == 0 {
		return
	}

	chunkID, startTime, endTime, err := ing.writer.WriteChunk(buf.labels, buf.entries)
	if err != nil {
		log.Printf("Failed to write chunk: %v", err)
		return
	}

	ing.index.AddChunk(chunkID, buf.labels, startTime, endTime, len(buf.entries))
	log.Printf("Flushed chunk %s with %d entries", chunkID, len(buf.entries))
}

// GetMetrics returns ingestion metrics
func (ing *Ingestor) GetMetrics() (lines int64, bytes int64) {
	ing.metricsMu.RLock()
	defer ing.metricsMu.RUnlock()
	return ing.ingestedLines, ing.ingestedBytes
}

// generateLogID creates a unique log ID
func generateLogID() string {
	return time.Now().Format("20060102150405.000000000")
}
