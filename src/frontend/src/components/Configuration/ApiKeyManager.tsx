import React, { useState } from 'react';
import { Configuration, ConfigValidationError } from './types';
import { Input } from '../Common/Input';
import { Button } from '../Common/Button';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Dialog } from '../Common/Dialog';

interface ApiKeyManagerProps {
  config: Configuration['apiKeys'];
  activeProvider: 'openai' | 'anthropic' | 'gemini';
  onChange: (config: Configuration['apiKeys']) => void;
  errors: ConfigValidationError[];
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({
  config,
  activeProvider,
  onChange,
  errors,
}) => {
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const toggleReveal = (provider: string) => {
    setRevealedKeys(prev => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  const handleKeyChange = (provider: string, value: string) => {
    onChange({
      ...config,
      [provider]: value,
    });
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      // TODO: Implement actual connection test
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTestStatus('success');
    } catch (error) {
      setTestStatus('error');
    }
  };

  return (
    <div className="space-y-4">
      {(['openai', 'anthropic', 'gemini'] as const).map((provider) => (
        <div key={provider} className="space-y-2">
          <label htmlFor={`api-key-${provider}`} className="block text-sm font-medium">
            {provider.charAt(0).toUpperCase() + provider.slice(1)} API Key
            {activeProvider === provider && (
              <span className="ml-2 text-xs text-primary">(Active Provider)</span>
            )}
          </label>
          <div className="flex gap-2">
            <Input
              id={`api-key-${provider}`}
              type={revealedKeys[provider] ? 'text' : 'password'}
              value={config[provider] || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleKeyChange(provider, e.target.value)}
              aria-describedby={`api-key-error-${provider}`}
              className="flex-1"
            />
            <Button
              variant="ghost"
              onClick={() => toggleReveal(provider)}
              aria-label={revealedKeys[provider] ? 'Hide key' : 'Show key'}
            >
              {revealedKeys[provider] ? '👁️' : '👁️‍🗨️'}
            </Button>
          </div>
          <ErrorMessage
            id={`api-key-error-${provider}`}
            errors={errors.filter(e => e.field === `apiKeys.${provider}`)}
          />
        </div>
      ))}

      <div className="pt-4">
        <Button 
          variant="secondary" 
          onClick={() => setShowTestDialog(true)}
          disabled={!config[activeProvider]}
        >
          Test Connection
        </Button>
      </div>

      <Dialog
        isOpen={showTestDialog}
        onClose={() => {
          setShowTestDialog(false);
          setTestStatus('idle');
        }}
        title="Test API Connection"
        actions={[
          { label: 'Cancel', onClick: () => setShowTestDialog(false) },
          { 
            label: testStatus === 'testing' ? 'Testing...' : 'Test', 
            onClick: testConnection,
            variant: 'primary',
            disabled: testStatus === 'testing',
          },
        ]}
      >
        <div className="space-y-2">
          <p>Testing connection to {activeProvider} with the provided API key...</p>
          {testStatus === 'success' && (
            <p className="text-green-600">✅ Connection successful!</p>
          )}
          {testStatus === 'error' && (
            <p className="text-red-600">❌ Connection failed. Please check your API key.</p>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default ApiKeyManager;
