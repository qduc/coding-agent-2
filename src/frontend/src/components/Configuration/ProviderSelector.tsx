import React from 'react';
import { Configuration } from './types';
import { Select } from '../Common/Select';
import { Input } from '../Common/Input';
import { ErrorMessage } from '../Common/ErrorMessage';

interface ProviderSelectorProps {
  config: Configuration['provider'];
  onChange: (config: Configuration['provider']) => void;
  errors: ConfigValidationError[];
}

const providerModels = {
  openai: ['gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  gemini: ['gemini-1.5-pro', 'gemini-1.0-pro'],
};

export default ProviderSelector;

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  config,
  onChange,
  errors,
}) => {
  const handleProviderChange = (provider: 'openai' | 'anthropic' | 'gemini') => {
    onChange({
      ...config,
      name: provider,
      model: providerModels[provider][0],
    });
  };

  const handleModelChange = (model: string) => {
    onChange({
      ...config,
      model,
    });
  };

  const handleParamChange = (key: keyof Configuration['provider'], value: any) => {
    onChange({
      ...config,
      [key]: value,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Provider</label>
        <div className="flex gap-2">
          {(['openai', 'anthropic', 'gemini'] as const).map((provider) => (
            <button
              key={provider}
              className={`px-4 py-2 rounded-md ${config.name === provider ? 'bg-primary text-white' : 'bg-gray-100'}`}
              onClick={() => handleProviderChange(provider)}
              aria-pressed={config.name === provider}
            >
              {provider.charAt(0).toUpperCase() + provider.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="model-select" className="block text-sm font-medium mb-1">
          Model
        </label>
        <Select
          id="model-select"
          value={config.model}
          onChange={(e) => handleModelChange(e.target.value)}
          options={providerModels[config.name].map(model => ({
            value: model,
            label: model,
          }))}
          aria-describedby="model-error"
        />
        <ErrorMessage 
          id="model-error"
          errors={errors.filter(e => e.field === 'provider.model')}
        />
      </div>

      <div>
        <label htmlFor="base-url" className="block text-sm font-medium mb-1">
          Base URL (optional)
        </label>
        <Input
          id="base-url"
          type="text"
          value={config.baseUrl || ''}
          onChange={(e) => handleParamChange('baseUrl', e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="temperature" className="block text-sm font-medium mb-1">
            Temperature
          </label>
          <Input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={config.temperature ?? 0.7}
            onChange={(e) => handleParamChange('temperature', parseFloat(e.target.value))}
          />
        </div>
        <div>
          <label htmlFor="max-tokens" className="block text-sm font-medium mb-1">
            Max Tokens
          </label>
          <Input
            id="max-tokens"
            type="number"
            min="1"
            value={config.maxTokens ?? 2048}
            onChange={(e) => handleParamChange('maxTokens', parseInt(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
