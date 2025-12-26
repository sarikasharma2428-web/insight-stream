module github.com/logpulse/backend

go 1.21

require (
	github.com/boltdb/bolt v1.3.1
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.1
	gopkg.in/yaml.v3 v3.0.1
	github.com/prometheus/client_golang v1.17.0
	go.opentelemetry.io/otel v1.23.1
	go.opentelemetry.io/otel/sdk v1.23.1
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.23.1
)

require (
	golang.org/x/net v0.17.0 // indirect
	golang.org/x/sys v0.13.0 // indirect
)
