import { useState, useEffect, useCallback } from 'react';

export interface QueryHistoryItem {
  id: string;
  query: string;
  timeRange: string;
  timestamp: string;
  resultCount?: number;
  executionTime?: number;
}

const STORAGE_KEY = 'logpulse-query-history';
const MAX_HISTORY_ITEMS = 50;

export function useQueryHistory() {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      setHistory([]);
    }
  }, []);

  // Save to localStorage whenever history changes
  const saveHistory = useCallback((items: QueryHistoryItem[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    setHistory(items);
  }, []);

  // Add a query to history
  const addToHistory = useCallback((
    query: string,
    timeRange: string,
    resultCount?: number,
    executionTime?: number
  ) => {
    if (!query.trim()) return;

    const newItem: QueryHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query: query.trim(),
      timeRange,
      timestamp: new Date().toISOString(),
      resultCount,
      executionTime,
    };

    setHistory(prev => {
      // Remove duplicate queries (keep the most recent)
      const filtered = prev.filter(item => item.query !== query);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Remove a specific item from history
  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  // Get recent unique queries (for autocomplete)
  const getRecentQueries = useCallback((limit: number = 10) => {
    const seen = new Set<string>();
    return history
      .filter(item => {
        if (seen.has(item.query)) return false;
        seen.add(item.query);
        return true;
      })
      .slice(0, limit);
  }, [history]);

  // Search history
  const searchHistory = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(item => 
      item.query.toLowerCase().includes(term)
    );
  }, [history]);

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentQueries,
    searchHistory,
  };
}
