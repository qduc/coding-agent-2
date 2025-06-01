// These types mirror the structure from Configuration['tools'] and Configuration['preferences']

export interface ConfigValidationError {
    field: string;
    message: string;
    type: 'error' | 'warning';
    path?: string[];
}

export interface PanelToolsConfig {
    enabled: string[];
    settings: Record<string, any>;
    permissions: {
      fileSystem: boolean;
      network: boolean;
      shell: boolean;
    };
}

export interface PanelPreferencesConfig {
    theme: 'light' | 'dark' | 'system';
    chat: {
      autoScroll: boolean;
      showTimestamps: boolean;
      messageBubbles: boolean;
    };
    fileExplorer: {
      viewMode: 'grid' | 'list';
      sortBy: 'name' | 'modified' | 'size';
      sortDirection: 'asc' | 'desc';
    };
    performance: {
      cacheResponses: boolean;
      lazyLoadImages: boolean;
    };
}

export interface ConfigState {
    llmProvider: 'openai' | 'anthropic' | 'gemini';
    llmConfig: {
        openai: { apiKey: string; model: string; baseUrl?: string; temperature?: number; maxTokens?: number; };
        anthropic: { apiKey: string; model: string; baseUrl?: string; temperature?: number; maxTokens?: number; };
        gemini: { apiKey: string; model: string; baseUrl?: string; temperature?: number; maxTokens?: number; };
    };
    tools: PanelToolsConfig; // Updated from any[]
    featureFlags: {
        experimentalFeatures: boolean;
        codeLens: boolean;
        autoComplete: boolean;
    };
    preferences: PanelPreferencesConfig; // Updated from appearance
}

export type LlmProviderKey = keyof ConfigState['llmConfig'];

export type ConfigAction =
    | { type: 'SET_LLM_PROVIDER'; payload: LlmProviderKey }
    | { type: 'UPDATE_LLM_CONFIG'; payload: { provider: LlmProviderKey; config: Partial<ConfigState['llmConfig'][LlmProviderKey]> } }
    | { type: 'TOGGLE_FEATURE_FLAG'; payload: keyof ConfigState['featureFlags'] }
    | { type: 'UPDATE_PREFERENCES'; payload: Partial<PanelPreferencesConfig> } // Updated
    | { type: 'UPDATE_TOOLS_CONFIG'; payload: Partial<PanelToolsConfig> }; // Updated
