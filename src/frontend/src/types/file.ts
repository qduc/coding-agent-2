export interface FileSystemState {
    files: Array<{
        name: string;
        path: string;
        content: string;
        lastModified: Date;
    }>;
    currentFile: string | null;
}

export type FileSystemAction =
    | { type: 'ADD_FILE'; payload: { name: string; path: string; content: string } }
    | { type: 'UPDATE_FILE'; payload: { path: string; content: string } }
    | { type: 'DELETE_FILE'; payload: string }
    | { type: 'SET_CURRENT_FILE'; payload: string | null };
