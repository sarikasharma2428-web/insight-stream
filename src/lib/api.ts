import { BackendConfig, BackendHealth, LogEntry, IngestPayload, QueryResult } from '@/types/logs';

class ApiClient {
  private config: BackendConfig | null = null;

  setConfig(config: BackendConfig) {
    this.config = config;
    localStorage.setItem('lokiclone_config', JSON.stringify(config));
  }

  getConfig(): BackendConfig | null {
    if (this.config) return this.config;
    const stored = localStorage.getItem('lokiclone_config');
    if (stored) {
      this.config = JSON.parse(stored);
      return this.config;
    }
    return null;
  }

  clearConfig() {
    this.config = null;
    localStorage.removeItem('lokiclone_config');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (this.config?.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }
    return headers;
  }

  private getBaseUrl(): string {
    if (!this.config?.apiUrl) {
      throw new Error('Backend not configured');
    }
    return this.config.apiUrl.replace(/\/$/, '');
  }

  async health(): Promise<BackendHealth> {
    const response = await fetch(`${this.getBaseUrl()}/health`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  }

  async query(
    labels: Record<string, string>,
    start?: string,
    end?: string,
    limit: number = 100
  ): Promise<QueryResult> {
    const params = new URLSearchParams();
    
    // Build LogQL-style query string
    const labelParts = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ');
    params.set('query', `{${labelParts}}`);
    
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    params.set('limit', limit.toString());

    const response = await fetch(`${this.getBaseUrl()}/query?${params}`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Query failed: ${response.status}`);
    }
    return response.json();
  }

  async ingest(payload: IngestPayload): Promise<{ accepted: number }> {
    const response = await fetch(`${this.getBaseUrl()}/ingest`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Ingest failed: ${response.status}`);
    }
    return response.json();
  }

  async getLabels(): Promise<string[]> {
    const response = await fetch(`${this.getBaseUrl()}/labels`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to get labels: ${response.status}`);
    }
    return response.json();
  }

  async getLabelValues(label: string): Promise<string[]> {
    const response = await fetch(`${this.getBaseUrl()}/labels/${label}/values`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to get label values: ${response.status}`);
    }
    return response.json();
  }

  async getMetrics(): Promise<string> {
    const response = await fetch(`${this.getBaseUrl()}/metrics`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Failed to get metrics: ${response.status}`);
    }
    return response.text();
  }
}

export const apiClient = new ApiClient();
