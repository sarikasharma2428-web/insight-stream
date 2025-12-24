import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { QueryBar } from '@/components/QueryBar';
import { LogViewer } from '@/components/LogViewer';
import { TestPanel } from '@/components/TestPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { LogEntry, BackendConfig, BackendHealth, QueryResult } from '@/types/logs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

const Index = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [queryStats, setQueryStats] = useState<QueryResult['stats'] | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'LokiClone - Log Aggregation Dashboard';
  }, []);

  // Check for existing config on mount
  useEffect(() => {
    const savedConfig = apiClient.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      checkConnection(savedConfig);
    }
  }, []);

  // Periodic health check
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(async () => {
      try {
        const healthData = await apiClient.health();
        setHealth(healthData);
      } catch {
        setIsConnected(false);
        setHealth(null);
        toast.error('Lost connection to backend');
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const checkConnection = async (cfg: BackendConfig) => {
    try {
      apiClient.setConfig(cfg);
      const healthData = await apiClient.health();
      setHealth(healthData);
      setIsConnected(true);
    } catch {
      setIsConnected(false);
      setHealth(null);
    }
  };

  const handleSaveConfig = (newConfig: BackendConfig) => {
    apiClient.setConfig(newConfig);
    setConfig(newConfig);
    checkConnection(newConfig);
  };

  const handleDisconnect = () => {
    apiClient.clearConfig();
    setConfig(null);
    setIsConnected(false);
    setHealth(null);
    setLogs([]);
    setQueryStats(undefined);
  };

  const parseQuery = (query: string): Record<string, string> => {
    const labels: Record<string, string> = {};
    const match = query.match(/\{(.+)\}/);
    if (match) {
      const pairs = match[1].split(',');
      pairs.forEach((pair) => {
        const [key, value] = pair.split('=').map((s) => s.trim().replace(/"/g, ''));
        if (key && value) {
          labels[key] = value;
        }
      });
    }
    return labels;
  };

  const getTimeRange = (range: string): { start: string; end: string } => {
    const now = new Date();
    const durations: Record<string, number> = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const duration = durations[range] || durations['1h'];
    const start = new Date(now.getTime() - duration);

    return {
      start: start.toISOString(),
      end: now.toISOString(),
    };
  };

  const handleQuery = useCallback(async (query: string, timeRange: string) => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      const labels = parseQuery(query);
      const { start, end } = getTimeRange(timeRange);
      
      const result = await apiClient.query(labels, start, end);
      setLogs(result.logs);
      setQueryStats(result.stats);
    } catch (error) {
      toast.error('Query failed. Check your query syntax and backend connection.');
      setLogs([]);
      setQueryStats(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const handleRefresh = useCallback(() => {
    // Re-run last query if connected
    if (isConnected) {
      handleQuery('{service="api-gateway"}', '1h');
    }
  }, [isConnected, handleQuery]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header 
        health={health}
        isConnected={isConnected}
        onSettingsClick={() => setShowSettings(true)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col overflow-hidden">
          <QueryBar
            onQuery={handleQuery}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            isConnected={isConnected}
          />
          
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-2 border-b border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-mono">
                {isConnected ? `Showing ${logs.length} logs` : 'Not connected'}
              </span>
              {isConnected && health && (
                <span className="text-xs text-muted-foreground font-mono">
                  Backend: {health.status}
                </span>
              )}
            </div>
            
            <LogViewer 
              logs={logs} 
              isLoading={isLoading}
              isConnected={isConnected}
              queryStats={queryStats}
            />
          </div>
        </main>

        <TestPanel isConnected={isConnected} />
      </div>

      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onSave={handleSaveConfig}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
};

export default Index;
