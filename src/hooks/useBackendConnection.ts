import { useState, useEffect, useCallback, useRef } from 'react';
import { BackendConfig, BackendHealth } from '@/types/logs';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

interface UseBackendConnectionReturn {
  status: ConnectionStatus;
  health: BackendHealth | null;
  config: BackendConfig | null;
  error: string | null;
  connect: (config: BackendConfig) => Promise<boolean>;
  disconnect: () => void;
  reconnect: () => Promise<boolean>;
  isConnected: boolean;
}

const HEALTH_CHECK_INTERVAL = 10000; // 10 seconds
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 2000;

export function useBackendConnection(): UseBackendConnectionReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const reconnectAttemptsRef = useRef(0);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved config on mount
  useEffect(() => {
    const savedConfig = apiClient.getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      // Auto-connect if config exists
      connectToBackend(savedConfig, true);
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const startHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    healthCheckIntervalRef.current = setInterval(async () => {
      try {
        const healthData = await apiClient.health();
        setHealth(healthData);
        setStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      } catch (err) {
        console.error('[Backend] Health check failed:', err);
        handleConnectionLoss();
      }
    }, HEALTH_CHECK_INTERVAL);
  }, []);

  const handleConnectionLoss = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setStatus('error');
      setError('Connection lost. Max reconnection attempts reached.');
      toast.error('Lost connection to backend. Please check your server.');
      return;
    }

    setStatus('reconnecting');
    reconnectAttemptsRef.current++;
    
    const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1);
    console.log(`[Backend] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(async () => {
      if (config) {
        const success = await connectToBackend(config, false);
        if (!success) {
          handleConnectionLoss();
        }
      }
    }, delay);
  }, [config]);

  const connectToBackend = async (cfg: BackendConfig, showToast: boolean = true): Promise<boolean> => {
    setStatus('connecting');
    setError(null);

    try {
      apiClient.setConfig(cfg);
      
      console.log('[Backend] Connecting to:', cfg.apiUrl);
      const healthData = await apiClient.health();
      
      setHealth(healthData);
      setConfig(cfg);
      setStatus('connected');
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      startHealthCheck();
      
      if (showToast) {
        toast.success('Connected to backend', {
          description: `Status: ${healthData.status} | Uptime: ${Math.floor(healthData.uptime / 60)}m`,
        });
      }
      
      console.log('[Backend] Connected successfully:', healthData);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      console.error('[Backend] Connection failed:', errorMessage);
      
      setStatus('error');
      setError(errorMessage);
      setHealth(null);
      
      if (showToast) {
        toast.error('Failed to connect to backend', {
          description: errorMessage,
        });
      }
      
      return false;
    }
  };

  const connect = useCallback(async (cfg: BackendConfig): Promise<boolean> => {
    return connectToBackend(cfg, true);
  }, [startHealthCheck]);

  const disconnect = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    apiClient.clearConfig();
    setStatus('disconnected');
    setHealth(null);
    setConfig(null);
    setError(null);
    reconnectAttemptsRef.current = 0;
    
    toast.info('Disconnected from backend');
    console.log('[Backend] Disconnected');
  }, []);

  const reconnect = useCallback(async (): Promise<boolean> => {
    if (!config) {
      setError('No configuration available');
      return false;
    }
    
    reconnectAttemptsRef.current = 0;
    return connectToBackend(config, true);
  }, [config]);

  return {
    status,
    health,
    config,
    error,
    connect,
    disconnect,
    reconnect,
    isConnected: status === 'connected',
  };
}
