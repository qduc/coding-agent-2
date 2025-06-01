import React, { useState, useEffect } from 'react';
import { FileSearchResult } from './types';

interface FileSearchProps {
  onSearch: (query: string, useRegex: boolean) => Promise<FileSearchResult[]>;
  onSelectResult: (path: string) => void;
}

export const FileSearch: React.FC<FileSearchProps> = ({ onSearch, onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<FileSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    
    try {
      const searchResults = await onSearch(query, useRegex);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) handleSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [query, useRegex]);

  return (
    <div className="file-search">
      <div className="search-controls">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files..."
        />
        <label>
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => setUseRegex(e.target.checked)}
          />
          Use Regex
        </label>
        {isSearching && <span className="search-status">Searching...</span>}
      </div>

      {error && <div className="search-error">{error}</div>}

      <div className="search-results">
        {results.map((result) => (
          <div key={result.path} className="search-result">
            <div 
              className="result-path"
              onClick={() => onSelectResult(result.path)}
            >
              {result.path}
            </div>
            {result.matches.map((match, idx) => (
              <div key={idx} className="result-match">
                <span className="match-line">{match.line}:</span>
                <span className="match-content">
                  {match.content.substring(0, match.matchStart)}
                  <span className="match-highlight">
                    {match.content.substring(match.matchStart, match.matchEnd)}
                  </span>
                  {match.content.substring(match.matchEnd)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
