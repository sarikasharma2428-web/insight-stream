// insight-stream Node.js SDK (basic)
const axios = require('axios');

class InsightStream {
  constructor({ baseUrl, apiKey }) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async ingestLog(labels, message, timestamp = new Date().toISOString()) {
    const payload = {
      streams: [
        {
          labels,
          entries: [{ ts: timestamp, line: message }],
        },
      ],
    };
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    const res = await axios.post(`${this.baseUrl}/ingest`, payload, { headers });
    return res.data;
  }

  async queryLogs(query, limit = 100) {
    const headers = {};
    if (this.apiKey) headers['X-API-Key'] = this.apiKey;
    const res = await axios.get(`${this.baseUrl}/query`, {
      params: { query, limit },
      headers,
    });
    return res.data;
  }
}

module.exports = InsightStream;
