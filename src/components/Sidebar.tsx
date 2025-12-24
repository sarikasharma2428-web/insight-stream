import { ServiceStats } from '@/types/logs';
import { 
  Database, 
  Server, 
  Shield, 
  CreditCard, 
  Bell, 
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  Bug
} from 'lucide-react';

interface SidebarProps {
  stats: ServiceStats[];
  selectedService: string | null;
  onServiceSelect: (service: string | null) => void;
}

const serviceIcons: Record<string, React.ReactNode> = {
  'api-gateway': <Server className="h-4 w-4" />,
  'auth-service': <Shield className="h-4 w-4" />,
  'user-service': <Database className="h-4 w-4" />,
  'payment-service': <CreditCard className="h-4 w-4" />,
  'notification-service': <Bell className="h-4 w-4" />,
};

export function Sidebar({ stats, selectedService, onServiceSelect }: SidebarProps) {
  const totalLogs = stats.reduce((acc, s) => acc + s.totalLogs, 0);
  const totalErrors = stats.reduce((acc, s) => acc + s.errorCount, 0);
  const totalWarns = stats.reduce((acc, s) => acc + s.warnCount, 0);
  const avgLogsPerMinute = Math.round(stats.reduce((acc, s) => acc + s.logsPerMinute, 0) / stats.length);

  return (
    <aside className="w-72 glass-panel border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Overview
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Activity className="h-4 w-4 text-primary" />}
            label="Total Logs"
            value={formatNumber(totalLogs)}
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4 text-destructive" />}
            label="Errors"
            value={formatNumber(totalErrors)}
            variant="error"
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            label="Warnings"
            value={formatNumber(totalWarns)}
            variant="warning"
          />
          <StatCard
            icon={<Activity className="h-4 w-4 text-success" />}
            label="Logs/min"
            value={formatNumber(avgLogsPerMinute)}
            variant="success"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Services
        </h2>

        <div className="space-y-2">
          <button
            onClick={() => onServiceSelect(null)}
            className={`w-full text-left p-3 rounded-lg transition-all ${
              selectedService === null
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-muted border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-primary" />
              <span className="font-medium">All Services</span>
            </div>
          </button>

          {stats.map((service) => (
            <ServiceCard
              key={service.name}
              service={service}
              icon={serviceIcons[service.name]}
              isSelected={selectedService === service.name}
              onSelect={() => onServiceSelect(service.name)}
            />
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span>Connected to ingestion server</span>
        </div>
      </div>
    </aside>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}

function StatCard({ icon, label, value, variant = 'default' }: StatCardProps) {
  const variantStyles = {
    default: '',
    success: 'border-success/20',
    warning: 'border-warning/20',
    error: 'border-destructive/20',
  };

  return (
    <div className={`stat-card ${variantStyles[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-mono font-bold">{value}</p>
    </div>
  );
}

interface ServiceCardProps {
  service: ServiceStats;
  icon: React.ReactNode;
  isSelected: boolean;
  onSelect: () => void;
}

function ServiceCard({ service, icon, isSelected, onSelect }: ServiceCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg transition-all ${
        isSelected
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-muted border border-transparent'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-primary">{icon}</span>
          <span className="font-medium text-sm">{service.name}</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {service.logsPerMinute}/min
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <LogLevelIndicator level="error" count={service.errorCount} />
        <LogLevelIndicator level="warn" count={service.warnCount} />
        <LogLevelIndicator level="info" count={service.infoCount} />
        <LogLevelIndicator level="debug" count={service.debugCount} />
      </div>
    </button>
  );
}

interface LogLevelIndicatorProps {
  level: 'error' | 'warn' | 'info' | 'debug';
  count: number;
}

function LogLevelIndicator({ level, count }: LogLevelIndicatorProps) {
  const colors = {
    error: 'text-destructive',
    warn: 'text-warning',
    info: 'text-info',
    debug: 'text-muted-foreground',
  };

  const icons = {
    error: <AlertCircle className="h-3 w-3" />,
    warn: <AlertTriangle className="h-3 w-3" />,
    info: <Info className="h-3 w-3" />,
    debug: <Bug className="h-3 w-3" />,
  };

  return (
    <div className={`flex items-center gap-1 ${colors[level]}`}>
      {icons[level]}
      <span className="font-mono">{formatNumber(count)}</span>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
