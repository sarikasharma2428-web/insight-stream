import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { QueryBar } from '@/components/QueryBar';
import { LogViewer } from '@/components/LogViewer';
import { Sidebar } from '@/components/Sidebar';
import { LogStats } from '@/components/LogStats';
import { generateMockLogs, generateServiceStats, generateMockLog } from '@/data/mockLogs';
import { LogEntry, ServiceStats } from '@/types/logs';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<ServiceStats[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      setLogs(generateMockLogs(100));
      setStats(generateServiceStats());
      setIsLoading(false);
    }, 800);
  }, []);

  // Live mode - add new logs periodically
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      const newLog = generateMockLog(new Date());
      setLogs((prev) => [newLog, ...prev.slice(0, 199)]);
    }, Math.random() * 2000 + 500);

    return () => clearInterval(interval);
  }, [isLive]);

  const handleQuery = useCallback((query: string) => {
    setIsLoading(true);
    // Simulate query execution
    setTimeout(() => {
      setLogs(generateMockLogs(Math.floor(Math.random() * 50) + 50));
      setIsLoading(false);
    }, 500);
  }, []);

  const handleTimeRangeChange = useCallback((range: string) => {
    setIsLoading(true);
    setTimeout(() => {
      const count = range === '5m' ? 30 : range === '15m' ? 60 : range === '1h' ? 100 : 200;
      setLogs(generateMockLogs(count));
      setIsLoading(false);
    }, 300);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setTimeout(() => {
      setLogs(generateMockLogs(100));
      setStats(generateServiceStats());
      setIsLoading(false);
    }, 500);
  }, []);

  // Filter logs by selected service
  const filteredLogs = selectedService
    ? logs.filter((log) => log.service === selectedService)
    : logs;

  return (
    <>
      <Helmet>
        <title>LokiClone - Log Aggregation Dashboard</title>
        <meta name="description" content="A powerful, lightweight log aggregation system for collecting, storing, and querying application logs with label-based indexing." />
      </Helmet>
      
      <div className="h-screen flex flex-col bg-background overflow-hidden">
        <Header />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            stats={stats}
            selectedService={selectedService}
            onServiceSelect={setSelectedService}
          />
          
          <main className="flex-1 flex flex-col overflow-hidden">
            <QueryBar
              onQuery={handleQuery}
              onTimeRangeChange={handleTimeRangeChange}
              onRefresh={handleRefresh}
              isLive={isLive}
              onToggleLive={() => setIsLive(!isLive)}
            />
            
            <LogStats logs={filteredLogs} />
            
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 py-2 border-b border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-mono">
                  Showing {filteredLogs.length} logs
                  {selectedService && (
                    <span className="text-primary"> • {selectedService}</span>
                  )}
                </span>
                {isLive && (
                  <span className="flex items-center gap-2 text-sm text-success font-mono">
                    <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    Streaming live logs...
                  </span>
                )}
              </div>
              
              <LogViewer logs={filteredLogs} isLoading={isLoading} />
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default Index;
