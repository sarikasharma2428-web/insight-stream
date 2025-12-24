import { useState, useEffect, useCallback } from 'react';
import { Activity, Database, Cpu, HardDrive, Clock, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricsDashboardProps {
  isConnected: boolean;
}

interface ParsedMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  help?: string;
  type?: string;
}

interface MetricsHistory {
  timestamp: number;
  ingestedBytes: number;
  ingestedLines: number;
  chunksStored: number;
  queryDuration: number;
}

export function MetricsDashboard({ isConnected }: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<ParsedMetric[]>([]);
  const [history, setHistory] = useState<MetricsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const parsePrometheusMetrics = (text: string): ParsedMetric[] => {
    const lines = text.split('\n');
    const parsed: ParsedMetric[] = [];
    let currentHelp = '';
    let currentType = '';

    for (const line of lines) {
      if (line.startsWith('# HELP ')) {
        currentHelp = line.substring(7);
      } else if (line.startsWith('# TYPE ')) {
        currentType = line.substring(7).split(' ')[1] || '';
      } else if (line && !line.startsWith('#')) {
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?([^}]*)\}?\s+(.+)$/);
        if (match) {
          const [, name, labelsStr, valueStr] = match;
          const value = parseFloat(valueStr);
          const labels: Record<string, string> = {};
          
          if (labelsStr) {
            const labelMatches = labelsStr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g);
            for (const lm of labelMatches) {
              labels[lm[1]] = lm[2];
            }
          }

          parsed.push({
            name,
            value,
            labels,
            help: currentHelp,
            type: currentType,
          });
        }
      }
    }

    return parsed;
  };

  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      const text = await apiClient.getMetrics();
      const parsed = parsePrometheusMetrics(text);
      setMetrics(parsed);
      setLastUpdate(new Date());

      // Add to history
      const ingestedBytes = parsed.find(m => m.name === 'lokiclone_ingested_bytes_total')?.value || 0;
      const ingestedLines = parsed.find(m => m.name === 'lokiclone_ingested_lines_total')?.value || 0;
      const chunksStored = parsed.find(m => m.name === 'lokiclone_chunks_stored_total')?.value || 0;
      const queryDuration = parsed.find(m => m.name === 'lokiclone_query_duration_seconds')?.value || 0;

      setHistory((prev) => {
        const newEntry = {
          timestamp: Date.now(),
          ingestedBytes,
          ingestedLines,
          chunksStored,
          queryDuration: queryDuration * 1000, // Convert to ms
        };
        const updated = [...prev, newEntry].slice(-30); // Keep last 30 data points
        return updated;
      });
    } catch (error) {
      toast.error('Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchMetrics]);

  const getMetricValue = (name: string): number => {
    return metrics.find((m) => m.name === name)?.value || 0;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(0);
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Connect to backend to view metrics</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto scrollbar-thin">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Metrics Dashboard
          </h3>
          {lastUpdate && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchMetrics}
          disabled={isLoading}
          className="p-1.5 rounded hover:bg-muted transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Key metrics cards */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Ingested Bytes"
            value={formatBytes(getMetricValue('lokiclone_ingested_bytes_total'))}
            color="primary"
          />
          <MetricCard
            icon={<Activity className="h-4 w-4" />}
            label="Ingested Lines"
            value={formatNumber(getMetricValue('lokiclone_ingested_lines_total'))}
            color="success"
          />
          <MetricCard
            icon={<Database className="h-4 w-4" />}
            label="Chunks Stored"
            value={formatNumber(getMetricValue('lokiclone_chunks_stored_total'))}
            color="info"
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Avg Query Time"
            value={`${(getMetricValue('lokiclone_query_duration_seconds') * 1000).toFixed(1)}ms`}
            color="warning"
          />
        </div>

        {/* Ingestion chart */}
        {history.length > 1 && (
          <div className="glass-panel rounded-lg p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Ingested Lines (Live)</h4>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="ingestGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="timestamp" 
                    hide 
                  />
                  <YAxis 
                    hide
                    domain={['dataMin', 'dataMax']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [formatNumber(value), 'Lines']}
                    labelFormatter={() => ''}
                  />
                  <Area
                    type="monotone"
                    dataKey="ingestedLines"
                    stroke="hsl(var(--primary))"
                    fill="url(#ingestGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Query duration chart */}
        {history.length > 1 && (
          <div className="glass-panel rounded-lg p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Query Duration (ms)</h4>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis hide domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}ms`, 'Duration']}
                    labelFormatter={() => ''}
                  />
                  <Line
                    type="monotone"
                    dataKey="queryDuration"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Raw metrics list */}
        <div className="glass-panel rounded-lg overflow-hidden">
          <div className="p-3 border-b border-border">
            <h4 className="text-xs font-medium text-muted-foreground">All Metrics ({metrics.length})</h4>
          </div>
          <div className="max-h-[200px] overflow-auto scrollbar-thin divide-y divide-border/50">
            {metrics.map((metric, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between hover:bg-muted/50">
                <span className="font-mono text-xs text-foreground truncate flex-1 mr-2">
                  {metric.name}
                </span>
                <span className="font-mono text-xs text-primary font-semibold">
                  {typeof metric.value === 'number' && metric.value % 1 !== 0
                    ? metric.value.toFixed(4)
                    : metric.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'primary' | 'success' | 'warning' | 'info';
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <div className="glass-panel rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={colorClasses[color]}>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-mono font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}
