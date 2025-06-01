import { useConfigContext } from '../context/ConfigContext';
import type { ConfigState, LlmProviderKey, PanelToolsConfig, PanelPreferencesConfig } from '../types/config';

export const useConfiguration = () => {
  const { state, dispatch } = useConfigContext();

  const setLlmProvider = (provider: LlmProviderKey) => {
    dispatch({ type: 'SET_LLM_PROVIDER', payload: provider });
  };

  const updateLlmConfig = (provider: LlmProviderKey, config: Partial<ConfigState['llmConfig'][LlmProviderKey]>) => {
    dispatch({ type: 'UPDATE_LLM_CONFIG', payload: { provider, config } });
  };

  const toggleFeatureFlag = (flag: keyof ConfigState['featureFlags']) => {
    dispatch({ type: 'TOGGLE_FEATURE_FLAG', payload: flag });
  };

  const updatePreferences = (settings: Partial<PanelPreferencesConfig>) => { // Updated
    dispatch({ type: 'UPDATE_PREFERENCES', payload: settings });
  };

  const updateToolsConfig = (config: Partial<PanelToolsConfig>) => { // Updated
    dispatch({ type: 'UPDATE_TOOLS_CONFIG', payload: config });
  };

  return {
    config: state,
    setLlmProvider,
    updateLlmConfig,
    toggleFeatureFlag,
    updatePreferences, // Updated
    updateToolsConfig, // Updated
  };
};
