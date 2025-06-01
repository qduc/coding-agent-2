export interface FileSystemNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileSystemNode[];
  extension?: string;
  isOpen?: boolean;
  isSelected?: boolean;
  isHidden?: boolean;
}

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

export interface FileContent {
  path: string;
  content: string;
  isBinary: boolean;
  isTruncated: boolean;
  error?: string;
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
