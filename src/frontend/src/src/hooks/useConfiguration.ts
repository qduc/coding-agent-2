import { useConfigContext } from '../context/ConfigContext';

export const useConfiguration = () => {
  const { state, dispatch } = useConfigContext();

  const setLlmProvider = (provider: string) => {
    dispatch({ type: 'SET_LLM_PROVIDER', payload: provider });
  };

  const updateLlmConfig = (provider: string, config: any) => {
    dispatch({ type: 'UPDATE_LLM_CONFIG', payload: { provider, config } });
  };

  const toggleFeatureFlag = (flag: string) => {
    dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: flag });
  };

  const updateAppearance = (settings: any) => {
    dispatch({ type: 'UPDATE_APPEARANCE', payload: settings });
  };

  const addTool = (tool: any) => {
    dispatch({ type: 'ADD_TOOL', payload: tool });
  };

  const removeTool = (toolName: string) => {
    dispatch({ type: 'REMOVE_TOOL', payload: toolName });
  };

  return {
    config: state,
    setLlmProvider,
    updateLlmConfig,
    toggleFeatureFlag,
    updateAppearance,
    addTool,
    removeTool
  };
};
