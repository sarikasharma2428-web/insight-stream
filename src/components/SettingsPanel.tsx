import { useState } from 'react';
import { X, Save, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { BackendConfig } from '@/types/logs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

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

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const tempClient = { ...apiClient };
      apiClient.setConfig({ apiUrl, apiKey: apiKey || undefined });
      await apiClient.health();
      setTestResult('success');
      toast.success('Connection successful!');
    } catch (error) {
      setTestResult('error');
      toast.error('Connection failed. Check your backend URL.');
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
    const newConfig: BackendConfig = {
      apiUrl,
      apiKey: apiKey || undefined,
    };
    onSave(newConfig);
    toast.success('Configuration saved');
    onClose();
  };

  const handleDisconnect = () => {
    onDisconnect();
    setApiUrl('http://localhost:8080');
    setApiKey('');
    setTestResult(null);
    toast.info('Disconnected from backend');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative glass-panel rounded-xl w-full max-w-lg p-6 shadow-2xl border border-border animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Backend Configuration</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
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
              Your Go backend server URL
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">API Key (optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              className="query-input w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty if your backend doesn't require authentication
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="text-sm font-medium mb-2">Expected Endpoints</h3>
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              <p><span className="text-success">GET</span> /health - Health check</p>
              <p><span className="text-info">GET</span> /query - Query logs</p>
              <p><span className="text-warning">POST</span> /ingest - Ingest logs</p>
              <p><span className="text-primary">GET</span> /metrics - Prometheus metrics</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={handleTest}
              disabled={isTesting || !apiUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : testResult === 'error' ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : null}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={!apiUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save & Connect
            </button>

            {config && (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive font-medium hover:bg-destructive/20 ml-auto"
              >
                <Trash2 className="h-4 w-4" />
                Disconnect
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-sm font-medium mb-2">Integration Info</h3>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• <strong>Grafana:</strong> Add as JSON datasource with /query endpoint</p>
            <p>• <strong>Prometheus:</strong> Scrape /metrics endpoint for system stats</p>
            <p>• <strong>Alertmanager:</strong> Configure webhook alerts to /alerts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
