import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, BarChart, Bar, LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Activity, Server, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api';

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
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  errorRate: number;
  avgLatency: number;
  requestCount: number;
}

export function AnalyticsCharts({ isConnected }: AnalyticsChartsProps) {
  const [volumeData, setVolumeData] = useState<TimeSeriesData[]>([]);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h');
  
  const timeRanges = ['15m', '1h', '6h', '24h'];

  useEffect(() => {
    if (isConnected) {
      fetchAnalytics();
    }
  }, [isConnected, selectedTimeRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      // Generate mock analytics data
      generateMockData(null);
    } catch {
      // Generate mock data for demo
      generateMockData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockData = (metrics: Record<string, number> | null) => {
    const now = new Date();
    const points = selectedTimeRange === '15m' ? 15 : selectedTimeRange === '1h' ? 12 : selectedTimeRange === '6h' ? 24 : 48;
    const intervalMs = selectedTimeRange === '15m' ? 60000 : selectedTimeRange === '1h' ? 300000 : selectedTimeRange === '6h' ? 900000 : 1800000;

    const data: TimeSeriesData[] = [];
    for (let i = points; i >= 0; i--) {
      const time = new Date(now.getTime() - i * intervalMs);
      const baseVolume = metrics?.lokiclone_ingested_lines_total ? Math.floor(metrics.lokiclone_ingested_lines_total / points) : Math.floor(Math.random() * 500 + 200);
      
      data.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        errors: Math.floor(Math.random() * (baseVolume * 0.05)),
        warns: Math.floor(Math.random() * (baseVolume * 0.15)),
        info: Math.floor(baseVolume * 0.6 + Math.random() * 50),
        debug: Math.floor(baseVolume * 0.2 + Math.random() * 30),
        total: baseVolume + Math.floor(Math.random() * 100 - 50),
      });
    }
    setVolumeData(data);

    // Mock service health data
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

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6">
        {/* Log Volume Trend */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Log Volume Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <AreaChart data={volumeData}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#totalGradient)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Error Rate Trend */}
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error & Warning Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <LineChart data={volumeData}>
                <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="errors" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
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
