import { useState, useEffect } from 'react';
import { X, Save, Trash2, CheckCircle, AlertCircle, Loader2, Wifi, ExternalLink, Copy } from 'lucide-react';
import { BackendConfig } from '@/types/logs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: BackendConfig | null;
  onSave: (config: BackendConfig) => void;
  onDisconnect: () => void;
}

export function SettingsPanel({ isOpen, onClose, config, onSave, onDisconnect }: SettingsPanelProps) {
  const [apiUrl, setApiUrl] = useState(config?.apiUrl || 'http://localhost:8080');
  const [apiKey, setApiKey] = useState(config?.apiKey || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');

  // Update form when config changes
  useEffect(() => {
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey || '');
    }
  }, [config]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setTestMessage('');

    try {
      // Temporarily set config for testing
      const originalConfig = apiClient.getConfig();
      apiClient.setConfig({ apiUrl, apiKey: apiKey || undefined });
      
      const health = await apiClient.health();
      
      setTestResult('success');
      setTestMessage(`Backend is ${health.status}. Uptime: ${Math.floor(health.uptime / 60)} minutes`);
      toast.success('Connection successful!');
      
      // Keep the config if successful
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setTestResult('error');
      setTestMessage(errorMsg);
      toast.error('Connection failed', { description: errorMsg });
      
      // Reset config on failure
      if (config) {
        apiClient.setConfig(config);
      } else {
        apiClient.clearConfig();
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!apiUrl.trim()) {
      toast.error('Please enter a backend URL');
      return;
    }

    const newConfig: BackendConfig = {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim() || undefined,
    };
    onSave(newConfig);
  };

  const handleDisconnect = () => {
    onDisconnect();
    setApiUrl('http://localhost:8080');
    setApiKey('');
    setTestResult(null);
    setTestMessage('');
  };

  const copyEndpoint = (endpoint: string) => {
    navigator.clipboard.writeText(`${apiUrl}${endpoint}`);
    toast.success(`Copied: ${apiUrl}${endpoint}`);
  };

  const endpoints = [
    { method: 'GET', path: '/health', description: 'Health check & system stats', color: 'text-success' },
    { method: 'GET', path: '/query', description: 'Query logs with filters', color: 'text-info' },
    { method: 'POST', path: '/ingest', description: 'Ingest new log entries', color: 'text-warning' },
    { method: 'GET', path: '/labels', description: 'List all label keys', color: 'text-primary' },
    { method: 'GET', path: '/metrics', description: 'Prometheus-format metrics', color: 'text-primary' },
    { method: 'WS', path: '/stream', description: 'Real-time log streaming', color: 'text-purple-400' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-panel rounded-xl w-full max-w-2xl p-6 shadow-2xl border border-border animate-fade-in max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Wifi className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-bold">Backend Configuration</h2>
              <p className="text-sm text-muted-foreground">Connect to your LokiClone Go backend</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Connection Form */}
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Backend API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8080"
                className="query-input w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The URL where your Go backend is running (e.g., http://localhost:8080)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">API Key (optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key if required"
                className="query-input w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty if your backend doesn't require authentication
              </p>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg border ${
              testResult === 'success' 
                ? 'bg-success/10 border-success/30 text-success' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              <div className="flex items-center gap-2">
                {testResult === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {testResult === 'success' ? 'Connection Successful' : 'Connection Failed'}
                </span>
              </div>
              {testMessage && (
                <p className="text-xs mt-1 opacity-80">{testMessage}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTest}
              disabled={isTesting || !apiUrl}
              variant="secondary"
              className="flex items-center gap-2"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : testResult === 'error' ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}
              Test Connection
            </Button>

            <Button
              onClick={handleSave}
              disabled={!apiUrl}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save & Connect
            </Button>

            {config && (
              <Button
                onClick={handleDisconnect}
                variant="destructive"
                className="ml-auto flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </Button>
            )}
          </div>

          {/* Endpoints Reference */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              Expected API Endpoints
            </h3>
            <div className="grid gap-2">
              {endpoints.map((ep) => (
                <div 
                  key={ep.path}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold ${ep.color} w-10`}>
                      {ep.method}
                    </span>
                    <code className="text-sm font-mono">{ep.path}</code>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      — {ep.description}
                    </span>
                  </div>
                  <button
                    onClick={() => copyEndpoint(ep.path)}
                    className="p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background rounded"
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Start Guide */}
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold mb-3">Quick Start</h3>
            <div className="text-xs text-muted-foreground space-y-2 font-mono bg-muted/50 p-4 rounded-lg">
              <p className="text-foreground"># Start the Go backend:</p>
              <p>cd loki-lite && go run cmd/server/main.go</p>
              <p className="text-foreground mt-3"># Or with Docker:</p>
              <p>docker-compose -f loki-lite/docker/docker-compose.yml up</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
