# insight_stream Python SDK (basic)
import requests
from typing import Dict, Optional

class InsightStream:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url
        self.api_key = api_key

    def ingest_log(self, labels: Dict[str, str], message: str, timestamp: Optional[str] = None):
        import datetime
        if not timestamp:
            timestamp = datetime.datetime.utcnow().isoformat() + 'Z'
        payload = {
            "streams": [
                {
                    "labels": labels,
                    "entries": [{"ts": timestamp, "line": message}]
                }
            ]
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        resp = requests.post(f"{self.base_url}/ingest", json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def query_logs(self, query: str, limit: int = 100):
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        resp = requests.get(f"{self.base_url}/query", params={"query": query, "limit": limit}, headers=headers)
        resp.raise_for_status()
        return resp.json()
