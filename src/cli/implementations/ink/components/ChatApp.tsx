import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { ConversationDisplay, Message } from './ConversationDisplay';
import { InputComponent } from './InputComponent';
import { CompletionManager } from '../services/completion/CompletionManager';
import { ClipboardManager } from '../services/clipboard/ClipboardManager';
import { InputCallbacks, InputOptions } from '../types';
import { Agent } from '../../../../shared/core/agent';
import { toolEventEmitter, ToolEvent } from '../../../../shared/utils/toolEvents';
import { ToolLogger } from '../../../../shared/utils/toolLogger';

export interface ChatAppProps {
  agent: Agent;
  completionManager: CompletionManager;
  clipboardManager: ClipboardManager;
  options?: {
    verbose?: boolean;
    streaming?: boolean;
  };
  onExit?: () => void;
}

export const ChatApp: React.FC<ChatAppProps> = ({
  agent,
  completionManager,
  clipboardManager,
  options = {},
  onExit,
}) => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<{
    content: string;
    type: 'agent';
  } | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showToolLogs, setShowToolLogs] = useState(true);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    }]);
  }, []);

  // Handle tool events
  const handleToolEvent = useCallback((event: ToolEvent) => {
    if (!showToolLogs) return;

    if (event.type === 'tool_call') {
      const content = ToolLogger.formatToolCallForUI(event.toolName, event.args);
      addMessage({
        type: 'tool',
        content,
      });
    } else if (event.type === 'tool_result') {
      const content = ToolLogger.formatToolResultForUI(
        event.toolName, 
        event.success, 
        event.result, 
        event.args
      );
      addMessage({
        type: 'tool',
        content,
      });
    }
  }, [addMessage, showToolLogs]);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      exit();
    }
  }, [exit, onExit]);

  const handleUserInput = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    
    // Handle exit commands
    if (['exit', 'quit', 'q'].some(cmd => trimmedInput.toLowerCase() === `/${cmd}`)) {
      handleExit();
      return;
    }

    // Handle help command
    if (trimmedInput.toLowerCase() === '/help') {
      addMessage({
        type: 'system',
        content: `Multi-line Input Controls:
    Enter              - Add new line to your message
    Ctrl+V             - Paste from clipboard (cross-platform)
    Ctrl+Enter         - Send the complete message
    Esc                - Cancel and clear input
    ↑/↓                - Navigate file/command completions

Available Commands: (press TAB for auto-completion)
    /help              - Show this help
    /exit, /quit, /q   - Exit interactive mode
    /clear             - Clear chat history and reset context

File Completion (Fuzzy Search):
    @                  - Shows live file list, fuzzy search as you type
    @srcmp             - Matches "src/components" fuzzy style
    @pjs               - Matches "package.json" by initials

Example Questions:
    "Explain what this project does"
    "List files in the src directory"
    "Help me understand @src/main.ts"
    "What are the main components?"
    "Show me the test files"`,
      });
      return;
    }

    // Handle clear command
    if (trimmedInput.toLowerCase() === '/clear') {
      agent.clearHistory();
      setMessages([]);
      addMessage({
        type: 'system',
        content: '✨ Chat history cleared. Context has been reset to initial state.',
      });
      return;
    }

    // Hide welcome after first real interaction
    if (showWelcome) {
      setShowWelcome(false);
    }

    // Add user message
    addMessage({
      type: 'user',
      content: trimmedInput,
    });

    // Process with agent
    setIsProcessing(true);
    try {
      let accumulatedResponse = '';

      const response = await agent.processMessage(
        trimmedInput,
        options.streaming ? (chunk: string) => {
          accumulatedResponse += chunk;
          setStreamingMessage({
            content: accumulatedResponse,
            type: 'agent',
          });
        } : undefined,
        options.verbose
      );

      // Clear streaming state
      setStreamingMessage(undefined);

      // Add final response
      addMessage({
        type: 'agent',
        content: accumulatedResponse || response,
      });

    } catch (error) {
      setStreamingMessage(undefined);
      addMessage({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [agent, addMessage, handleExit, options, showWelcome]);

  const inputCallbacks: InputCallbacks = {
    onSubmit: handleUserInput,
    onExit: handleExit,
  };

  const inputOptions: InputOptions = {
    prompt: isProcessing 
      ? '🤖 Processing...' 
      : '💬 Your Message (Enter to send, Enter again for multi-line):',
    disabled: isProcessing,
  };

  // Set up tool event listener
  useEffect(() => {
    toolEventEmitter.onToolEvent(handleToolEvent);
    return () => {
      toolEventEmitter.offToolEvent(handleToolEvent);
    };
  }, [handleToolEvent]);

  // Set up global exit handler
  useEffect(() => {
    const handleSigInt = () => {
      handleExit();
    };

    process.on('SIGINT', handleSigInt);
    return () => {
      process.removeListener('SIGINT', handleSigInt);
    };
  }, [handleExit]);

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1} flexDirection="column" overflow="hidden">
        <ConversationDisplay
          messages={messages}
          streamingMessage={streamingMessage}
          showWelcome={showWelcome}
        />
      </Box>
      <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
        <InputComponent
          callbacks={inputCallbacks}
          options={inputOptions}
          completionManager={completionManager}
          clipboardManager={clipboardManager}
        />
      </Box>
    </Box>
  );
};