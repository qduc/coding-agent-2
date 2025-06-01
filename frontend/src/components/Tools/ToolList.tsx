import { ToolExecution } from '../Chat/types';
import { Button } from '../Common/Button';

interface ToolListProps {
  availableTools: Array<{
    name: string;
    description: string;
    enabled: boolean;
  }>;
  onToggleTool: (name: string, enabled: boolean) => void;
  className?: string;
}

export function ToolList({ availableTools, onToggleTool, className }: ToolListProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {availableTools.map((tool) => (
        <div key={tool.name} className="flex items-center justify-between p-2 border rounded">
          <div>
            <h3 className="font-medium">{tool.name}</h3>
            <p className="text-sm text-gray-500">{tool.description}</p>
          </div>
          <Button
            variant={tool.enabled ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onToggleTool(tool.name, !tool.enabled)}
          >
            {tool.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      ))}
    </div>
  );
}
