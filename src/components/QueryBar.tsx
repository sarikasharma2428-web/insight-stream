import { Search, Play, RefreshCw, Loader2, History, Star, ChevronDown, X, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { LogQLInput, validateQuery } from './LogQLInput';
import { useQueryHistory, QueryHistoryItem } from '@/hooks/useQueryHistory';
import { toast } from 'sonner';

const timeRanges = [
  { label: 'Last 5 minutes', value: '5m', duration: 5 },
  { label: 'Last 15 minutes', value: '15m', duration: 15 },
  { label: 'Last 1 hour', value: '1h', duration: 60 },
  { label: 'Last 6 hours', value: '6h', duration: 360 },
];

interface QueryBarProps {
  onQuery: (query: string, timeRange: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  isConnected: boolean;
}

// Favorites storage
const FAVORITES_KEY = 'logpulse-query-favorites';

interface FavoriteQuery {
  id: string;
  name: string;
  query: string;
  timeRange: string;
}

export function QueryBar({ onQuery, onRefresh, isLoading, isConnected }: QueryBarProps) {
  const [query, setQuery] = useState('{service="api-gateway"}');
  const [selectedRange, setSelectedRange] = useState('1h');
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteQuery[]>([]);
  const [favoriteName, setFavoriteName] = useState('');
  const [showAddFavorite, setShowAddFavorite] = useState(false);
  
  const historyRef = useRef<HTMLDivElement>(null);
  const favoritesRef = useRef<HTMLDivElement>(null);
  
  const { history, addToHistory, removeFromHistory, clearHistory, getRecentQueries } = useQueryHistory();

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(JSON.parse(saved));
      }
    } catch {
      setFavorites([]);
    }
  }, []);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
      if (favoritesRef.current && !favoritesRef.current.contains(e.target as Node)) {
        setShowFavorites(false);
        setShowAddFavorite(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateQuery(query);
    if (!validation.isValid) {
      toast.error(`Invalid query: ${validation.error}`);
      return;
    }
    
    if (isConnected) {
      addToHistory(query, selectedRange);
      onQuery(query, selectedRange);
    }
  };

  const handleSelectHistory = (item: QueryHistoryItem) => {
    setQuery(item.query);
    setSelectedRange(item.timeRange);
    setShowHistory(false);
  };

  const handleSelectFavorite = (fav: FavoriteQuery) => {
    setQuery(fav.query);
    setSelectedRange(fav.timeRange);
    setShowFavorites(false);
  };

  const saveFavorite = () => {
    if (!favoriteName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    
    const newFav: FavoriteQuery = {
      id: Date.now().toString(),
      name: favoriteName.trim(),
      query,
      timeRange: selectedRange,
    };
    
    const updated = [newFav, ...favorites];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    setFavorites(updated);
    setFavoriteName('');
    setShowAddFavorite(false);
    toast.success('Query saved to favorites');
  };

  const removeFavorite = (id: string) => {
    const updated = favorites.filter(f => f.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    setFavorites(updated);
    toast.success('Removed from favorites');
  };

  const recentQueries = getRecentQueries(10);

  return (
    <div className="glass-panel border-b border-border px-6 py-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        {/* History Button */}
        <div className="relative" ref={historyRef}>
          <button
            type="button"
            onClick={() => {
              setShowHistory(!showHistory);
              setShowFavorites(false);
            }}
            className={`p-2.5 rounded-lg border transition-all ${
              showHistory 
                ? 'bg-primary/10 border-primary text-primary' 
                : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
            title="Query History"
          >
            <History className="h-5 w-5" />
          </button>
          
          {/* History Dropdown */}
          {showHistory && (
            <div className="absolute top-full left-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                <span className="text-sm font-medium">Recent Queries</span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      toast.success('History cleared');
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              
              <div className="max-h-80 overflow-auto scrollbar-thin">
                {recentQueries.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No recent queries
                  </div>
                ) : (
                  recentQueries.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-start gap-2 px-3 py-2 hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectHistory(item)}
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-sm font-mono text-foreground block truncate">
                          {item.query}
                        </code>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{item.timeRange}</span>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                          {item.resultCount !== undefined && (
                            <>
                              <span>•</span>
                              <span>{item.resultCount} results</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(item.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Favorites Button */}
        <div className="relative" ref={favoritesRef}>
          <button
            type="button"
            onClick={() => {
              setShowFavorites(!showFavorites);
              setShowHistory(false);
            }}
            className={`p-2.5 rounded-lg border transition-all ${
              showFavorites 
                ? 'bg-warning/10 border-warning text-warning' 
                : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-warning/50'
            }`}
            title="Favorite Queries"
          >
            <Star className={`h-5 w-5 ${favorites.length > 0 ? 'fill-current' : ''}`} />
          </button>
          
          {/* Favorites Dropdown */}
          {showFavorites && (
            <div className="absolute top-full left-0 mt-2 w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                <span className="text-sm font-medium">Favorites</span>
                <button
                  type="button"
                  onClick={() => setShowAddFavorite(!showAddFavorite)}
                  className="text-xs text-primary hover:underline"
                >
                  {showAddFavorite ? 'Cancel' : '+ Add current'}
                </button>
              </div>
              
              {/* Add Favorite Form */}
              {showAddFavorite && (
                <div className="p-3 border-b border-border bg-secondary/30">
                  <code className="text-xs font-mono text-muted-foreground block truncate mb-2">
                    {query}
                  </code>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Name this query..."
                      value={favoriteName}
                      onChange={(e) => setFavoriteName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveFavorite()}
                      className="flex-1 h-8 px-2 text-sm bg-muted border border-border rounded focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={saveFavorite}
                      className="h-8 px-3 text-sm bg-primary text-primary-foreground rounded font-medium hover:opacity-90 transition-opacity"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
              
              <div className="max-h-80 overflow-auto scrollbar-thin">
                {favorites.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No favorites yet
                  </div>
                ) : (
                  favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="group flex items-start gap-2 px-3 py-2 hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectFavorite(fav)}
                    >
                      <Star className="h-4 w-4 text-warning fill-warning mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium block truncate">{fav.name}</span>
                        <code className="text-xs font-mono text-muted-foreground block truncate">
                          {fav.query}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavorite(fav.id);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Query Input with Syntax Highlighting */}
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
          <LogQLInput
            value={query}
            onChange={setQuery}
            placeholder='{service="api-gateway", env="prod"}'
            disabled={!isConnected}
            className="pl-12 pr-12"
          />
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => setSelectedRange(range.value)}
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
            onClick={onRefresh}
            disabled={!isConnected || isLoading}
            className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground border border-border transition-all hover:border-primary/50 disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="submit"
            disabled={!isConnected || isLoading}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold transition-all hover:opacity-90 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run Query
          </button>
        </div>
      </form>

      {/* Query Syntax Help */}
      <div className="flex items-center gap-2 mt-3 text-xs flex-wrap">
        <span className="text-muted-foreground">Syntax:</span>
        <code className="font-mono text-terminal-cyan bg-terminal-cyan/10 px-2 py-0.5 rounded">
          {'{'}label="value"{'}'}
        </code>
        <code className="font-mono text-terminal-amber bg-terminal-amber/10 px-2 py-0.5 rounded">
          =~ != !~
        </code>
        <code className="font-mono text-terminal-purple bg-terminal-purple/10 px-2 py-0.5 rounded">
          |= "filter"
        </code>
        <code className="font-mono text-terminal-red bg-terminal-red/10 px-2 py-0.5 rounded">
          count_over_time
        </code>
        <code className="font-mono text-terminal-cyan bg-terminal-cyan/10 px-2 py-0.5 rounded">
          [5m]
        </code>
      </div>
    </div>
  );
}
