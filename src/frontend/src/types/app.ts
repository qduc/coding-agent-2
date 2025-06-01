export interface AppState {
    isLoading: boolean;
    error: string | null;
    theme: 'light' | 'dark';
}

export type AppAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'TOGGLE_THEME' };
