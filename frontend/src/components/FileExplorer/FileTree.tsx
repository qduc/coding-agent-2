import React, { useState, useCallback } from 'react';
import { FileSystemNode } from './types';
import { FileIcon } from './FileIcons'; // Ensure this component is theme-aware
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className,
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
    <div className={cn('file-tree py-1 text-sm', className)}> {/* Added base styling */}
      {nodes.map((node) => (
        <div
          key={node.path}
          className={cn(
            'file-tree-node group flex items-center pr-2 hover:bg-accent hover:text-accent-foreground rounded-md',
            node.path === selectedPath ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground',
          )}
          style={{ paddingLeft: `${depth * 16 + (node.type === 'directory' ? 0 : 20)}px` }} // Adjust padding for icon alignment
          onClick={() => handleSelect(node)} // Make the whole div clickable for selection
        >
          {node.type === 'directory' && (
            <span
              className="file-tree-toggle p-1 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(node);
              }}
            >
              {node.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          )}
          <FileIcon node={node} className="mr-1.5 h-4 w-4 flex-shrink-0" /> {/* Added className for FileIcon sizing */}
          <span className="file-tree-name truncate flex-grow py-1 cursor-pointer">{node.name}</span>
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
