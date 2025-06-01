import React from 'react';
import { cn } from '../../utils/cn';
import MessageMarkdown from './MessageMarkdown';
import { ChatMessage } from './types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  return (
    <div
      className={cn(
        'flex',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'rounded-lg px-4 py-3 max-w-[85%]',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-700 text-gray-100',
          isStreaming && 'animate-pulse'
        )}
      >
        <MessageMarkdown content={message.content} />
        <div className="text-xs mt-1 opacity-70 flex justify-end">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {message.status === 'error' && ' • Failed'}
        </div>
      </div>
    </div>
  );
}
