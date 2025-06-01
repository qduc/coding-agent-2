import React, { useState, useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ToolExecutionDisplay from './ToolExecutionDisplay';
import { ChatMessage, ToolExecution } from './types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  toolExecutions?: ToolExecution[];
  isStreaming?: boolean;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  toolExecutions = [],
  isStreaming = false,
  isLoading = false,
  error = null,
  className = '',
}: ChatInterfaceProps) {
  const [inputHeight, setInputHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, toolExecutions]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 overflow-hidden relative">
        <div ref={containerRef} className="h-full overflow-y-auto">
          <MessageList messages={messages} isStreaming={isStreaming} />
          {toolExecutions.map((execution) => (
            <ToolExecutionDisplay key={execution.id} execution={execution} />
          ))}
          {isLoading && <div className="p-4 text-center text-gray-500">Loading...</div>}
          {error && (
            <div className="p-4 text-center text-red-500">
              Error: {error}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-gray-700 p-4" style={{ minHeight: `${inputHeight}px` }}>
        <MessageInput
          onSend={onSendMessage}
          disabled={isLoading || isStreaming}
          onHeightChange={setInputHeight}
        />
      </div>
    </div>
  );
}
