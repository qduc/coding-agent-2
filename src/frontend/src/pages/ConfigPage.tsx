import { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import MainLayout from '../components/Layout/MainLayout';
import ConfigPanel from '../components/Configuration/ConfigPanel';
import { useConfiguration } from '../hooks/useConfiguration';
import { Configuration } from '../components/Configuration/types'; // Panel's config type
import { ConfigState, LlmProviderKey, PanelPreferencesConfig, PanelToolsConfig } from '../types/config'; // Global state types

// Helper function to map global ConfigState to Configuration for the panel
const mapGlobalConfigToPanelConfig = (globalConfig: ConfigState): Configuration => {
  const activeProviderName = globalConfig.llmProvider;
  const providerSpecificConfig = globalConfig.llmConfig[activeProviderName];

  // Configuration.apiKeys has optional keys, globalConfig.llmConfig.*.apiKey is string.
  // Map empty string from global state to undefined for the panel if that's desired,
  // or keep them as empty strings if the panel handles that.
  // The panel's Input component likely expects string value.
  const apiKeys: Configuration['apiKeys'] = {
    openai: globalConfig.llmConfig.openai.apiKey,
    anthropic: globalConfig.llmConfig.anthropic.apiKey,
    gemini: globalConfig.llmConfig.gemini.apiKey,
  };

  return {
    provider: {
      name: activeProviderName,
      model: providerSpecificConfig.model,
      baseUrl: providerSpecificConfig.baseUrl,
      temperature: providerSpecificConfig.temperature,
      maxTokens: providerSpecificConfig.maxTokens,
    },
    apiKeys: apiKeys,
    tools: globalConfig.tools, // Now directly mappable
    preferences: globalConfig.preferences, // Now directly mappable
  };
};

// Helper function to map Panel's Configuration back to updates for global ConfigState
const mapPanelConfigToGlobalUpdates = (
  newConfigFromPanel: Configuration,
  currentGlobalLlmProvider: LlmProviderKey,
  // Dispatch functions from useConfiguration hook
  dispatchSetLlmProvider: (provider: LlmProviderKey) => void,
  dispatchUpdateLlmConfig: (provider: LlmProviderKey, config: Partial<ConfigState['llmConfig'][LlmProviderKey]>) => void,
  dispatchUpdatePreferences: (settings: Partial<PanelPreferencesConfig>) => void,
  dispatchUpdateToolsConfig: (config: Partial<PanelToolsConfig>) => void
) => {
  // Update LLM Provider if changed
  if (newConfigFromPanel.provider.name !== currentGlobalLlmProvider) {
    dispatchSetLlmProvider(newConfigFromPanel.provider.name);
  }

  // Update LLM Config for each provider
  // Iterate over known provider keys to ensure type safety
  const knownProviderKeys: LlmProviderKey[] = ['openai', 'anthropic', 'gemini'];
  knownProviderKeys.forEach(providerKey => {
    const panelApiKey = newConfigFromPanel.apiKeys[providerKey];
    
    const updatesForProvider: Partial<ConfigState['llmConfig'][LlmProviderKey]> = {
      // Ensure apiKey is always a string for ConfigState, default to empty string if undefined/null from panel
      apiKey: panelApiKey || '', 
    };

    // If this is the currently active provider in the panel, also update its model and other settings
    if (providerKey === newConfigFromPanel.provider.name) {
      updatesForProvider.model = newConfigFromPanel.provider.model;
      updatesForProvider.baseUrl = newConfigFromPanel.provider.baseUrl;
      updatesForProvider.temperature = newConfigFromPanel.provider.temperature;
      updatesForProvider.maxTokens = newConfigFromPanel.provider.maxTokens;
    }
    // For non-active providers, only their API key is updated from the panel.
    // Other settings (model, baseUrl etc.) are preserved by the reducer's spread logic.
    dispatchUpdateLlmConfig(providerKey, updatesForProvider);
  });
  
  // Update tools and preferences
  dispatchUpdateToolsConfig(newConfigFromPanel.tools);
  dispatchUpdatePreferences(newConfigFromPanel.preferences);
};


export default function ConfigPage() {
  const { 
    config: globalConfig, 
    setLlmProvider, 
    updateLlmConfig,
    updatePreferences,
    updateToolsConfig,
  } = useConfiguration();
  
  // Cast globalConfig to ConfigState for type safety within this component
  const typedGlobalConfig = globalConfig as ConfigState;

  const [initialPanelConfig, setInitialPanelConfig] = useState<Configuration | null>(null);

  useEffect(() => {
    if (typedGlobalConfig) {
      setInitialPanelConfig(mapGlobalConfigToPanelConfig(typedGlobalConfig));
    }
  }, [typedGlobalConfig]);

  const handleSave = useCallback(async (newConfigFromPanel: Configuration) => {
    if (!typedGlobalConfig) return;

    // API call to persist newConfigFromPanel to backend would go here.
    // e.g., await apiService.saveConfiguration(newConfigFromPanel);

    mapPanelConfigToGlobalUpdates(
      newConfigFromPanel,
      typedGlobalConfig.llmProvider,
      setLlmProvider,
      updateLlmConfig,
      updatePreferences,
      updateToolsConfig
    );
        
    // Update the panel's view of initialConfig so it resets its "dirty" state
    setInitialPanelConfig(newConfigFromPanel); 
    
    alert('Configuration saved (mock). Global state updated.');
  }, [typedGlobalConfig, setLlmProvider, updateLlmConfig, updatePreferences, updateToolsConfig]);

  const handleReset = useCallback(() => {
    if (typedGlobalConfig) {
      setInitialPanelConfig(mapGlobalConfigToPanelConfig(typedGlobalConfig));
    }
  }, [typedGlobalConfig]);

  if (!initialPanelConfig || !typedGlobalConfig) {
    return (
      <MainLayout>
        <div className="p-4">Loading configuration...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Helmet>
        <title>Settings | DevAssistant</title>
        <meta name="description" content="Configure application settings" />
      </Helmet>
      <div className="p-4 max-w-4xl mx-auto">
        <ConfigPanel
          initialConfig={initialPanelConfig}
          onSave={handleSave}
          onReset={handleReset}
        />
      </div>
    </MainLayout>
  );
}
