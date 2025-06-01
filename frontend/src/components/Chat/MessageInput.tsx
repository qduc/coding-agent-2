import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '../Common/Button';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  onHeightChange?: (height: number) => void;
}

export default function MessageInput({
  onSend,
  disabled = false,
  onHeightChange,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      onHeightChange?.(textareaRef.current.scrollHeight);
    }
  }, [message, onHeightChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
    }
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        className="flex-1 bg-gray-700 rounded-lg px-4 py-2 text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
        placeholder="Type a message..."
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <Button
        variant="primary"
        size="sm"
        onClick={handleSend}
        disabled={disabled || !message.trim()}
      >
        Send
      </Button>
    </div>
  );
}
