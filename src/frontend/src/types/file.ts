export interface FileSystemNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileSystemNode[]; // For directories
  size?: number; // For files
  modified?: Date; // For files/directories
}

export interface FileContent {
  name: string; // Added for frontend display
  path: string;
  content: string;
  isBinary?: boolean; // Optional, from FileExplorer/types.ts summary
  isTruncated?: boolean; // Optional, from FileExplorer/types.ts summary
  error?: string; // Optional, from FileExplorer/types.ts summary
}

export interface FileSystemState {
    fileTree: FileSystemNode[]; // Changed from any[]
    currentFile: FileContent | null; // Changed from string | null
    currentDirectory: string | null;
    isFileOperationInProgress: boolean;
    isLoading: boolean; // Added
    error: string | null; // Added
}

export type FileSystemAction =
    | { type: 'SET_FILE_TREE'; payload: FileSystemNode[] } // Changed payload type
    | { type: 'SET_CURRENT_FILE'; payload: FileContent | null } // Changed payload type
    | { type: 'SET_CURRENT_DIRECTORY'; payload: string | null }
    | { type: 'SET_FILE_OPERATION'; payload: boolean }
    | { type: 'SET_LOADING'; payload: boolean } // Added
    | { type: 'SET_ERROR'; payload: string | null }; // Added
