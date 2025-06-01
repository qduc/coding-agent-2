import React, { createContext, useContext, useReducer } from 'react';
import { ConfigState, ConfigAction } from '../types';

const initialState: ConfigState = {
  llmProvider: 'openai',
  llmConfig: {
    openai: { apiKey: '', model: 'gpt-4' },
    anthropic: { apiKey: '', model: 'claude-2' },
    gemini: { apiKey: '', model: 'gemini-pro' }
  },
  tools: [],
  featureFlags: {
    experimentalFeatures: false,
    codeLens: true,
    autoComplete: true
  },
  appearance: {
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'monospace'
  }
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
    case 'UPDATE_APPEARANCE':
      return {
        ...state,
        appearance: {
          ...state.appearance,
          ...action.payload
        }
      };
    case 'ADD_TOOL':
      return {
        ...state,
        tools: [...state.tools, action.payload]
      };
    case 'REMOVE_TOOL':
      return {
        ...state,
        tools: state.tools.filter((tool: { name: string }) => tool.name !== action.payload)
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
