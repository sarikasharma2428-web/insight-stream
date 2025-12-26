package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/logpulse/backend/internal/plugin"

	"context"
	gootel "go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	"go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"

	"github.com/logpulse/backend/internal/plugin"

	"github.com/logpulse/backend/internal/api"
	"github.com/logpulse/backend/internal/config"
	"github.com/logpulse/backend/internal/index"
	"github.com/logpulse/backend/internal/ingest"
	"github.com/logpulse/backend/internal/storage"
)

func main() {
	// Load alert rules
	alertRules, _ := config.LoadAlerts("configs/alerts.yaml")
	alertManager := plugin.NewAlertManager(webhookNotifier)
	for _, rule := range alertRules {
		alertManager.AddRule(plugin.AlertRule{
			Name:      rule.Name,
			Expr:      rule.Expr,
			Threshold: rule.Threshold,
			Window:    5 * time.Minute, // parse from rule.Window if needed
			Channels:  rule.Channels,
			Labels:    rule.Labels,
		})
	}

	// Dummy query function for alert evaluation (replace with real query logic)
	queryFunc := func(expr string) (float64, error) {
		// TODO: Implement real log query evaluation for alerting
		return 11, nil // Always triggers for demo
	}

	// Start alert evaluation loop
	go func() {
		for {
			alertManager.EvaluateRules(queryFunc)
			time.Sleep(60 * time.Second)
		}
	}()
	// --- OpenTelemetry Tracing Setup ---
	exp, err := stdouttrace.New(stdouttrace.WithPrettyPrint())
	if err != nil {
		log.Fatalf("Failed to create OTel exporter: %v", err)
	}
	tp := trace.NewTracerProvider(
		trace.WithBatcher(exp),
		trace.WithResource(resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName("insight-stream-backend"),
		)),
	)
	gootel.SetTracerProvider(tp)
	defer func() { _ = tp.Shutdown(context.Background()) }()
	// Load configuration
	cfg, err := config.Load("configs/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Load webhooks
	var webhookNotifier *plugin.WebhookNotifier
	webhookCfgs, err := config.LoadWebhooks("configs/webhooks.yaml")
	if err == nil && len(webhookCfgs) > 0 {
		pluginCfgs := make([]plugin.WebhookConfig, len(webhookCfgs))
		for i, w := range webhookCfgs {
			pluginCfgs[i] = plugin.WebhookConfig{URL: w.URL, Events: w.Events}
		}
		webhookNotifier = plugin.NewWebhookNotifier(pluginCfgs)
		log.Printf("Loaded %d webhook(s)", len(pluginCfgs))
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
	router := api.NewRouterWithWebhooks(ingestor, storageReader, labelIndex, cfg, streamHub, webhookNotifier)

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
