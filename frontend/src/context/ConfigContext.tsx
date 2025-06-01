import React, { createContext, useContext, useReducer } from 'react';
import { ConfigState, ConfigAction, LlmProviderKey, PanelToolsConfig, PanelPreferencesConfig } from '../types/config';

// Define initial values for the new structures
const initialToolsConfig: PanelToolsConfig = {
  enabled: [],
  settings: {},
  permissions: {
    fileSystem: true,
    network: true,
    shell: true,
  },
};

const initialPreferencesConfig: PanelPreferencesConfig = {
  theme: 'dark', // Default theme
  chat: {
    autoScroll: true,
    showTimestamps: true,
    messageBubbles: true,
  },
  fileExplorer: {
    viewMode: 'list',
    sortBy: 'name',
    sortDirection: 'asc',
  },
  performance: {
    cacheResponses: true,
    lazyLoadImages: false,
  },
};

const initialState: ConfigState = {
  llmProvider: 'openai',
  llmConfig: {
    // Ensure API keys are initialized as empty strings, not undefined
    openai: { apiKey: '', model: 'gpt-4-turbo' },
    anthropic: { apiKey: '', model: 'claude-3-opus' },
    gemini: { apiKey: '', model: 'gemini-1.5-pro' }
  },
  tools: initialToolsConfig, // Use defined initial value
  featureFlags: {
    experimentalFeatures: false,
    codeLens: true,
    autoComplete: true
  },
  preferences: initialPreferencesConfig, // Use defined initial value (was appearance)
};

const ConfigContext = createContext<{
  state: ConfigState;
  dispatch: React.Dispatch<ConfigAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

const reducer = (state: ConfigState, action: ConfigAction): ConfigState => {
  switch (action.type) {
    case 'SET_LLM_PROVIDER':
      return { ...state, llmProvider: action.payload };
    case 'UPDATE_LLM_CONFIG':
      return {
        ...state,
        llmConfig: {
          ...state.llmConfig,
          [action.payload.provider]: {
            ...state.llmConfig[action.payload.provider],
            ...action.payload.config
          }
        }
      };
    case 'TOGGLE_FEATURE_FLAG':
      return {
        ...state,
        featureFlags: {
          ...state.featureFlags,
          [action.payload]: !state.featureFlags[action.payload]
        }
      };
    case 'UPDATE_PREFERENCES': // Updated
      return {
        ...state,
        preferences: {
          ...state.preferences,
          ...action.payload // payload is Partial<PanelPreferencesConfig>
        }
      };
    case 'UPDATE_TOOLS_CONFIG': // Updated
      return {
        ...state,
        tools: {
          ...state.tools,
          ...action.payload, // payload is Partial<PanelToolsConfig>
        }
      };
    default:
      return state;
  }
};

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <ConfigContext.Provider value={{ state, dispatch }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfigContext = () => useContext(ConfigContext);
