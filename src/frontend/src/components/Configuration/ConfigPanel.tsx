import React, { useState, useEffect } from 'react';
import { Configuration, ConfigTab, ConfigValidationError } from './types';
import ProviderSelector from './ProviderSelector';
import ApiKeyManager from './ApiKeyManager';
import ToolSettings from './ToolSettings';
import PreferencesPanel from './PreferencesPanel';
import { Button } from '../Common/Button';
import { Dialog } from '../Common/Dialog';

interface ConfigPanelProps {
  initialConfig: Configuration;
  onSave: (config: Configuration) => Promise<void>;
  onReset?: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
  initialConfig,
  onSave,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('provider');
  const [config, setConfig] = useState<Configuration>(initialConfig);
  const [errors, setErrors] = useState<ConfigValidationError[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    setIsDirty(JSON.stringify(config) !== JSON.stringify(initialConfig));
  }, [config, initialConfig]);

  const handleChange = (section: keyof Configuration, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: value,
    }));
  };

  const validate = (): boolean => {
    const newErrors: ConfigValidationError[] = [];
    
    if (!config.provider.model) {
      newErrors.push({ field: 'provider.model', message: 'Model is required' });
    }

    if (config.apiKeys[config.provider.name]?.trim() === '') {
      newErrors.push({ 
        field: `apiKeys.${config.provider.name}`, 
        message: 'API key is required for selected provider' 
      });
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    try {
      await onSave(config);
      setIsDirty(false);
      setShowSaveDialog(false);
    } catch (error) {
      setErrors([...errors, {
        field: 'general',
        message: 'Failed to save configuration'
      }]);
    }
  };

  const handleReset = () => {
    setConfig(initialConfig);
    setErrors([]);
    onReset?.();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'provider':
        return (
          <ProviderSelector
            config={config.provider}
            onChange={(value) => handleChange('provider', value)}
            errors={errors.filter(e => e.field.startsWith('provider'))}
          />
        );
      case 'apiKeys':
        return (
          <ApiKeyManager
            config={config.apiKeys}
            activeProvider={config.provider.name}
            onChange={(value) => handleChange('apiKeys', value)}
            errors={errors.filter(e => e.field.startsWith('apiKeys'))}
          />
        );
      case 'tools':
        return (
          <ToolSettings
            config={config.tools}
            onChange={(value) => handleChange('tools', value)}
          />
        );
      case 'preferences':
        return (
          <PreferencesPanel
            config={config.preferences}
            onChange={(value) => handleChange('preferences', value)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b">
        {(['provider', 'apiKeys', 'tools', 'preferences'] as ConfigTab[]).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 font-medium ${activeTab === tab ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            aria-controls={`${tab}-panel`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4" id={`${activeTab}-panel`}>
        {renderTabContent()}
      </div>

      <div className="flex justify-end gap-2 p-4 border-t">
        <Button variant="ghost" onClick={handleReset} disabled={!isDirty}>
          Reset
        </Button>
        <Button 
          variant="primary" 
          onClick={() => setShowSaveDialog(true)} 
          disabled={!isDirty}
        >
          Save Changes
        </Button>
      </div>

      <Dialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        title="Confirm Changes"
        actions={[
          { label: 'Cancel', onClick: () => setShowSaveDialog(false) },
          { label: 'Save', onClick: handleSave, variant: 'primary' },
        ]}
      >
        <p>Are you sure you want to save these configuration changes?</p>
        {errors.some(e => e.field === 'general') && (
          <p className="text-red-500 mt-2">
            {errors.find(e => e.field === 'general')?.message}
          </p>
        )}
      </Dialog>
    </div>
  );
};

export default ConfigPanel;
