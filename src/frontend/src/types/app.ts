export interface AppState {
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    preferences: Record<string, any>;
    currentProject: any;
}

export type AppAction =
    | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_PREFERENCES'; payload: Record<string, any> }
    | { type: 'SET_PROJECT'; payload: any };
