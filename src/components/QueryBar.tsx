import { Search, Play, Clock, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { timeRanges } from '@/data/mockLogs';

interface QueryBarProps {
  onQuery: (query: string) => void;
  onTimeRangeChange: (range: string) => void;
  onRefresh: () => void;
  isLive: boolean;
  onToggleLive: () => void;
}

export function QueryBar({ onQuery, onTimeRangeChange, onRefresh, isLive, onToggleLive }: QueryBarProps) {
  const [query, setQuery] = useState('{service="api-gateway"}');
  const [selectedRange, setSelectedRange] = useState('1h');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuery(query);
  };

  const handleRangeChange = (value: string) => {
    setSelectedRange(value);
    onTimeRangeChange(value);
  };

  return (
    <div className="glass-panel border-b border-border px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='{service="api-gateway", env="prod"}'
            className="query-input w-full pl-12 pr-4"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {timeRanges.slice(0, 4).map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => handleRangeChange(range.value)}
                className={`px-3 py-1.5 text-sm font-mono rounded transition-all ${
                  selectedRange === range.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range.value}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleLive}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all ${
              isLive
                ? 'bg-success/20 text-success border border-success/30 glow-success'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${isLive ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            LIVE
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground border border-border transition-all hover:border-primary/50"
          >
            <RefreshCw className="h-5 w-5" />
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:opacity-90 glow-primary"
          >
            <Play className="h-4 w-4" />
            Run Query
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 mt-3 text-xs">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Query syntax:</span>
        <code className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
          {'{'}label="value", label2="value2"{'}'}
        </code>
        <span className="text-muted-foreground">|</span>
        <span className="text-muted-foreground">Supported labels:</span>
        <span className="label-badge">service</span>
        <span className="label-badge">env</span>
        <span className="label-badge">level</span>
        <span className="label-badge">host</span>
        <span className="label-badge">region</span>
      </div>
    </div>
  );
}
