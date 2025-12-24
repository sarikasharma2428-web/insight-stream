import { Wifi, WifiOff, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { ConnectionStatus as ConnectionStatusType } from '@/hooks/useBackendConnection';
import { BackendHealth } from '@/types/logs';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  health: BackendHealth | null;
  error: string | null;
  onReconnect: () => void;
  onSettingsClick: () => void;
}

export function ConnectionStatus({ status, health, error, onReconnect, onSettingsClick }: ConnectionStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return health?.status === 'healthy' ? 'text-success' : health?.status === 'degraded' ? 'text-warning' : 'text-destructive';
      case 'connecting':
      case 'reconnecting':
        return 'text-info';
      case 'error':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi className={`h-4 w-4 ${getStatusColor()}`} />;
      case 'connecting':
      case 'reconnecting':
        return <Loader2 className={`h-4 w-4 ${getStatusColor()} animate-spin`} />;
      case 'error':
        return <AlertTriangle className={`h-4 w-4 ${getStatusColor()}`} />;
      default:
        return <WifiOff className={`h-4 w-4 ${getStatusColor()}`} />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return health?.status === 'healthy' ? 'Connected' : health?.status === 'degraded' ? 'Degraded' : 'Unhealthy';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Not Connected';
    }
  };

  const formatUptime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onSettingsClick}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
                status === 'connected'
                  ? 'bg-success/10 hover:bg-success/20'
                  : status === 'error'
                  ? 'bg-destructive/10 hover:bg-destructive/20'
                  : status === 'connecting' || status === 'reconnecting'
                  ? 'bg-info/10 hover:bg-info/20'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              
              {status === 'connected' && health && (
                <span className="text-xs text-muted-foreground font-mono ml-1">
                  {formatUptime(health.uptime)}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {status === 'connected' && health ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium">Backend Status: {health.status}</p>
                <p>Ingestion Rate: {health.ingestionRate}/s</p>
                <p>Storage Used: {(health.storageUsed / 1024 / 1024).toFixed(2)} MB</p>
                <p>Chunks: {health.chunksCount}</p>
                <p>Uptime: {formatUptime(health.uptime)}</p>
              </div>
            ) : status === 'error' ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium text-destructive">Connection Failed</p>
                <p>{error || 'Unable to connect to backend'}</p>
                <p className="text-muted-foreground">Click to configure settings</p>
              </div>
            ) : status === 'disconnected' ? (
              <div className="space-y-1 text-xs">
                <p className="font-medium">Backend not configured</p>
                <p>Click to connect to your Go backend</p>
              </div>
            ) : (
              <div className="space-y-1 text-xs">
                <p className="font-medium">Establishing connection...</p>
              </div>
            )}
          </TooltipContent>
        </Tooltip>

        {status === 'error' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReconnect}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retry connection</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
