export interface AppState {
  darkMode: boolean;
  sidebarOpen: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
}

export interface AppAction {
  type: string;
  payload?: any;
}
