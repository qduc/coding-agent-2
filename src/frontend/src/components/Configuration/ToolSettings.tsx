import React from 'react';
import { Configuration } from './types';
import { Switch } from '../Common/Switch';
import { Checkbox } from '../Common/Checkbox';
import { ToolInfo } from '../../../shared/services/schemaAdapter';

interface ToolSettingsProps {
  config: Configuration['tools'];
  onChange: (config: Configuration['tools']) => void;
}

// Mock tool data - in a real app this would come from the backend
const availableTools: ToolInfo[] = [
  { name: 'file_search', description: 'Search files in the project' },
  { name: 'code_analysis', description: 'Analyze code structure' },
  { name: 'terminal', description: 'Run terminal commands' },
  { name: 'web_search', description: 'Search the web' },
];

const ToolSettings: React.FC<ToolSettingsProps> = ({
  config,
  onChange,
}) => {
  const toggleTool = (toolName: string) => {
    const newEnabled = config.enabled.includes(toolName)
      ? config.enabled.filter(name => name !== toolName)
      : [...config.enabled, toolName];
    
    onChange({
      ...config,
      enabled: newEnabled,
    });
  };

  const togglePermission = (permission: keyof Configuration['tools']['permissions']) => {
    onChange({
      ...config,
      permissions: {
        ...config.permissions,
        [permission]: !config.permissions[permission],
      },
    });
  };

  const toggleAllTools = (enable: boolean) => {
    onChange({
      ...config,
      enabled: enable ? availableTools.map(tool => tool.name) : [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Enabled Tools</h3>
        <div className="flex gap-2">
          <button 
            className="text-sm text-primary"
            onClick={() => toggleAllTools(true)}
          >
            Enable All
          </button>
          <button 
            className="text-sm text-primary"
            onClick={() => toggleAllTools(false)}
          >
            Disable All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {availableTools.map((tool) => (
          <div key={tool.name} className="flex items-center justify-between p-3 border rounded">
            <div>
              <h4 className="font-medium">{tool.name.replace(/_/g, ' ')}</h4>
              <p className="text-sm text-gray-600">{tool.description}</p>
            </div>
            <Switch
              checked={config.enabled.includes(tool.name)}
              onChange={() => toggleTool(tool.name)}
              aria-label={`Toggle ${tool.name}`}
            />
          </div>
        ))}
      </div>

      <div className="pt-4 border-t">
        <h3 className="font-medium mb-3">Tool Permissions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="file-system-permission">File System Access</label>
            <Switch
              id="file-system-permission"
              checked={config.permissions.fileSystem}
              onChange={() => togglePermission('fileSystem')}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="network-permission">Network Access</label>
            <Switch
              id="network-permission"
              checked={config.permissions.network}
              onChange={() => togglePermission('network')}
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="shell-permission">Shell Access</label>
            <Switch
              id="shell-permission"
              checked={config.permissions.shell}
              onChange={() => togglePermission('shell')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolSettings;
