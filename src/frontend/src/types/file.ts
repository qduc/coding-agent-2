export interface FileSystemState {
    fileTree: any[];
    currentFile: string | null;
    currentDirectory: string | null;
    isFileOperationInProgress: boolean;
}

export type FileSystemAction =
    | { type: 'SET_FILE_TREE'; payload: any[] }
    | { type: 'SET_CURRENT_FILE'; payload: string | null }
    | { type: 'SET_CURRENT_DIRECTORY'; payload: string | null }
    | { type: 'SET_FILE_OPERATION'; payload: boolean };
