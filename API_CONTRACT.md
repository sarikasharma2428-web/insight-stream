# LokiClone Frontend ↔ Backend API Contract

## Overview
This document defines the exact API format the frontend dashboard expects from your `loki-lite` Go backend.

---

## Endpoints Summary

| Method | Endpoint | Handler File | Description |
|--------|----------|--------------|-------------|
| GET | `/health` | `health_handler.go` | Backend health status |
| POST | `/ingest` | `ingest_handler.go` | Receive log streams |
| GET | `/query` | `query_handler.go` | Query logs by labels |
| GET | `/labels` | `query_handler.go` | List all label keys |
| GET | `/labels/{name}/values` | `query_handler.go` | List values for a label |
| GET | `/metrics` | `health_handler.go` | Prometheus-format metrics |
| GET | `/alerts` | (new) `alerts_handler.go` | List alert rules |
| POST | `/alerts` | (new) `alerts_handler.go` | Create alert rule |
| DELETE | `/alerts/{id}` | (new) `alerts_handler.go` | Delete alert rule |
| PATCH | `/alerts/{id}/status` | (new) `alerts_handler.go` | Enable/disable alert |

---

## 1. Health Check

**GET /health**

```go
// Response struct for health_handler.go
type HealthResponse struct {
    Status        string `json:"status"`        // "healthy" | "degraded" | "unhealthy"
    IngestionRate int    `json:"ingestionRate"` // logs per second
    StorageUsed   int64  `json:"storageUsed"`   // bytes on disk
    ChunksCount   int    `json:"chunksCount"`   // total chunk files
    Uptime        int64  `json:"uptime"`        // seconds since start
}
```

**Example Response:**
```json
{
  "status": "healthy",
  "ingestionRate": 1250,
  "storageUsed": 48723456,
  "chunksCount": 127,
  "uptime": 86400
}
```

---

## 2. Log Ingestion

**POST /ingest**

```go
// Request struct for ingest_handler.go
type IngestRequest struct {
    Streams []Stream `json:"streams"`
}

type Stream struct {
    Labels  map[string]string `json:"labels"`
    Entries []Entry           `json:"entries"`
}

type Entry struct {
    Ts   string `json:"ts"`   // ISO 8601 timestamp
    Line string `json:"line"` // log message
}

// Response
type IngestResponse struct {
    Accepted int `json:"accepted"` // number of entries accepted
}
```

**Example Request:**
```json
{
  "streams": [
    {
      "labels": {
        "service": "api-gateway",
        "env": "prod",
        "level": "error"
      },
      "entries": [
        {
          "ts": "2024-01-15T10:30:00.000Z",
          "line": "Connection timeout to database after 30s"
        },
        {
          "ts": "2024-01-15T10:30:01.000Z",
          "line": "Retry attempt 1 failed"
        }
      ]
    }
  ]
}
```

**Example Response:**
```json
{
  "accepted": 2
}
```

---

## 3. Query Logs

**GET /query?query={...}&start=...&end=...&limit=...**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| query | string | Yes | LogQL-style: `{service="api", env="prod"}` |
| start | string | No | ISO 8601 start time |
| end | string | No | ISO 8601 end time |
| limit | int | No | Max results (default: 100) |

```go
// Response struct for query_handler.go
type QueryResponse struct {
    Logs  []LogEntry  `json:"logs"`
    Stats QueryStats  `json:"stats"`
}

type LogEntry struct {
    ID        string            `json:"id"`
    Timestamp string            `json:"timestamp"` // ISO 8601
    Level     string            `json:"level"`     // from labels
    Message   string            `json:"message"`
    Labels    map[string]string `json:"labels"`
}

type QueryStats struct {
    QueriedChunks int `json:"queriedChunks"`
    ScannedLines  int `json:"scannedLines"`
    ExecutionTime int `json:"executionTime"` // milliseconds
}
```

**Example Request:**
```
GET /query?query={service="api-gateway",level="error"}&start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z&limit=50
```

