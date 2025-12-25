package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/logpulse/backend/internal/api"
	"github.com/logpulse/backend/internal/config"
	"github.com/logpulse/backend/internal/index"
	"github.com/logpulse/backend/internal/ingest"
	"github.com/logpulse/backend/internal/storage"
)

func main() {
	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting LokiLite server on port %s", cfg.Server.Port)

	// Initialize components
	labelIndex := index.NewIndex()
	storageWriter := storage.NewWriter(cfg.Storage.Path, cfg.Storage.ChunkSizeBytes)
	storageReader := storage.NewReader(cfg.Storage.Path)
	
	// Initialize streaming hub
	streamHub := api.NewStreamHub()
	go streamHub.Run()

	// Initialize ingestor with stream hub for live broadcasting
	ingestor := ingest.NewIngestor(labelIndex, storageWriter, cfg.Ingest.BufferSize, streamHub)

	// Start background workers
	go ingestor.Start()
	go storage.StartRetentionWorker(cfg.Storage.Path, cfg.Storage.RetentionDays)

	// Setup HTTP server
	router := api.NewRouter(ingestor, storageReader, labelIndex, cfg, streamHub)

	server := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down server...")
		ingestor.Stop()
		server.Close()
	}()

	// Start server
	log.Printf("LokiLite is ready at http://localhost:%s", cfg.Server.Port)
	log.Printf("WebSocket streaming available at ws://localhost:%s/stream", cfg.Server.Port)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
