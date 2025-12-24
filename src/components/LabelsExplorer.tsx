import { useState, useEffect } from 'react';
import { Tag, ChevronRight, RefreshCw, Search, Copy, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface LabelsExplorerProps {
  isConnected: boolean;
}

export function LabelsExplorer({ isConnected }: LabelsExplorerProps) {
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [labelValues, setLabelValues] = useState<string[]>([]);
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [isLoadingValues, setIsLoadingValues] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLabels = async () => {
    if (!isConnected) return;
    
    setIsLoadingLabels(true);
    try {
      const data = await apiClient.getLabels();
      setLabels(data);
    } catch (error) {
      toast.error('Failed to fetch labels');
    } finally {
      setIsLoadingLabels(false);
    }
  };

  const fetchLabelValues = async (label: string) => {
    if (!isConnected) return;
    
    setIsLoadingValues(true);
    try {
      const data = await apiClient.getLabelValues(label);
      setLabelValues(data);
    } catch (error) {
      toast.error(`Failed to fetch values for ${label}`);
    } finally {
      setIsLoadingValues(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchLabels();
    }
  }, [isConnected]);

  useEffect(() => {
    if (selectedLabel) {
      fetchLabelValues(selectedLabel);
    } else {
      setLabelValues([]);
    }
  }, [selectedLabel]);

  const filteredLabels = labels.filter((l) =>
    l.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyQuery = (label: string, value?: string) => {
    const query = value ? `{${label}="${value}"}` : `{${label}="..."}`;
    navigator.clipboard.writeText(query);
    toast.success('Query copied to clipboard');
  };

  if (!isConnected) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p className="text-sm">Connect to backend to explore labels</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Labels Explorer
          </h3>
          <button
            onClick={fetchLabels}
            disabled={isLoadingLabels}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isLoadingLabels ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search labels..."
            className="query-input w-full pl-9 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Labels list */}
        <div className="w-1/2 border-r border-border overflow-auto scrollbar-thin">
          {isLoadingLabels ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLabels.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {labels.length === 0 ? 'No labels found' : 'No matching labels'}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => setSelectedLabel(label === selectedLabel ? null : label)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    selectedLabel === label
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : 'hover:bg-muted border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-sm">{label}</span>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
                    selectedLabel === label ? 'rotate-90' : ''
                  }`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Values list */}
        <div className="w-1/2 overflow-auto scrollbar-thin">
          {selectedLabel ? (
            <>
              <div className="p-3 border-b border-border bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Values for <span className="text-primary font-mono">{selectedLabel}</span>
                </p>
              </div>
              
              {isLoadingValues ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : labelValues.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No values found
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {labelValues.map((value) => (
                    <div
                      key={value}
                      className="flex items-center justify-between px-4 py-2 hover:bg-muted group"
                    >
                      <span className="font-mono text-sm text-foreground">{value}</span>
                      <button
                        onClick={() => copyQuery(selectedLabel, value)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded transition-all"
                      >
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Select a label to see values
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
