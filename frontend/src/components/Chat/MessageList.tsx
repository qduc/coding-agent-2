import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import { ChatMessage } from './types';
import { cn } from '../../utils/cn';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

export default function MessageList({ messages, isStreaming = false }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isStreaming]); // Rerun when messages or streaming status changes

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((message, index) => {
        const showTimestamp = index === 0 ||
          new Date(message.timestamp).getTime() -
          new Date(messages[index - 1].timestamp).getTime() > 5 * 60 * 1000;
        
        // Animate if this message is one of the newly added ones
        const isNewMessage = index >= prevMessagesLengthRef.current;
        const animationClass = isNewMessage ? 'animate-fade-in-slide-up' : '';

        return (
          // Wrap each message and its potential timestamp in a div for animation
          <div key={message.id} className={cn(animationClass, 'motion-reduce:animate-none')}>
            {showTimestamp && (
              <div className="text-center text-xs text-gray-500 my-2">
                {new Date(message.timestamp).toLocaleString()}
              </div>
            )}
            <MessageBubble message={message} />
          </div>
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
