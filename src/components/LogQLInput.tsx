import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface LogQLInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorPosition?: number;
}

interface Token {
  type: 'brace' | 'label' | 'operator' | 'string' | 'pipe' | 'aggregation' | 'timeRange' | 'groupBy' | 'text';
  value: string;
  start: number;
  end: number;
}

// LogQL syntax highlighting colors
const tokenColors: Record<Token['type'], string> = {
  brace: 'text-terminal-cyan',
  label: 'text-terminal-blue',
  operator: 'text-terminal-amber',
  string: 'text-terminal-green',
  pipe: 'text-terminal-purple',
  aggregation: 'text-terminal-red',
  timeRange: 'text-terminal-cyan',
  groupBy: 'text-terminal-purple',
  text: 'text-foreground',
};

// Tokenize LogQL query
function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const aggregationFunctions = [
    'count_over_time', 'rate', 'bytes_over_time', 'bytes_rate',
    'sum', 'avg', 'min', 'max', 'stddev', 'stdvar',
    'count', 'topk', 'bottomk'
  ];

  while (i < query.length) {
    // Skip whitespace but include it as text
    if (/\s/.test(query[i])) {
      const start = i;
      while (i < query.length && /\s/.test(query[i])) i++;
      tokens.push({ type: 'text', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Braces
    if (query[i] === '{' || query[i] === '}') {
      tokens.push({ type: 'brace', value: query[i], start: i, end: i + 1 });
      i++;
      continue;
    }

    // Parentheses (for aggregations)
    if (query[i] === '(' || query[i] === ')') {
      tokens.push({ type: 'brace', value: query[i], start: i, end: i + 1 });
      i++;
      continue;
    }

    // Time range [5m], [1h], etc
    if (query[i] === '[') {
      const start = i;
      while (i < query.length && query[i] !== ']') i++;
      if (query[i] === ']') i++;
      tokens.push({ type: 'timeRange', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Pipe operators
    if (query[i] === '|') {
      const start = i;
      i++;
      // Check for |= or |~
      if (query[i] === '=' || query[i] === '~') i++;
      tokens.push({ type: 'pipe', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Operators: =~, !~, !=, =
    if (query[i] === '=' || query[i] === '!') {
      const start = i;
      i++;
      if (query[i] === '~' || query[i] === '=') i++;
      tokens.push({ type: 'operator', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Strings
    if (query[i] === '"' || query[i] === "'") {
      const quote = query[i];
      const start = i;
      i++;
      while (i < query.length && query[i] !== quote) {
        if (query[i] === '\\') i++; // Skip escaped chars
        i++;
      }
      if (query[i] === quote) i++;
      tokens.push({ type: 'string', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Backtick strings
    if (query[i] === '`') {
      const start = i;
      i++;
      while (i < query.length && query[i] !== '`') i++;
      if (query[i] === '`') i++;
      tokens.push({ type: 'string', value: query.slice(start, i), start, end: i });
      continue;
    }

    // Comma
    if (query[i] === ',') {
      tokens.push({ type: 'text', value: ',', start: i, end: i + 1 });
      i++;
      continue;
    }

    // Words (labels, aggregations, by keyword)
    if (/[a-zA-Z_]/.test(query[i])) {
      const start = i;
      while (i < query.length && /[a-zA-Z0-9_]/.test(query[i])) i++;
      const word = query.slice(start, i);
      
      if (aggregationFunctions.includes(word)) {
        tokens.push({ type: 'aggregation', value: word, start, end: i });
      } else if (word === 'by') {
        tokens.push({ type: 'groupBy', value: word, start, end: i });
      } else {
        tokens.push({ type: 'label', value: word, start, end: i });
      }
      continue;
    }

    // Any other character
    tokens.push({ type: 'text', value: query[i], start: i, end: i + 1 });
    i++;
  }

  return tokens;
}

// Validate LogQL query
function validateQuery(query: string): ValidationResult {
  if (!query.trim()) {
    return { isValid: true };
  }

  // Check for balanced braces
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;

  for (let i = 0; i < query.length; i++) {
    if (query[i] === '{') braceCount++;
    if (query[i] === '}') braceCount--;
    if (query[i] === '(') parenCount++;
    if (query[i] === ')') parenCount--;
    if (query[i] === '[') bracketCount++;
    if (query[i] === ']') bracketCount--;

    if (braceCount < 0) {
      return { isValid: false, error: 'Unexpected }', errorPosition: i };
    }
    if (parenCount < 0) {
      return { isValid: false, error: 'Unexpected )', errorPosition: i };
    }
    if (bracketCount < 0) {
      return { isValid: false, error: 'Unexpected ]', errorPosition: i };
    }
  }

  if (braceCount > 0) {
    return { isValid: false, error: 'Missing closing }', errorPosition: query.lastIndexOf('{') };
  }
  if (parenCount > 0) {
    return { isValid: false, error: 'Missing closing )', errorPosition: query.lastIndexOf('(') };
  }
  if (bracketCount > 0) {
    return { isValid: false, error: 'Missing closing ]', errorPosition: query.lastIndexOf('[') };
  }

  // Check for unclosed strings
  let inString = false;
  let stringChar = '';
  for (let i = 0; i < query.length; i++) {
    if ((query[i] === '"' || query[i] === "'") && (i === 0 || query[i - 1] !== '\\')) {
      if (!inString) {
        inString = true;
        stringChar = query[i];
      } else if (query[i] === stringChar) {
        inString = false;
      }
    }
  }
  if (inString) {
    return { isValid: false, error: `Unclosed string ${stringChar}`, errorPosition: query.lastIndexOf(stringChar) };
  }

  // Check for invalid regex patterns in =~ or !~
  const regexOperatorMatch = query.match(/(=~|!~)\s*"([^"]*)"/g);
  if (regexOperatorMatch) {
    for (const match of regexOperatorMatch) {
      const pattern = match.replace(/^(=~|!~)\s*"/, '').replace(/"$/, '');
      try {
        new RegExp(pattern);
      } catch {
        return { isValid: false, error: `Invalid regex: ${pattern}` };
      }
    }
  }

  // Check for valid label selector format
  const labelSelectorMatch = query.match(/\{([^}]*)\}/);
  if (labelSelectorMatch) {
    const content = labelSelectorMatch[1].trim();
    if (content) {
      // Should have format: label="value" or label=~"regex" etc
      const labelPattern = /^\s*(\w+\s*(=~|!~|!=|=)\s*"[^"]*"\s*,?\s*)+$/;
      if (!labelPattern.test(content + ',')) {
        // More lenient check - just ensure we have some structure
        if (!content.includes('=')) {
          return { isValid: false, error: 'Invalid label selector format' };
        }
      }
    }
  }

  return { isValid: true };
}

export function LogQLInput({ value, onChange, placeholder, disabled, className }: LogQLInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const tokens = useMemo(() => tokenize(value), [value]);
  const validation = useMemo(() => validateQuery(value), [value]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (inputRef.current && highlightRef.current) {
      highlightRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Auto-complete braces
    const pairs: Record<string, string> = {
      '{': '}',
      '(': ')',
      '[': ']',
      '"': '"',
    };

    if (pairs[e.key]) {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      if (start === end) {
        e.preventDefault();
        const newValue = value.slice(0, start) + e.key + pairs[e.key] + value.slice(end);
        onChange(newValue);
        // Set cursor position after the opening character
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + 1;
        }, 0);
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Syntax highlighted overlay */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none font-mono text-sm px-4 py-3 overflow-hidden whitespace-pre"
        aria-hidden="true"
      >
        {tokens.map((token, i) => (
          <span key={i} className={tokenColors[token.type]}>
            {token.value}
          </span>
        ))}
      </div>

      {/* Actual textarea (transparent text) */}
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={`
          w-full font-mono text-sm px-4 py-3 rounded-lg
          bg-muted border resize-none overflow-hidden
          placeholder:text-muted-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/50
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all
          ${validation.isValid 
            ? 'border-border focus:border-primary' 
            : 'border-destructive focus:border-destructive focus:ring-destructive/50'
          }
        `}
        style={{ 
          color: 'transparent', 
          caretColor: 'hsl(var(--foreground))',
          WebkitTextFillColor: 'transparent',
        }}
      />

      {/* Validation indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {value && (
          validation.isValid ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {isFocused && (
                <span className="text-xs font-mono">{validation.error}</span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export { validateQuery, tokenize };
export type { ValidationResult, Token };
