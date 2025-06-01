import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { ChatMessage } from './types';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

export default function MessageList({ messages, isStreaming = false }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((message, index) => {
        const showTimestamp = index === 0 ||
          new Date(message.timestamp).getTime() -
          new Date(messages[index - 1].timestamp).getTime() > 5 * 60 * 1000;

        return (
          <React.Fragment key={message.id}>
            {showTimestamp && (
              <div className="text-center text-xs text-gray-500 my-2">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            )}
            <MessageBubble message={message} />
          </React.Fragment>
        );
      })}
      {isStreaming && (
        <MessageBubble
          message={{
            id: 'streaming',
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            status: 'streaming',
          }}
        />
      )}
      <div ref={endRef} />
    </div>
  );
}