**Example Response:**
```json
{
  "logs": [
    {
      "id": "abc123",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "error",
      "message": "Connection timeout to database after 30s",
      "labels": {
        "service": "api-gateway",
        "env": "prod",
        "level": "error",
        "host": "api-1"
      }
    }
  ],
  "stats": {
    "queriedChunks": 5,
    "scannedLines": 1250,
    "executionTime": 45
  }
}
```

---

## 4. Labels API

**GET /labels**

Returns all unique label keys across all logs.

```go
// Response: []string
```

**Example Response:**
```json
["service", "env", "level", "host", "region"]
```

---

**GET /labels/{name}/values**

Returns all unique values for a specific label.

**Example Request:**
```
GET /labels/service/values
```

**Example Response:**
```json
["api-gateway", "auth-service", "user-service", "payment-service"]
```

---

## 5. Prometheus Metrics

**GET /metrics**

Returns metrics in Prometheus text format.

```
# HELP lokiclone_ingested_bytes_total Total bytes ingested
# TYPE lokiclone_ingested_bytes_total counter
lokiclone_ingested_bytes_total 48723456

# HELP lokiclone_ingested_lines_total Total log lines ingested
# TYPE lokiclone_ingested_lines_total counter
lokiclone_ingested_lines_total 125000

# HELP lokiclone_chunks_stored_total Total chunks stored
# TYPE lokiclone_chunks_stored_total gauge
lokiclone_chunks_stored_total 127

# HELP lokiclone_query_duration_seconds Query execution duration
# TYPE lokiclone_query_duration_seconds gauge
lokiclone_query_duration_seconds 0.045
```

---

## 6. Alerts API (Optional)

**GET /alerts**

```go
type AlertRule struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Query     string `json:"query"`      // LogQL query
    Condition string `json:"condition"`  // "gt" | "lt" | "eq" | "gte" | "lte"
    Threshold int    `json:"threshold"`
    Duration  string `json:"duration"`   // "1m" | "5m" | "15m" | "1h"
    Severity  string `json:"severity"`   // "critical" | "warning" | "info"
    Enabled   bool   `json:"enabled"`
    CreatedAt string `json:"createdAt"`
    Webhook   string `json:"webhook,omitempty"`
}
```

**POST /alerts** - Create new alert (same struct without ID/CreatedAt)

**DELETE /alerts/{id}** - Delete alert

**PATCH /alerts/{id}/status** - Toggle enabled
```json
{ "enabled": true }
```

---

## Authentication

If using API key auth, the frontend sends:
```
X-API-Key: your-api-key-here
```

Check this in middleware:
```go
func authMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        apiKey := r.Header.Get("X-API-Key")
        if apiKey != os.Getenv("API_KEY") {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

---

## CORS Headers

Your Go server needs these headers for the frontend to connect:

```go
func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }
        
        next.ServeHTTP(w, r)
    })
}
```

---

## File Structure Mapping

```
Your Go Backend              →   Frontend Expects
─────────────────────────────────────────────────
internal/api/
  health_handler.go          →   GET /health, GET /metrics
  ingest_handler.go          →   POST /ingest
  query_handler.go           →   GET /query, GET /labels, GET /labels/{name}/values

internal/models/
  log.go                     →   LogEntry struct (id, timestamp, message, labels)
  chunk.go                   →   ChunkInfo for stats

internal/query/
  parser.go                  →   Parse {service="x", env="y"} format
  executor.go                →   Return QueryResponse with logs + stats
```

---

## Quick Test with curl

```bash
# Health check
curl http://localhost:8080/health

# Ingest a log
curl -X POST http://localhost:8080/ingest \
  -H "Content-Type: application/json" \
  -d '{"streams":[{"labels":{"service":"test","level":"info"},"entries":[{"ts":"2024-01-15T10:00:00Z","line":"Hello from test"}]}]}'

# Query logs
curl "http://localhost:8080/query?query=\{service=\"test\"\}&limit=10"

# Get labels
curl http://localhost:8080/labels

# Get label values
curl http://localhost:8080/labels/service/values
```
