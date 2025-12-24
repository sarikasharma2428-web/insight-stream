import { Activity, Database, Cpu, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Header() {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="glass-panel border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Database className="h-8 w-8 text-primary" />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-success pulse-dot" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                LOKI<span className="text-primary">CLONE</span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono">Log Aggregation System v1.0</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <StatusIndicator 
            icon={<Activity className="h-4 w-4" />}
            label="Ingestion"
            value="1.2K/s"
            status="success"
          />
          <StatusIndicator 
            icon={<Cpu className="h-4 w-4" />}
            label="CPU"
            value="23%"
            status="success"
          />
          <StatusIndicator 
            icon={<Database className="h-4 w-4" />}
            label="Storage"
            value="45.2 GB"
            status="warning"
          />
          
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm border-l border-border pl-6">
            <Clock className="h-4 w-4" />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

interface StatusIndicatorProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'success' | 'warning' | 'error';
}

function StatusIndicator({ icon, label, value, status }: StatusIndicatorProps) {
  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-destructive',
  };

  return (
    <div className="flex items-center gap-2">
      <span className={statusColors[status]}>{icon}</span>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-mono font-semibold ${statusColors[status]}`}>{value}</p>
      </div>
    </div>
  );
}
