import { LogEntry } from '@/types/logs';
import { Download, FileJson, FileSpreadsheet } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

interface LogExportProps {
  logs: LogEntry[];
  disabled?: boolean;
}

export function LogExport({ logs, disabled }: LogExportProps) {
  const exportAsJSON = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }

    const data = JSON.stringify(logs, null, 2);
    downloadFile(data, 'logs.json', 'application/json');
    toast.success(`Exported ${logs.length} logs as JSON`);
  };

  const exportAsCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }

    // Get all unique label keys across all logs
    const allLabelKeys = new Set<string>();
    logs.forEach(log => {
      Object.keys(log.labels).forEach(key => allLabelKeys.add(key));
    });
    const labelKeys = Array.from(allLabelKeys).sort();

    // Create CSV headers
    const headers = ['id', 'timestamp', 'level', 'message', ...labelKeys.map(k => `label_${k}`)];
    
    // Create CSV rows
    const rows = logs.map(log => {
      const baseFields = [
        escapeCSV(log.id),
        escapeCSV(log.timestamp),
        escapeCSV(log.level),
        escapeCSV(log.message),
      ];
      const labelFields = labelKeys.map(key => escapeCSV(log.labels[key] || ''));
      return [...baseFields, ...labelFields].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    downloadFile(csv, 'logs.csv', 'text/csv');
    toast.success(`Exported ${logs.length} logs as CSV`);
  };

  const escapeCSV = (value: string): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled || logs.length === 0}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportAsJSON} className="gap-2 cursor-pointer">
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
