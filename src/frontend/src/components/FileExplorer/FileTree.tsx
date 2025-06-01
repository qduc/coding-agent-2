import React, { useState, useCallback } from 'react';
import { FileSystemNode } from './types';
import { FileIcon } from './FileIcons';

interface FileTreeProps {
  nodes: FileSystemNode[];
  selectedPath?: string;
  onSelect?: (path: string) => void;
  onToggle?: (path: string, isOpen: boolean) => void;
  depth?: number;
  className?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  selectedPath,
  onSelect,
  onToggle,
  depth = 0,
}) => {
  const handleToggle = useCallback((node: FileSystemNode) => {
    if (node.type === 'directory') {
      onToggle?.(node.path, !node.isOpen);
    }
  }, [onToggle]);

  const handleSelect = useCallback((node: FileSystemNode) => {
    onSelect?.(node.path);
  }, [onSelect]);

  return (
    <div className={`file-tree ${className || ''}`}>
      {nodes.map((node) => (
        <div 
          key={node.path}
          className={`file-tree-node ${node.path === selectedPath ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <div 
            className="file-tree-node-content"
            onClick={() => handleSelect(node)}
          >
            <span 
              className="file-tree-toggle"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(node);
              }}
            >
              {node.type === 'directory' ? (node.isOpen ? '▼' : '▶') : ' '}
            </span>
            <FileIcon node={node} />
            <span className="file-tree-name">{node.name}</span>
          </div>
          {node.type === 'directory' && node.isOpen && node.children && (
            <FileTree
              nodes={node.children}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          )}
        </div>
      ))}
    </div>
  );
};
