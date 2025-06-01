import React from 'react';
import { Configuration } from './types';
import { Select } from '../Common/Select';
import { Switch } from '../Common/Switch';
import { RadioGroup } from '../Common/RadioGroup';

interface PreferencesPanelProps {
  config: Configuration['preferences'];
  onChange: (config: Configuration['preferences']) => void;
}

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({
  config,
  onChange,
}) => {
  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    onChange({
      ...config,
      theme,
    });
  };

  const handleChatSettingChange = (key: keyof Configuration['preferences']['chat'], value: boolean) => {
    onChange({
      ...config,
      chat: {
        ...config.chat,
        [key]: value,
      },
    });
  };

  const handleFileExplorerChange = (
    key: keyof Configuration['preferences']['fileExplorer'], 
    value: any
  ) => {
    onChange({
      ...config,
      fileExplorer: {
        ...config.fileExplorer,
        [key]: value,
      },
    });
  };

  const handlePerformanceChange = (
    key: keyof Configuration['preferences']['performance'], 
    value: boolean
  ) => {
    onChange({
      ...config,
      performance: {
        ...config.performance,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Appearance</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Theme</label>
            <RadioGroup
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              value={config.theme}
              onChange={handleThemeChange}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h3 className="font-medium mb-3">Chat Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="auto-scroll">Auto-scroll to new messages</label>
            <Switch
              id="auto-scroll"
              checked={config.chat.autoScroll}
              onChange={(checked) => handleChatSettingChange('autoScroll', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="show-timestamps">Show timestamps</label>
            <Switch
              id="show-timestamps"
              checked={config.chat.showTimestamps}
              onChange={(checked) => handleChatSettingChange('showTimestamps', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="message-bubbles">Use message bubbles</label>
            <Switch
              id="message-bubbles"
              checked={config.chat.messageBubbles}
              onChange={(checked) => handleChatSettingChange('messageBubbles', checked)}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h3 className="font-medium mb-3">File Explorer</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="view-mode" className="block text-sm font-medium mb-1">
              View Mode
            </label>
            <Select
              id="view-mode"
              value={config.fileExplorer.viewMode}
              onChange={(e) => handleFileExplorerChange('viewMode', e.target.value)}
              options={[
                { value: 'grid', label: 'Grid' },
                { value: 'list', label: 'List' },
              ]}
            />
          </div>
          <div>
            <label htmlFor="sort-by" className="block text-sm font-medium mb-1">
              Sort By
            </label>
            <Select
              id="sort-by"
              value={config.fileExplorer.sortBy}
              onChange={(e) => handleFileExplorerChange('sortBy', e.target.value)}
              options={[
                { value: 'name', label: 'Name' },
                { value: 'modified', label: 'Modified Date' },
                { value: 'size', label: 'Size' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="sort-direction">Sort Direction</label>
            <Switch
              id="sort-direction"
              checked={config.fileExplorer.sortDirection === 'desc'}
              onChange={(checked) => handleFileExplorerChange(
                'sortDirection', 
                checked ? 'desc' : 'asc'
              )}
              label={config.fileExplorer.sortDirection === 'desc' ? 'Descending' : 'Ascending'}
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t">
        <h3 className="font-medium mb-3">Performance</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="cache-responses">Cache API responses</label>
            <Switch
              id="cache-responses"
              checked={config.performance.cacheResponses}
              onChange={(checked) => handlePerformanceChange('cacheResponses', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="lazy-load-images">Lazy load images</label>
            <Switch
              id="lazy-load-images"
              checked={config.performance.lazyLoadImages}
              onChange={(checked) => handlePerformanceChange('lazyLoadImages', checked)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
