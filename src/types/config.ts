export interface ConfigState {
  provider: 'openai' | 'anthropic' | 'gemini';
  apiKeys: Record<string, string>;
  preferences: Record<string, any>;
  activeTab: 'provider' | 'apiKeys' | 'tools' | 'preferences';
  hasChanges: boolean;
}

export interface ConfigAction {
  type: string;
  payload?: any;
}

export interface ConfigValidationError {
  field: string;
  message: string;
}
