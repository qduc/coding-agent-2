import React, { createContext, useContext, useReducer } from 'react';
import { ConfigState, ConfigAction } from '../types';

const initialState: ConfigState = {
  llmProvider: 'openai',
  llmConfig: {},
  tools: [],
  featureFlags: {},
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
    case 'SET_LLM_CONFIG':
      return { ...state, llmConfig: action.payload };
    case 'SET_TOOLS':
      return { ...state, tools: action.payload };
    case 'SET_FEATURE_FLAGS':
      return { ...state, featureFlags: action.payload };
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
