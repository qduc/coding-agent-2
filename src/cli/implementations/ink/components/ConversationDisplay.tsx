import React from 'react';
import { Box, Text } from 'ink';
import { MarkdownRenderer } from '../../../../shared/utils/markdown';
import { ProcessingSpinner, TypingSpinner } from './Spinner';

export interface Message {
  id: string;
  type: 'user' | 'agent' | 'system' | 'error' | 'tool_call' | 'tool_result';
  content: string;
  timestamp: Date;
  streaming?: boolean;
  toolData?: {
    toolName: string;
    args?: any;
    result?: any;
    success?: boolean;
    duration?: number;
    error?: string;
  };
}

export interface ConversationDisplayProps {
  messages: Message[];
  streamingMessage?: {
    content: string;
    type: 'agent';
  };
  showWelcome?: boolean;
  isProcessing?: boolean;
}

export const ConversationDisplay: React.FC<ConversationDisplayProps> = ({
  messages,
  streamingMessage,
  showWelcome = false,
  isProcessing = false,
}) => {
  const renderMessage = (message: Message) => {
    const prefix = getMessagePrefix(message.type);
    const color = getMessageColor(message.type);

    // Special rendering for tool calls and results
    if (message.type === 'tool_call' || message.type === 'tool_result') {
      return (
        <Box key={message.id} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={color} bold>
              {prefix}
            </Text>
            <Text> </Text>
            <ToolMessage message={message} />
          </Box>
          <Box>
            <Text color="gray">─{Array(48).fill('─').join('')}</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box key={message.id} flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
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
          <Text> </Text>
          <TypingSpinner active={true} />
          <Text> </Text>
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

  const renderProcessingIndicator = () => {
    // Show processing spinner only when processing but not streaming (streaming has its own animation)
    if (!isProcessing || streamingMessage) return null;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color="cyan" bold>🤖 Agent:</Text>
          <Text> </Text>
          <ProcessingSpinner active={true} />
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {renderWelcome()}
      {messages.map(renderMessage)}
      {renderStreamingMessage()}
      {renderProcessingIndicator()}
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

// New component for rendering tool messages with enhanced information
const ToolMessage: React.FC<{ message: Message }> = ({ message }) => {
  const { toolData } = message;

  if (!toolData) {
    return <Text>{message.content}</Text>;
  }

  if (message.type === 'tool_call') {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="magenta" bold>{toolData.toolName}</Text>
          <Text color="gray"> with input:</Text>
        </Box>
        <Box marginLeft={2}>
          <Text color="white">
            {JSON.stringify(toolData.args, null, 2)}
          </Text>
        </Box>
      </Box>
    );
  }

  if (message.type === 'tool_result') {
    const statusColor = toolData.success ? 'green' : 'red';
    const statusIcon = toolData.success ? '✅' : '❌';

    return (
      <Box flexDirection="column">
        <Box>
          <Text color="magenta" bold>{toolData.toolName}</Text>
          <Text color={statusColor}> {statusIcon} {toolData.success ? 'completed' : 'failed'}</Text>
          {toolData.duration && (
            <Text color="gray"> ({toolData.duration}ms)</Text>
          )}
        </Box>

        {toolData.error && (
          <Box marginLeft={2} marginTop={1}>
            <Text color="red" bold>Error: </Text>
            <Text color="red">{toolData.error}</Text>
          </Box>
        )}

        {toolData.result && !toolData.error && (
          <Box marginLeft={2} marginTop={1}>
            <Text color="gray">Result:</Text>
            <Box marginLeft={1}>
              <Text color="white">
                {typeof toolData.result === 'string'
                  ? toolData.result.length > 200
                    ? `${toolData.result.substring(0, 200)}...`
                    : toolData.result
                  : JSON.stringify(toolData.result, null, 2).length > 200
                    ? `${JSON.stringify(toolData.result, null, 2).substring(0, 200)}...`
                    : JSON.stringify(toolData.result, null, 2)
                }
              </Text>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return <Text>{message.content}</Text>;
};

function getMessagePrefix(type: Message['type']): string {
  switch (type) {
    case 'user': return '👤 You:';
    case 'agent': return '🤖 Agent:';
    case 'system': return 'ℹ️ System:';
    case 'error': return '❌ Error:';
    case 'tool_call': return '🚀 Calling:';
    case 'tool_result': return '📋 Result:';
    default: return '💬';
  }
}

function getMessageColor(type: Message['type']): string {
  switch (type) {
    case 'user': return 'blue';
    case 'agent': return 'cyan';
    case 'system': return 'yellow';
    case 'error': return 'red';
    case 'tool_call': return 'magenta';
    case 'tool_result': return 'magenta';
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