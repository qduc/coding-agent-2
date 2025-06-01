import { FileSystemNode, FileContent } from '../frontend/src/components/FileExplorer/types';

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
