import { ToolExecution } from '../Chat/types';
import StreamingIndicator from '../Chat/StreamingIndicator';

interface ToolStatusProps {
  currentTools: ToolExecution[];
  className?: string;
}

export function ToolStatus({ currentTools, className }: ToolStatusProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {currentTools.map((tool) => (
        <div key={tool.id} className="p-2 border rounded">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{tool.toolName}</h3>
            <span className={`text-xs px-2 py-1 rounded ${
              tool.status === 'completed' ? 'bg-green-100 text-green-800' :
              tool.status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {tool.status}
            </span>
          </div>

          {tool.status === 'running' && <StreamingIndicator />}

          {tool.error && (
            <div className="mt-1 text-sm text-red-600">{tool.error}</div>
          )}

          {tool.output && (
            <div className="mt-1 text-sm text-gray-600">
              <pre className="whitespace-pre-wrap">{tool.output}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
