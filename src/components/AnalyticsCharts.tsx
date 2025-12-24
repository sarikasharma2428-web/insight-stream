import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, BarChart, Bar, LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, ReferenceArea } from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Server, Zap, ShieldAlert, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AnalyticsChartsProps {
  isConnected: boolean;
}

interface TimeSeriesData {
  time: string;
  errors: number;
  warns: number;
  info: number;
  debug: number;
  total: number;
  isAnomaly?: boolean;
  anomalyType?: 'spike' | 'drop' | 'error_surge';
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  errorRate: number;
  avgLatency: number;
  requestCount: number;
}

interface Anomaly {
  id: string;
  time: string;
  type: 'volume_spike' | 'volume_drop' | 'error_surge' | 'latency_spike';
  severity: 'low' | 'medium' | 'high';
  message: string;
  value: number;
  expected: number;
  deviation: number;
}

// Statistical functions for anomaly detection
const calculateStats = (values: number[]) => {
  const n = values.length;
  if (n === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  return { mean, stdDev: Math.sqrt(variance) };
};

const detectAnomalies = (data: TimeSeriesData[]): { anomalies: Anomaly[]; annotatedData: TimeSeriesData[] } => {
  if (data.length < 3) return { anomalies: [], annotatedData: data };
  
  const totalValues = data.map(d => d.total);
  const errorValues = data.map(d => d.errors);
  
  const totalStats = calculateStats(totalValues);
  const errorStats = calculateStats(errorValues);
  
  const anomalies: Anomaly[] = [];
  const annotatedData = data.map((point, index) => {
    const newPoint = { ...point };
    
    // Detect volume spikes (> 2 standard deviations)
    const totalDeviation = (point.total - totalStats.mean) / (totalStats.stdDev || 1);
    if (Math.abs(totalDeviation) > 2) {
      newPoint.isAnomaly = true;
      newPoint.anomalyType = totalDeviation > 0 ? 'spike' : 'drop';
      anomalies.push({
        id: `vol-${index}`,
        time: point.time,
        type: totalDeviation > 0 ? 'volume_spike' : 'volume_drop',
        severity: Math.abs(totalDeviation) > 3 ? 'high' : Math.abs(totalDeviation) > 2.5 ? 'medium' : 'low',
        message: totalDeviation > 0 
          ? `Volume spike: ${point.total} logs (${(totalDeviation * 100).toFixed(0)}% above normal)`
          : `Volume drop: ${point.total} logs (${(Math.abs(totalDeviation) * 100).toFixed(0)}% below normal)`,
        value: point.total,
        expected: totalStats.mean,
        deviation: totalDeviation,
      });
    }
    
    // Detect error surges (> 1.5 standard deviations for errors)
    const errorDeviation = (point.errors - errorStats.mean) / (errorStats.stdDev || 1);
    if (errorDeviation > 1.5 && point.errors > 5) {
      newPoint.isAnomaly = true;
      newPoint.anomalyType = 'error_surge';
      anomalies.push({
        id: `err-${index}`,
        time: point.time,
        type: 'error_surge',
        severity: errorDeviation > 3 ? 'high' : errorDeviation > 2 ? 'medium' : 'low',
        message: `Error surge: ${point.errors} errors (${(errorDeviation * 100).toFixed(0)}% above baseline)`,
        value: point.errors,
        expected: errorStats.mean,
        deviation: errorDeviation,
      });
    }
    
    return newPoint;
  });
  
  return { anomalies, annotatedData };
};

export function AnalyticsCharts({ isConnected }: AnalyticsChartsProps) {
  const [volumeData, setVolumeData] = useState<TimeSeriesData[]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  
  const timeRanges = ['15m', '1h', '6h', '24h'];

  // Detect anomalies in the data
  const { anomalies, annotatedData } = useMemo(() => {
    return detectAnomalies(volumeData);
  }, [volumeData]);

  useEffect(() => {
    if (isConnected) {
      fetchAnalytics();
    }
  }, [isConnected, selectedTimeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      generateMockData();
    } catch {
      generateMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = () => {
    const now = new Date();
    const points = selectedTimeRange === '15m' ? 15 : selectedTimeRange === '1h' ? 12 : selectedTimeRange === '6h' ? 24 : 48;
    const intervalMs = selectedTimeRange === '15m' ? 60000 : selectedTimeRange === '1h' ? 300000 : selectedTimeRange === '6h' ? 900000 : 1800000;

    const data: TimeSeriesData[] = [];
    for (let i = points; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMs);
      let baseVolume = Math.floor(Math.random() * 300 + 300);
      let errorCount = Math.floor(Math.random() * 15);
      
      // Inject some anomalies for demo
      if (i === Math.floor(points * 0.3)) {
        baseVolume = baseVolume * 3; // Volume spike
      }
      if (i === Math.floor(points * 0.6)) {
        errorCount = errorCount * 5; // Error surge
      }
      if (i === Math.floor(points * 0.8)) {
        baseVolume = Math.floor(baseVolume * 0.3); // Volume drop
      }
      
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        errors: errorCount,
        warns: Math.floor(Math.random() * 30 + 10),
        info: Math.floor(baseVolume * 0.6 + Math.random() * 50),
        debug: Math.floor(baseVolume * 0.2 + Math.random() * 30),
        total: baseVolume,
      });
    }
    setVolumeData(data);

    const services = ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'notification-service'];
    const healthData: ServiceHealth[] = services.map(name => ({
      name,
      status: Math.random() > 0.8 ? 'degraded' : Math.random() > 0.95 ? 'unhealthy' : 'healthy',
      errorRate: Math.random() * 5,
      avgLatency: Math.floor(Math.random() * 200 + 20),
      requestCount: Math.floor(Math.random() * 10000 + 1000),
    }));
    setServiceHealth(healthData);
  };

  const totalErrors = volumeData.reduce((sum, d) => sum + d.errors, 0);
  const totalLogs = volumeData.reduce((sum, d) => sum + d.total, 0);
  const errorRate = totalLogs > 0 ? ((totalErrors / totalLogs) * 100).toFixed(2) : '0';
  const avgVolume = volumeData.length > 0 ? Math.floor(totalLogs / volumeData.length) : 0;

  const levelDistribution = [
    { name: 'Error', value: volumeData.reduce((sum, d) => sum + d.errors, 0), color: 'hsl(var(--destructive))' },
    { name: 'Warn', value: volumeData.reduce((sum, d) => sum + d.warns, 0), color: 'hsl(var(--warning))' },
    { name: 'Info', value: volumeData.reduce((sum, d) => sum + d.info, 0), color: 'hsl(var(--info))' },
    { name: 'Debug', value: volumeData.reduce((sum, d) => sum + d.debug, 0), color: 'hsl(var(--muted-foreground))' },
  ];

  const chartConfig = {
    errors: { label: 'Errors', color: 'hsl(var(--destructive))' },
    warns: { label: 'Warnings', color: 'hsl(var(--warning))' },
    info: { label: 'Info', color: 'hsl(var(--info))' },
    debug: { label: 'Debug', color: 'hsl(var(--muted-foreground))' },
    total: { label: 'Total', color: 'hsl(var(--primary))' },
  };

  const highSeverityAnomalies = anomalies.filter(a => a.severity === 'high');
  const mediumSeverityAnomalies = anomalies.filter(a => a.severity === 'medium');

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Connect to backend to view analytics
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Log Analytics</h2>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-mono rounded transition-all ${
                selectedTimeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="glass-panel">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold font-mono">{totalLogs.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold font-mono text-destructive">{errorRate}%</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Volume/min</p>
                <p className="text-2xl font-bold font-mono">{avgVolume}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Services</p>
                <p className="text-2xl font-bold font-mono">{serviceHealth.length}</p>
              </div>
              <Server className="h-8 w-8 text-info opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomaly Detection Panel */}
      {anomalies.length > 0 && (
        <Card className="glass-panel border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" />
                <CardTitle className="text-sm font-medium">Anomaly Detection</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {highSeverityAnomalies.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {highSeverityAnomalies.length} High
                  </Badge>
                )}
                {mediumSeverityAnomalies.length > 0 && (
                  <Badge className="bg-warning text-warning-foreground text-xs">
                    {mediumSeverityAnomalies.length} Medium
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {anomalies.length} Total
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 max-h-[150px] overflow-auto scrollbar-thin">
              {anomalies.map((anomaly) => (
                <div
                  key={anomaly.id}
                  className={`flex items-center justify-between p-2 rounded-lg border ${
                    anomaly.severity === 'high'
                      ? 'border-destructive/30 bg-destructive/10'
                      : anomaly.severity === 'medium'
                      ? 'border-warning/30 bg-warning/10'
                      : 'border-border bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded ${
                      anomaly.type === 'volume_spike' ? 'bg-info/20 text-info' :
                      anomaly.type === 'volume_drop' ? 'bg-muted text-muted-foreground' :
                      anomaly.type === 'error_surge' ? 'bg-destructive/20 text-destructive' :
                      'bg-warning/20 text-warning'
                    }`}>
                      {anomaly.type === 'volume_spike' ? <TrendingUp className="h-4 w-4" /> :
                       anomaly.type === 'volume_drop' ? <TrendingDown className="h-4 w-4" /> :
                       anomaly.type === 'error_surge' ? <AlertTriangle className="h-4 w-4" /> :
                       <Zap className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{anomaly.message}</p>
                      <p className="text-xs text-muted-foreground">
                        Detected at {anomaly.time} • Expected: ~{Math.round(anomaly.expected)}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'default' : 'secondary'}
                    className={anomaly.severity === 'medium' ? 'bg-warning text-warning-foreground' : ''}
                  >
                    {anomaly.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Log Volume Trend with Anomaly Markers */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Log Volume Over Time</CardTitle>
              {annotatedData.some(d => d.isAnomaly) && (
                <Badge variant="outline" className="text-xs border-warning text-warning">
                  <Zap className="h-3 w-3 mr-1" />
                  Anomalies detected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <AreaChart data={annotatedData}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as TimeSeriesData;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
                        <p className="text-xs text-muted-foreground">{data.time}</p>
                        <p className="text-sm font-mono">{data.total} logs</p>
                        {data.isAnomaly && (
                          <p className="text-xs text-warning font-medium mt-1">
                            ⚠️ Anomaly: {data.anomalyType?.replace('_', ' ')}
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#totalGradient)" strokeWidth={2} />
                {/* Highlight anomaly points */}
                {annotatedData.map((point, index) => 
                  point.isAnomaly && (
                    <ReferenceLine 
                      key={index}
                      x={point.time} 
                      stroke="hsl(var(--warning))" 
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                  )
                )}
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Error Rate Trend with Anomalies */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Error & Warning Trends</CardTitle>
              {anomalies.some(a => a.type === 'error_surge') && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Error surge
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <LineChart data={annotatedData}>
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as TimeSeriesData;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
                        <p className="text-xs text-muted-foreground">{data.time}</p>
                        <p className="text-sm font-mono text-destructive">{data.errors} errors</p>
                        <p className="text-sm font-mono text-warning">{data.warns} warnings</p>
                        {data.anomalyType === 'error_surge' && (
                          <p className="text-xs text-destructive font-medium mt-1">
                            🚨 Error surge detected
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={(props) => {
                  const data = annotatedData[props.index];
                  if (data?.anomalyType === 'error_surge') {
                    return (
                      <circle 
                        cx={props.cx} 
                        cy={props.cy} 
                        r={6} 
                        fill="hsl(var(--destructive))" 
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                        className="animate-pulse"
                      />
                    );
                  }
                  return <circle cx={props.cx} cy={props.cy} r={0} />;
                }} />
                <Line type="monotone" dataKey="warns" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-6">
        {/* Log Level Distribution */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Log Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {levelDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {levelDistribution.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                  <span className="font-mono">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Logs by Level */}
        <Card className="glass-panel col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Logs by Level Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <BarChart data={volumeData}>
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="errors" stackId="a" fill="hsl(var(--destructive))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="warns" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="info" stackId="a" fill="hsl(var(--info))" radius={[0, 0, 0, 0]} />
                <Bar dataKey="debug" stackId="a" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Service Health */}
      <Card className="glass-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            {serviceHealth.map((service) => (
              <div
                key={service.name}
                className={`p-4 rounded-lg border transition-all ${
                  service.status === 'healthy'
                    ? 'border-success/30 bg-success/5'
                    : service.status === 'degraded'
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-destructive/30 bg-destructive/5'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy'
                        ? 'bg-success'
                        : service.status === 'degraded'
                        ? 'bg-warning'
                        : 'bg-destructive'
                    }`}
                  />
                  <span className="text-sm font-medium truncate">{service.name}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Error Rate</span>
                    <span className="font-mono">{service.errorRate.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Latency</span>
                    <span className="font-mono">{service.avgLatency}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Requests</span>
                    <span className="font-mono">{service.requestCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
