// Backend file system types - independent of frontend components

export interface FileSystemNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  children?: FileSystemNode[];
  permissions?: string;
  isHidden?: boolean;
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
  encoding: string;
  size: number;
  modified: Date;
  mimeType?: string;
  language?: string;
}

export interface FileSystemState {
  nodes: FileSystemNode[];
  selectedFile?: FileContent | null;
  viewMode: 'grid' | 'list';
  sortField: 'name' | 'size' | 'modified' | 'type';
  sortDirection: 'asc' | 'desc';
}

export interface FileSystemAction {
  type: string;
  payload?: any;
}
