export interface Configuration {
  provider: {
    name: 'openai' | 'anthropic' | 'gemini';
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  };
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
    [key: string]: string | undefined;
  };
  tools: {
    enabled: string[];
    settings: Record<string, any>;
    permissions: {
      fileSystem: boolean;
      network: boolean;
      shell: boolean;
    };
  };
  preferences: {
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
  };
}

export type ConfigTab = 'provider' | 'apiKeys' | 'tools' | 'preferences';

export interface ConfigValidationError {
  field: string;
  message: string;
}
