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
import { configManager } from '../../../../shared/core/config';
import { ApprovalProvider } from '../../../approval/ApprovalContext';

export interface ChatAppProps {
  agent: Agent;
  completionManager: CompletionManager;
  clipboardManager: ClipboardManager;
  options?: {
    verbose?: boolean;
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showToolLogs, setShowToolLogs] = useState(true);
  const [verboseToolLogs, setVerboseToolLogs] = useState(false);
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
      // Show tool start immediately
      const content = ToolLogger.formatToolOperationFull(event.toolName, event.args);
      if (content.trim()) {
        addMessage({
          type: 'tool_call',
          content,
        });
      }
    } else if (event.type === 'tool_result') {
      if (verboseToolLogs) {
        // Verbose mode: show detailed information
        const callInfo = ToolLogger.formatToolCallForUI(event.toolName, event.args);
        const resultInfo = ToolLogger.formatToolResultForUI(event.toolName, event.success, event.result, event.args);

        addMessage({
          type: 'tool_call',
          content: `🔧 ${callInfo}`,
        });

        // Show arguments if they exist
        if (event.args && Object.keys(event.args).length > 0) {
          const argsContent = Object.entries(event.args)
            .map(([key, value]) => {
              if (typeof value === 'string' && value.length > 200) {
                return `  ${key}: [${value.length} characters]`;
              } else if (typeof value === 'object') {
                return `  ${key}: ${JSON.stringify(value, null, 2).substring(0, 200)}...`;
              }
              return `  ${key}: ${value}`;
            })
            .join('\n');
          addMessage({
            type: 'tool_call',
            content: `📋 Arguments:\n${argsContent}`,
          });
        }

        // Show result details
        addMessage({
          type: 'tool_call',
          content: `📤 ${resultInfo}`,
        });

        // Show error details if failed
        if (!event.success && event.result) {
          let errorDetails = '';
          if (event.result instanceof Error) {
            errorDetails = event.result.message;
            if (event.result.stack) {
              errorDetails += `\nStack: ${event.result.stack.substring(0, 500)}...`;
            }
          } else if (typeof event.result === 'string') {
            errorDetails = event.result;
          } else if (typeof event.result === 'object') {
            errorDetails = JSON.stringify(event.result, null, 2);
          }

          if (errorDetails) {
            addMessage({
              type: 'error',
              content: `❌ Error Details:\n${errorDetails}`,
            });
          }
        }
      } else {
        // Normal mode: show the completion result
        const content = ToolLogger.formatToolOperationFull(
          event.toolName,
          event.args,
          event.success,
          event.result
        );
        if (content.trim()) {
          addMessage({
            type: 'tool_call',
            content,
          });
        }
      }
    }
  }, [addMessage, showToolLogs, verboseToolLogs]);

  const handleExit = useCallback(() => {
    if (onExit) {
      onExit();
    } else {
      exit();
    }
  }, [exit, onExit]);

  const commandHandlers: { [key: string]: () => Promise<void> | void } = {
    '/exit': () => handleExit(),
    '/quit': () => handleExit(),
    '/q': () => handleExit(),
    '/help': () => {
      addMessage({
        type: 'system',
        content: `Multi-line Input Controls:
    Enter              - Add new line to your message
    Ctrl+V             - Paste from clipboard (cross-platform)
    Ctrl+Enter         - Send the complete message
    Esc                - Interrupt/cancel current operation or clear input
    Ctrl+C             - Exit the app (works anytime, even during processing)
    ↑/↓                - Navigate file/command completions

Available Commands: (press TAB for auto-completion)
    /help              - Show this help
    /exit, /quit, /q   - Exit interactive mode
    /clear             - Clear chat history and refresh project context
    /refresh           - Refresh project context without clearing history
    /tools             - Toggle tool logging on/off
    /verbose-tools     - Toggle verbose tool logging (shows detailed breakdown)

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
    },
    '/clear': async () => {
      setIsProcessing(true);
      try {
        await agent.clearHistoryAndRefresh();
        setMessages([]);
        addMessage({
          type: 'system',
          content: '✨ Chat history cleared and project context refreshed. Starting fresh!',
        });
      } catch (error) {
        addMessage({
          type: 'error',
          content: `Failed to refresh project context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    '/refresh': async () => {
      setIsProcessing(true);
      try {
        await agent.refreshProjectContext();
        addMessage({
          type: 'system',
          content: '🔄 Project context refreshed successfully. I now have updated information about your project.',
        });
      } catch (error) {
        addMessage({
          type: 'error',
          content: `Failed to refresh project context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    '/verbose-tools': () => {
      setVerboseToolLogs(!verboseToolLogs);
      addMessage({
        type: 'system',
        content: `🔧 Verbose tool logging ${!verboseToolLogs ? 'enabled' : 'disabled'}. Tool calls will now show ${!verboseToolLogs ? 'detailed breakdown with arguments and results' : 'clean, minimalistic format'}.`,
      });
    },
    '/tools': () => {
      setShowToolLogs(!showToolLogs);
      addMessage({
        type: 'system',
        content: `🔧 Tool logging ${!showToolLogs ? 'enabled' : 'disabled'}. Tool calls will ${!showToolLogs ? 'now be shown' : 'no longer be displayed'} in the chat.`,
      });
    },
  };

  const handleUserInput = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    const lowerInput = trimmedInput.toLowerCase();

    // Check if input matches a command
    if (commandHandlers[lowerInput]) {
      const result = commandHandlers[lowerInput]();
      if (result instanceof Promise) {
        await result;
      }
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
      const response = await agent.processMessage(
        trimmedInput,
        undefined,
        options.verbose
      );
      addMessage({
        type: 'agent',
        content: response,
      });
    } catch (error) {
      addMessage({
        type: 'error',
        content: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [agent, addMessage, handleExit, options, showWelcome, verboseToolLogs, showToolLogs]);

  const handleInterrupt = useCallback(() => {
    if (isProcessing) {
      // Cancel the current operation
      setIsProcessing(false);

      // Add a message to indicate interruption
      addMessage({
        type: 'system',
        content: '⚠️ Operation interrupted. What would you like to do next?',
      });
    }
  }, [isProcessing, addMessage]);

  const inputCallbacks: InputCallbacks = {
    onSubmit: handleUserInput,
    onExit: handleExit,
    onInterrupt: handleInterrupt,
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
    <ApprovalProvider>
      <Box flexDirection="column" height="100%">
        <Box flexGrow={1} flexDirection="column" overflow="hidden">
          <ConversationDisplay
            messages={messages}
            showWelcome={showWelcome}
            isProcessing={isProcessing}
          />
        </Box>
        <InputComponent
          callbacks={inputCallbacks}
          options={inputOptions}
          completionManager={completionManager}
          clipboardManager={clipboardManager}
        />
      </Box>
    </ApprovalProvider>
  );
};
