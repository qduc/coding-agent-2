import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownRenderer } from '../../../../shared/utils/markdown';

export interface Message {
  id: string;
  type: 'user' | 'agent' | 'system' | 'error' | 'tool';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface ConversationDisplayProps {
  messages: Message[];
  streamingMessage?: {
    content: string;
    type: 'agent';
  };
  showWelcome?: boolean;
}

export const ConversationDisplay: React.FC<ConversationDisplayProps> = ({
  messages,
  streamingMessage,
  showWelcome = false,
}) => {
  const renderMessage = (message: Message) => {
    const prefix = getMessagePrefix(message.type);
    const color = getMessageColor(message.type);

    return (
      <Box key={message.id} flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={color} bold>
            {prefix}
          </Text>
          <Text> </Text>
          <MessageContent content={message.content} type={message.type} />
        </Box>
        <Box>
          <Text color="gray">─{Array(48).fill('─').join('')}</Text>
        </Box>
      </Box>
    );
  };

  const renderStreamingMessage = () => {
    if (!streamingMessage) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="cyan" bold>🤖 Agent:</Text>
          <Text color="gray"> ⚡ </Text>
          <MessageContent content={streamingMessage.content} type="agent" />
        </Box>
      </Box>
    );
  };

  const renderWelcome = () => {
    if (!showWelcome) return null;

    return (
      <Box flexDirection="column" marginBottom={2}>
        <Box borderStyle="round" borderColor="cyan" padding={1}>
          <Box flexDirection="column">
            <Text color="cyan" bold>💬 Welcome to Interactive Chat Mode</Text>
            <Text> </Text>
            <Text>• Type your questions about code or project</Text>
            <Text>• Press Enter for new lines, Ctrl+V to paste, Ctrl+Enter to send</Text>
            <Text>• Use @ for fuzzy file search, type to filter, Enter/Tab to select</Text>
            <Text>• Use "/help" for suggestions, "/exit" or "/quit" to leave</Text>
            <Text>• Use Esc or Ctrl+C to exit anytime</Text>
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {renderWelcome()}
      {messages.map(renderMessage)}
      {renderStreamingMessage()}
    </Box>
  );
};

const MessageContent: React.FC<{ content: string; type: Message['type'] }> = ({ content, type }) => {
  // For agent messages, try to render markdown if detected
  if (type === 'agent' && hasMarkdown(content)) {
    try {
      const renderedMarkdown = MarkdownRenderer.render(content);
      // Ink's Text component can handle ANSI escape codes from chalk
      return <Text>{renderedMarkdown}</Text>;
    } catch (error) {
      // Fallback to plain text if markdown rendering fails
      console.warn('Markdown rendering failed:', error);
      return <Text>{content}</Text>;
    }
  }

  return <Text>{content}</Text>;
};

function getMessagePrefix(type: Message['type']): string {
  switch (type) {
    case 'user': return '👤 You:';
    case 'agent': return '🤖 Agent:';
    case 'system': return 'ℹ️ System:';
    case 'error': return '❌ Error:';
    case 'tool': return '🔧 Tool:';
    default: return '💬';
  }
}

function getMessageColor(type: Message['type']): string {
  switch (type) {
    case 'user': return 'blue';
    case 'agent': return 'cyan';
    case 'system': return 'yellow';
    case 'error': return 'red';
    case 'tool': return 'magenta';
    default: return 'white';
  }
}

function hasMarkdown(content: string): boolean {
  // Enhanced detection for more markdown patterns
  return /[#*`_\[\]()-]/.test(content) ||
         content.includes('```') ||
         content.includes('**') ||
         content.includes('##') ||
         content.includes('- ') ||
         content.includes('* ') ||
         content.includes('+ ') ||
         content.includes('> ') ||
         /^\d+\. /.test(content) ||
         content.includes('---') ||
         content.includes('___') ||
         /^\s*[-*+]\s/.test(content) ||
         /^\s*\d+\.\s/.test(content) ||
         /^\s*#{1,6}\s/.test(content);
}