# LokiLite - Lightweight Log Aggregation System

A Loki-inspired log aggregation system built in Go. Stores logs cheaply using label-based indexing without full-text search.

## Features

- **Label-based indexing** - Only indexes metadata, not log content
- **Time-series chunks** - Efficient storage with time-based organization
- **LogQL-style queries** - Familiar query syntax: `{service="api", env="prod"}`
- **Prometheus metrics** - Built-in `/metrics` endpoint
- **Zero dependencies** - Just Go standard library + gorilla/mux
- **Docker ready** - Easy containerized deployment

## Quick Start

### Run Locally

```bash
# Clone and build
cd loki-lite
go mod download
go build -o lokilite ./cmd/server

# Run
./lokilite
```

### Run with Docker

```bash
cd docker
docker-compose up -d
```

Server starts at `http://localhost:8080`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with stats |
| `/metrics` | GET | Prometheus metrics |
| `/ingest` | POST | Ingest log streams |
| `/query` | GET | Query logs |
| `/labels` | GET | List all label keys |
| `/labels/{name}/values` | GET | List values for a label |

## Usage Examples

### Ingest Logs

```bash
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "streams": [{
      "labels": {
        "service": "api-gateway",
        "env": "prod",
        "level": "error"
      },
      "entries": [{
        "ts": "2024-01-15T10:30:00Z",
        "line": "Connection timeout to database"
      }]
    }]
  }'
```

### Query Logs

```bash
# Query by labels
curl "http://localhost:8080/query?query={service=\"api-gateway\"}&limit=50"

# With time range
curl "http://localhost:8080/query?query={level=\"error\"}&start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z"
```

### Get Labels

```bash
# List all labels
curl http://localhost:8080/labels

# Get values for a label
curl http://localhost:8080/labels/service/values
```

## Configuration

Edit `configs/config.yaml` or use environment variables:

| Env Variable | Default | Description |
|--------------|---------|-------------|
| `LOKILITE_PORT` | 8080 | Server port |
| `LOKILITE_STORAGE_PATH` | ./data/logs | Log storage directory |
| `LOKILITE_API_KEY` | (none) | Enable auth with this key |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     HTTP API Layer                       │
│   /ingest    /query    /labels    /health    /metrics   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                   Ingestion Engine                       │
│   • Buffers logs in memory                              │
│   • Groups by label set                                 │
│   • Flushes to chunks periodically                      │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                    Label Index                           │
│   • In-memory map[labelHash] → []chunkID                │
│   • Tracks all unique labels/values                     │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                   Storage Layer                          │
│   • Writes JSON-line chunk files                        │
│   • Organized by date/labels                            │
│   • Retention worker cleans old data                    │
└─────────────────────────────────────────────────────────┘
```

## Generate Test Logs

```bash
chmod +x scripts/generate_logs.sh
./scripts/generate_logs.sh 1000  # Generate 1000 random logs
```

## Integration

### With Grafana

1. Add JSON datasource pointing to `http://lokilite:8080/query`
2. Use LogQL queries in dashboards

### With Prometheus

Prometheus can scrape the `/metrics` endpoint:

```yaml
scrape_configs:
  - job_name: 'lokilite'
    static_configs:
      - targets: ['localhost:8080']
```

## Project Structure

```
loki-lite/
├── cmd/server/main.go       # Entry point
├── internal/
│   ├── api/                 # HTTP handlers
│   ├── config/              # Configuration
│   ├── index/               # Label index
│   ├── ingest/              # Ingestion logic
│   ├── models/              # Data structures
│   ├── query/               # Query engine
│   └── storage/             # Disk I/O
├── configs/config.yaml      # Default config
├── docker/                  # Docker files
└── scripts/                 # Test scripts
```

## License

MIT
