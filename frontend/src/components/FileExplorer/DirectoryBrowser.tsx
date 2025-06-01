import React, { useState, useCallback } from 'react';
import { FileSystemNode, FileViewMode, SortField, SortDirection } from './types';
import { FileTree } from './FileTree';
import { FileIcon } from './FileIcons';

interface DirectoryBrowserProps {
  nodes: FileSystemNode[];
  currentPath: string;
  viewMode?: FileViewMode;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string) => void;
  onToggleDirectory: (path: string, isOpen: boolean) => void;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
  onViewModeChange?: (mode: FileViewMode) => void;
}

export const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({
  nodes,
  currentPath,
  viewMode = 'list',
  sortField = 'name',
  sortDirection = 'asc',
  onNavigate,
  onSelectFile,
  onToggleDirectory,
  onSortChange,
  onViewModeChange,
}) => {
  const pathParts = currentPath.split('/').filter(Boolean);
  
  const handleBreadcrumbClick = useCallback((index: number) => {
    const newPath = '/' + pathParts.slice(0, index + 1).join('/');
    onNavigate(newPath);
  }, [currentPath, onNavigate]);

  const handleSort = useCallback((field: SortField) => {
    const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange?.(field, direction);
  }, [sortField, sortDirection, onSortChange]);

  const renderBreadcrumbs = () => (
    <div className="breadcrumbs">
      <span onClick={() => onNavigate('/')}>Root</span>
      {pathParts.map((part, index) => (
        <React.Fragment key={index}>
          <span>/</span>
          <span onClick={() => handleBreadcrumbClick(index)}>{part}</span>
        </React.Fragment>
      ))}
    </div>
  );

  const renderControls = () => (
    <div className="directory-controls">
      <button onClick={() => onViewModeChange?.('list')} disabled={viewMode === 'list'}>
        List View
      </button>
      <button onClick={() => onViewModeChange?.('grid')} disabled={viewMode === 'grid'}>
        Grid View
      </button>
      <div className="sort-controls">
        <span>Sort by:</span>
        <button 
          onClick={() => handleSort('name')} 
          className={sortField === 'name' ? 'active' : ''}
        >
          Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          onClick={() => handleSort('modified')} 
          className={sortField === 'modified' ? 'active' : ''}
        >
          Modified {sortField === 'modified' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
        <button 
          onClick={() => handleSort('size')} 
          className={sortField === 'size' ? 'active' : ''}
        >
          Size {sortField === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
        </button>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="directory-list">
      <div className="directory-header">
        <div className="header-name">Name</div>
        <div className="header-modified">Modified</div>
        <div className="header-size">Size</div>
      </div>
      {nodes.map((node) => (
        <div 
          key={node.path}
          className="directory-item"
          onClick={() => node.type === 'directory' ? onNavigate(node.path) : onSelectFile(node.path)}
        >
          <div className="item-name">
            <FileIcon node={node} />
            <span>{node.name}</span>
          </div>
          <div className="item-modified">
            {node.modified?.toLocaleDateString() || '-'}
          </div>
          <div className="item-size">
            {node.type === 'file' ? formatFileSize(node.size || 0) : '-'}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGrid = () => (
    <div className="directory-grid">
      {nodes.map((node) => (
        <div 
          key={node.path}
          className="grid-item"
          onClick={() => node.type === 'directory' ? onNavigate(node.path) : onSelectFile(node.path)}
        >
          <FileIcon node={node} />
          <div className="grid-item-name">{node.name}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="directory-browser">
      {renderBreadcrumbs()}
      {renderControls()}
      {viewMode === 'list' ? renderList() : renderGrid()}
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
