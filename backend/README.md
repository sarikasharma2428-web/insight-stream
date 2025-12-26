# LogPulse - Lightweight Log Aggregation System

A Loki-inspired log aggregation system built in Go. Stores logs cheaply using label-based indexing without full-text search.

## Features

- **Label-based indexing** - Only indexes metadata, not log content
- **Time-series chunks** - Efficient storage with time-based organization
- **LogQL-style queries** - Familiar query syntax: `{service="api", env="prod"}`
- **WebSocket streaming** - Real-time log tailing via `/stream` endpoint
- **Log Agent** - Promtail-like agent for tailing files
- **Prometheus metrics** - Built-in `/metrics` endpoint
- **Zero dependencies** - Just Go standard library + gorilla packages
- **Docker ready** - Easy containerized deployment

## Quick Start

### Run Server Locally

```bash
cd backend
go mod download
go build -o logpulse ./cmd/server
./logpulse
```

### Run Agent Locally

```bash
go build -o logpulse-agent ./cmd/agent
./logpulse-agent -config configs/agent-config.yaml
```

### Run with Docker

```bash
cd backend/docker
docker-compose up -d
```

Server starts at `http://localhost:8080`

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Log Agent     │────▶│   LogPulse      │
│  (tail files)   │     │    Server       │
└─────────────────┘     └────────┬────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                   ┌────▼────┐     ┌──────▼──────┐
                   │  REST   │     │  WebSocket  │
                   │  /query │     │  /stream    │
                   └─────────┘     └─────────────┘
                                          │
                                   ┌──────▼──────┐
                                   │  Frontend   │
                                   │  Dashboard  │
                                   └─────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with stats |
| `/metrics` | GET | Prometheus metrics |
| `/ingest` | POST | Ingest log streams |
| `/query` | GET | Query logs |
| `/labels` | GET | List all label keys |
| `/labels/{name}/values` | GET | List values for a label |
| `/stream` | WebSocket | Real-time log streaming |

## WebSocket Streaming

Connect to `/stream` for real-time logs:

```javascript
const ws = new WebSocket('ws://localhost:8080/stream?service=api-gateway');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'log') {
    console.log(msg.data);
  }
};

// Update filter
ws.send(JSON.stringify({
  type: 'filter',
  labels: { level: 'error' }
}));
```

## Real-Time Metrics Streaming (SSE)

You can receive real-time Prometheus metrics updates using Server-Sent Events (SSE):

- Endpoint: `/metrics/stream`
- Content-Type: `text/event-stream`

Example (JavaScript):

```js
const es = new EventSource('http://localhost:8080/metrics/stream');
es.onmessage = (event) => {
  console.log('Metrics:', event.data);
};
```

This allows dashboards or custom tools to display live metrics without polling.

## Log Agent

The agent tails log files and sends them to the server:

```yaml
# agent-config.yaml
server:
  url: "http://localhost:8080"

targets:
  - path: "/var/log/*.log"
    labels:
      job: "varlogs"
      env: "prod"

  - path: "/app/logs/app.log"
    labels:
      service: "myapp"
```

Features:
- Glob pattern support
- Position tracking (survives restarts)
- Auto log level detection
- File rotation handling

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
curl "http://localhost:8080/query?query={service=\"api-gateway\"}&limit=50"
```

### Generate Test Logs

```bash
chmod +x scripts/generate_logs.sh
./scripts/generate_logs.sh 1000
```

## Project Structure

```
backend/
├── cmd/
│   ├── server/main.go      # Server entry point
│   └── agent/main.go       # Agent entry point
├── internal/
│   ├── api/                 # HTTP + WebSocket handlers
│   ├── config/              # Configuration
│   ├── index/               # Label index
│   ├── ingest/              # Ingestion logic
│   ├── models/              # Data structures
│   ├── query/               # Query engine
│   └── storage/             # Disk I/O
├── configs/
│   ├── config.yaml          # Server config
│   └── agent-config.yaml    # Agent config
├── docker/
│   ├── Dockerfile           # Server container
│   ├── Dockerfile.agent     # Agent container
│   └── docker-compose.yml   # Full stack
└── scripts/
    └── generate_logs.sh     # Test data generator
