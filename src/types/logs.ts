export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogLabel {
  key: string;
  value: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  labels: LogLabel[];
  raw?: string;
}

export interface LogQuery {
  labels: Record<string, string>;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface ServiceStats {
  name: string;
  totalLogs: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  logsPerMinute: number;
}

export interface TimeRange {
  label: string;
  value: string;
  duration: number; // in minutes
}
