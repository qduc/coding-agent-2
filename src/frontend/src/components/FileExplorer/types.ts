import { FileSystemNode, FileContent } from '../../types/file'; // Import from centralized types

export type FileViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'modified' | 'type';
export type SortDirection = 'asc' | 'desc';

export interface FileExplorerContext {
  currentPath: string;
  viewMode: FileViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  selectedFile?: string;
}

export interface FileSearchResult {
  path: string;
  matches: {
    line: number;
    content: string;
    matchStart: number;
    matchEnd: number;
  }[];
}

export interface FileOperation {
  type: 'create' | 'delete' | 'rename' | 'move' | 'copy';
  sourcePath: string;
  destinationPath?: string;
  content?: string;
}

// Re-exporting for convenience if components in this folder still need them directly
export type { FileSystemNode, FileContent };