```

## Configuration

### Server (config.yaml)

```yaml
server:
  port: "8080"

storage:
  path: "./data/logs"
  chunk_size_bytes: 1048576
  retention_days: 7

ingest:
  buffer_size: 1000

auth:
  enabled: false
  api_key: ""
```

### Agent (agent-config.yaml)

```yaml
server:
  url: "http://localhost:8080"
  api_key: ""

positions_file: "./positions.json"

targets:
  - path: "/var/log/*.log"
    labels:
      job: "system"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOGPULSE_PORT` | 8080 | Server port |
| `LOGPULSE_STORAGE_PATH` | ./data/logs | Storage directory |
| `LOGPULSE_API_KEY` | (none) | Enable auth |
| `LOGPULSE_SERVER_URL` | http://localhost:8080 | Agent target |

## Grafana Integration

### Import Dashboard

A ready-made Grafana dashboard is provided at `backend/docker/grafana-dashboard.json`.

1. In Grafana, go to **Dashboards > Import**.
2. Upload the `grafana-dashboard.json` file or paste its contents.
3. Select your Prometheus data source (should be scraping `/prometheus-metrics` endpoint).
4. Click **Import**.

The dashboard visualizes:
- API requests, errors, and latency
- Ingested log lines and bytes
- Chunks stored, storage used, and server uptime

### Prometheus Scrape Config

Add this to your Prometheus config:

```yaml
  - job_name: 'insight-stream'
    metrics_path: /prometheus-metrics
    static_configs:
      - targets: ['<your-backend-host>:8080']
```

## Kubernetes Labels/Annotations Correlation

If your log agent or application includes Kubernetes metadata in log labels (e.g.:
- `k8s_namespace`, `k8s_pod`, `k8s_container`, or
- `k8s_annot_<annotation>`),

these will be extracted and exposed as Prometheus metrics (e.g., `lokiclone_k8s_label_namespace`, `lokiclone_k8s_annotation_<annotation>`). This allows you to correlate logs and metrics with Kubernetes context in Grafana or Prometheus queries.

Example log label payload:
```json
{
  "labels": {
    "service": "api",
    "k8s_namespace": "default",
    "k8s_pod": "api-1234",
    "k8s_annot_team": "devops"
  },
  ...
}
```

## Webhook/Plugin System

You can now send logs/alerts to external tools (Slack, PagerDuty, custom scripts) using webhooks.

- Configure webhooks in `backend/configs/webhooks.yaml`:

```yaml
webhooks:
  - url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
    events: ["log"]
  - url: "http://localhost:9000/custom-script"
    events: ["alert"]
```

- On every log ingestion, a POST request is sent to the configured URLs with log data.
- You can extend this to support custom alerting logic or plugins.

## OpenTelemetry Support

OpenTelemetry tracing is enabled for core API endpoints. You can:
- Export traces to Jaeger, Zipkin, or any OTel-compatible backend (default: stdout for demo)
- Add more spans in handlers for deeper observability

To enable advanced tracing, configure the exporter in `cmd/server/main.go`.

## API/SDK Integration

SDKs are provided for easy integration:

### Node.js
See `sdk/insight-stream.js`:
```js
const InsightStream = require('./sdk/insight-stream');
const client = new InsightStream({ baseUrl: 'http://localhost:8080' });
await client.ingestLog({ service: 'api' }, 'Hello from Node!');
```

### Python
See `sdk/insight_stream.py`:
```python
from sdk.insight_stream import InsightStream
client = InsightStream('http://localhost:8080')
client.ingest_log({ 'service': 'api' }, 'Hello from Python!')
```

Both SDKs support log ingestion and querying.

---
