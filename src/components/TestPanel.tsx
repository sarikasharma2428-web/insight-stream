import { useState } from 'react';
import { Send, Trash2, Copy, Plus, AlertTriangle, Info, Bug, AlertCircle } from 'lucide-react';
import { IngestPayload, LogLevel } from '@/types/logs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface TestPanelProps {
  isConnected: boolean;
}

export function TestPanel({ isConnected }: TestPanelProps) {
  const [service, setService] = useState('test-service');
  const [env, setEnv] = useState('dev');
  const [level, setLevel] = useState<LogLevel>('info');
  const [message, setMessage] = useState('This is a test log message');
  const [customLabels, setCustomLabels] = useState<Array<{ key: string; value: string }>>([]);
  const [isSending, setIsSending] = useState(false);

  const levelIcons: Record<LogLevel, React.ReactNode> = {
    error: <AlertCircle className="h-4 w-4" />,
    warn: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />,
    debug: <Bug className="h-4 w-4" />,
  };

  const levelColors: Record<LogLevel, string> = {
    error: 'bg-destructive/20 text-destructive border-destructive/30',
    warn: 'bg-warning/20 text-warning border-warning/30',
    info: 'bg-info/20 text-info border-info/30',
    debug: 'bg-muted text-muted-foreground border-border',
  };

  const handleSend = async () => {
    if (!isConnected) {
      toast.error('Connect to backend first');
      return;
    }

    setIsSending(true);
    try {
      const labels: Record<string, string> = {
        service,
        env,
        level,
      };
      
      customLabels.forEach(({ key, value }) => {
        if (key && value) {
          labels[key] = value;
        }
      });

      const payload: IngestPayload = {
        streams: [
          {
            labels,
            entries: [
              {
                ts: new Date().toISOString(),
                line: message,
              },
            ],
          },
        ],
      };

      const result = await apiClient.ingest(payload);
      toast.success(`Log ingested! Accepted: ${result.accepted}`);
    } catch (error) {
      toast.error('Failed to ingest log. Check backend connection.');
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkSend = async (count: number) => {
    if (!isConnected) {
      toast.error('Connect to backend first');
      return;
    }

    setIsSending(true);
    try {
      const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
      const services = ['api-gateway', 'auth-service', 'user-service', 'payment-service'];
      const messages = [
        'Request processed successfully',
        'Connection timeout after 30s',
        'User logged in',
        'Cache refreshed',
        'Rate limit exceeded',
        'Database query completed',
      ];

      const entries = Array.from({ length: count }, (_, i) => ({
        ts: new Date(Date.now() - i * 1000).toISOString(),
        line: messages[Math.floor(Math.random() * messages.length)],
      }));

      const payload: IngestPayload = {
        streams: [
          {
            labels: {
              service: services[Math.floor(Math.random() * services.length)],
              env: 'test',
              level: levels[Math.floor(Math.random() * levels.length)],
            },
            entries,
          },
        ],
      };

      const result = await apiClient.ingest(payload);
      toast.success(`Bulk ingest complete! Accepted: ${result.accepted}`);
    } catch (error) {
      toast.error('Bulk ingest failed');
    } finally {
      setIsSending(false);
    }
  };

  const addCustomLabel = () => {
    setCustomLabels([...customLabels, { key: '', value: '' }]);
  };

  const removeCustomLabel = (index: number) => {
    setCustomLabels(customLabels.filter((_, i) => i !== index));
  };

  const updateCustomLabel = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customLabels];
    updated[index][field] = value;
    setCustomLabels(updated);
  };

  const copyPayload = () => {
    const labels: Record<string, string> = { service, env, level };
    customLabels.forEach(({ key, value }) => {
      if (key && value) labels[key] = value;
    });

    const payload: IngestPayload = {
      streams: [{
        labels,
        entries: [{ ts: new Date().toISOString(), line: message }],
      }],
    };

    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Payload copied to clipboard');
  };

  return (
    <div className="glass-panel border-l border-border w-80 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Test & Debug Panel
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Manually inject logs for testing
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 scrollbar-thin">
        <div>
          <label className="block text-xs font-medium mb-1.5">Service</label>
          <input
            type="text"
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="query-input w-full text-sm py-2"
            placeholder="service-name"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">Environment</label>
          <input
            type="text"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="query-input w-full text-sm py-2"
            placeholder="prod, staging, dev"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">Level</label>
          <div className="grid grid-cols-4 gap-1">
            {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-mono uppercase border transition-all ${
                  level === l ? levelColors[l] : 'bg-muted/50 text-muted-foreground border-transparent hover:border-border'
                }`}
              >
                {levelIcons[l]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="query-input w-full text-sm py-2 min-h-[80px] resize-none"
            placeholder="Log message..."
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium">Custom Labels</label>
            <button
              onClick={addCustomLabel}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          </div>
          
          {customLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={label.key}
                onChange={(e) => updateCustomLabel(i, 'key', e.target.value)}
                className="query-input flex-1 text-xs py-1.5"
                placeholder="key"
              />
              <input
                type="text"
                value={label.value}
                onChange={(e) => updateCustomLabel(i, 'value', e.target.value)}
                className="query-input flex-1 text-xs py-1.5"
                placeholder="value"
              />
              <button
                onClick={() => removeCustomLabel(i)}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border space-y-3">
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={!isConnected || isSending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Send Log
          </button>
          <button
            onClick={copyPayload}
            className="px-3 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleBulkSend(10)}
            disabled={!isConnected || isSending}
            className="flex-1 px-3 py-1.5 rounded text-xs font-mono bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Send 10
          </button>
          <button
            onClick={() => handleBulkSend(100)}
            disabled={!isConnected || isSending}
            className="flex-1 px-3 py-1.5 rounded text-xs font-mono bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Send 100
          </button>
          <button
            onClick={() => handleBulkSend(1000)}
            disabled={!isConnected || isSending}
            className="flex-1 px-3 py-1.5 rounded text-xs font-mono bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
          >
            Send 1K
          </button>
        </div>

        {!isConnected && (
          <p className="text-xs text-warning text-center">
            Configure backend in settings to send logs
          </p>
        )}
      </div>
    </div>
  );
}
