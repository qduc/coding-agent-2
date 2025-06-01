// src/frontend/src/types/file.ts

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

export interface FileContent {
  path: string;
  content: string;
  isBinary?: boolean;    // Made optional
  isTruncated?: boolean; // Made optional
  error?: string;
  name?: string; // Added name for consistency, though path can derive it
}

export interface FileSystemState {
  fileTree: FileSystemNode[];
  currentFile: FileContent | null;
  currentDirectory: string | null;
  isFileOperationInProgress: boolean;
  isLoading: boolean; // Added isLoading
  error: string | null; // Added error
}

export type FileSystemAction =
  | { type: 'SET_FILE_TREE'; payload: FileSystemNode[] }
  | { type: 'SET_CURRENT_FILE'; payload: FileContent | null }
  | { type: 'SET_CURRENT_DIRECTORY'; payload: string | null }
  | { type: 'SET_FILE_OPERATION'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean } // Added SET_LOADING action
  | { type: 'SET_ERROR'; payload: string | null }; // Added SET_ERROR action
