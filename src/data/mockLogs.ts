import { LogEntry, LogLevel, ServiceStats } from '@/types/logs';

const services = ['api-gateway', 'auth-service', 'user-service', 'payment-service', 'notification-service'];
const environments = ['prod', 'staging', 'dev'];

const logMessages: Record<LogLevel, string[]> = {
  error: [
    'Connection timeout to database after 30s',
    'Failed to process payment: Invalid card number',
    'Authentication failed: Token expired',
    'Service unavailable: upstream connection refused',
    'Memory limit exceeded: OOMKilled',
    'Unhandled exception in request handler',
    'Failed to send notification: SMTP connection failed',
  ],
  warn: [
    'High memory usage detected: 85% utilized',
    'Slow query detected: 2.5s execution time',
    'Rate limit approaching: 950/1000 requests',
    'Certificate expires in 7 days',
    'Deprecated API endpoint called: /v1/users',
    'Connection pool running low: 3 available',
  ],
  info: [
    'Request processed successfully in 45ms',
    'User logged in: user_id=12345',
    'Payment completed: amount=$99.99',
    'Service started on port 8080',
    'Cache refreshed: 1250 entries',
    'Health check passed',
    'New deployment detected: version=2.4.1',
    'Scheduled job completed: cleanup_logs',
  ],
  debug: [
    'Parsing request body: content-type=application/json',
    'Cache hit for key: user:12345:profile',
    'SQL query: SELECT * FROM users WHERE id = ?',
    'HTTP response: status=200, duration=12ms',
    'Middleware executed: auth_check',
    'Feature flag evaluated: new_dashboard=true',
  ],
};

function generateLogId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomLevel(): LogLevel {
  const weights = { error: 5, warn: 15, info: 60, debug: 20 };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * total;
  
  for (const [level, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return level as LogLevel;
  }
  return 'info';
}

export function generateMockLog(baseTime?: Date): LogEntry {
  const level = getRandomLevel();
  const service = getRandomItem(services);
  const environment = getRandomItem(environments);
  const timestamp = baseTime || new Date(Date.now() - Math.random() * 3600000);
  
  return {
    id: generateLogId(),
    timestamp,
    level,
    message: getRandomItem(logMessages[level]),
    service,
    environment,
    labels: [
      { key: 'service', value: service },
      { key: 'env', value: environment },
      { key: 'level', value: level },
      { key: 'host', value: `${service}-${Math.floor(Math.random() * 3) + 1}` },
      { key: 'region', value: getRandomItem(['us-east-1', 'us-west-2', 'eu-west-1']) },
    ],
  };
}

export function generateMockLogs(count: number, startTime?: Date): LogEntry[] {
  const logs: LogEntry[] = [];
  const baseTime = startTime || new Date();
  
  for (let i = 0; i < count; i++) {
    const logTime = new Date(baseTime.getTime() - i * (Math.random() * 5000 + 1000));
    logs.push(generateMockLog(logTime));
  }
  
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function generateServiceStats(): ServiceStats[] {
  return services.map((name) => ({
    name,
    totalLogs: Math.floor(Math.random() * 50000) + 10000,
    errorCount: Math.floor(Math.random() * 500) + 50,
    warnCount: Math.floor(Math.random() * 2000) + 200,
    infoCount: Math.floor(Math.random() * 30000) + 5000,
    debugCount: Math.floor(Math.random() * 15000) + 2000,
    logsPerMinute: Math.floor(Math.random() * 500) + 100,
  }));
}

export const timeRanges = [
  { label: 'Last 5 minutes', value: '5m', duration: 5 },
  { label: 'Last 15 minutes', value: '15m', duration: 15 },
  { label: 'Last 1 hour', value: '1h', duration: 60 },
  { label: 'Last 6 hours', value: '6h', duration: 360 },
  { label: 'Last 24 hours', value: '24h', duration: 1440 },
  { label: 'Last 7 days', value: '7d', duration: 10080 },
];
