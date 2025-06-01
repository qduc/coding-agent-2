import React, { useState } from 'react';
import cn from '../../utils/cn';
import MessageMarkdown from './MessageMarkdown';
import { ToolExecution } from './types';

interface ToolExecutionDisplayProps {
  execution: ToolExecution;
}

export default function ToolExecutionDisplay({ execution }: ToolExecutionDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg p-4 my-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="font-medium">{execution.toolName}</span>
          {execution.status === 'running' && (
            <span className="text-xs text-gray-400">Running...</span>
          )}
          {execution.status === 'completed' && (
            <span className="text-xs text-gray-400">
              Completed in {execution.duration}ms
            </span>
          )}
          {execution.status === 'error' && (
            <span className="text-xs text-red-400">Failed</span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-gray-200"
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      {isExpanded && (
        <div className="mt-2">
          {execution.input && (
            <div className="mb-2">
              <div className="text-xs text-gray-400 mb-1">Input</div>
              <div className="bg-gray-900 p-2 rounded text-sm">
                <pre>{JSON.stringify(execution.input, null, 2)}</pre>
              </div>
            </div>
          )}
          {execution.output && (
            <div>
              <div className="text-xs text-gray-400 mb-1">Output</div>
              <MessageMarkdown content={execution.output} />
            </div>
          )}
          {execution.error && (
            <div className="text-red-400 text-sm mt-2">
              Error: {execution.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
