import { LogEntry } from '@/types/logs';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

interface LogStatsProps {
  logs: LogEntry[];
}

export function LogStats({ logs }: LogStatsProps) {
  const timeSeriesData = useMemo(() => {
    const buckets: Record<string, { time: string; error: number; warn: number; info: number; debug: number }> = {};
    
    logs.forEach((log) => {
      const minute = new Date(log.timestamp);
      minute.setSeconds(0, 0);
      const key = minute.toISOString();
      
      if (!buckets[key]) {
        buckets[key] = {
          time: minute.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          error: 0,
          warn: 0,
          info: 0,
          debug: 0,
        };
      }
      
      buckets[key][log.level]++;
    });
    
    return Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
  }, [logs]);

  const levelDistribution = useMemo(() => {
    const counts = { error: 0, warn: 0, info: 0, debug: 0 };
    logs.forEach((log) => counts[log.level]++);
    
    return [
      { name: 'Error', value: counts.error, color: 'hsl(var(--destructive))' },
      { name: 'Warn', value: counts.warn, color: 'hsl(var(--warning))' },
      { name: 'Info', value: counts.info, color: 'hsl(var(--info))' },
      { name: 'Debug', value: counts.debug, color: 'hsl(var(--muted-foreground))' },
    ];
  }, [logs]);

  return (
    <div className="glass-panel border-b border-border p-4">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Log Volume Over Time
          </h3>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="warnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--warning))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--warning))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="infoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="info"
                  stackId="1"
                  stroke="hsl(var(--info))"
                  fill="url(#infoGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="warn"
                  stackId="1"
                  stroke="hsl(var(--warning))"
                  fill="url(#warnGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="error"
                  stackId="1"
                  stroke="hsl(var(--destructive))"
                  fill="url(#errorGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Level Distribution
          </h3>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={levelDistribution} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {levelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
