#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { configManager } from '../core/config';
import { Agent } from '../core/agent';
import { MarkdownRenderer } from '../utils/markdown';
import { calculateStreamingClearSequence } from '../utils/terminalOutput';

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

/**
 * Main CLI entry point for coding-agent
 * Supports both direct commands and interactive chat mode
 */
async function main() {
  try {
    program
      .name('coding-agent')
      .description('AI Programming Assistant - Natural language conversations for coding tasks')
      .version(version)
      .argument('[command]', 'Direct command to execute (e.g. "help me understand this file")')
      .option('-v, --verbose', 'Enable verbose output')
      .option('--no-color', 'Disable colored output')
      .option('--streaming', 'Enable response streaming (real-time output)')
      .option('--setup', 'Run configuration setup wizard')
      .option('--config', 'Show current configuration')
      .helpOption('-h, --help', 'Display help information')
      .action(async (command: string | undefined, options: any) => {
        // Handle colored output setting
        if (options.noColor) {
          chalk.level = 0;
        }

        // Handle setup wizard
        if (options.setup) {
          await runSetupWizard();
          return;
        }

        // Handle config display
        if (options.config) {
          configManager.displayConfig();
          return;
        }

        // Validate configuration before proceeding
        const validation = configManager.validate();
        if (!validation.isValid) {
          console.error(chalk.red('Configuration Error:'));
          validation.errors.forEach((error: string) => {
            console.error(chalk.red('  •'), error);
          });
          console.log();
          console.log(chalk.yellow('Run'), chalk.white('coding-agent --setup'), chalk.yellow('to configure the agent.'));
          process.exit(1);
        }

        // Handle streaming setting from CLI or config
        const shouldStream = options.streaming !== undefined ?
          options.streaming :
          configManager.getConfig().streaming;

        // Create and initialize agent
        const agent = new Agent();
        const initialized = await agent.initialize();
        if (!initialized) {
          console.error(chalk.red('Failed to initialize AI service.'));
          console.log(chalk.yellow('Run'), chalk.white('coding-agent --setup'), chalk.yellow('to configure the agent.'));
          process.exit(1);
        }

        if (command) {
          // Direct command mode
          await handleDirectCommand(command, agent, options, shouldStream);
        } else {
          // Interactive chat mode
          await startInteractiveMode(agent, options, shouldStream);
        }
      });

    // Parse command line arguments
    await program.parseAsync();
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Handle direct command execution
 */
async function handleDirectCommand(command: string, agent: Agent, options: any, shouldStream: boolean = false) {
  if (options.verbose) {
    console.log(chalk.blue('Executing direct command:'), command);
  }

  // Enhanced visual hierarchy with better spacing
  console.log();
  console.log(chalk.yellow('┌─────────────────────────────────────────────┐'));
  console.log(chalk.yellow('│') + chalk.yellow.bold('  🤖 Coding Agent') + chalk.yellow('                     │'));
  console.log(chalk.yellow('└─────────────────────────────────────────────┘'));
  console.log();
  console.log(chalk.cyan('📥 Request:'), chalk.white(command));
  console.log(chalk.gray('─'.repeat(50)));
  console.log();

  try {
    if (options.verbose) {
      console.log(chalk.blue('🛠️  Registered tools:'), agent.getRegisteredTools().map(t => t.name).join(', '));
      console.log();
    }

    // Enhanced status indicator
    console.log(chalk.cyan('🤖 Agent:'), chalk.gray('🔍 Analyzing your request...'));

    // Process message with the agent
    if (shouldStream) {
      // Handle streaming mode
      let accumulatedResponse = '';
      let hasStartedStreaming = false;

      const response = await agent.processMessage(
        command,
        (chunk) => {
          // On first chunk, clear status and start streaming
          if (!hasStartedStreaming) {
            process.stdout.write('\x1b[1A\x1b[2K'); // Clear status line
            console.log(chalk.cyan('🤖 Agent:'), chalk.gray('⚡ Responding...'));
            hasStartedStreaming = true;
          }

          // Accumulate response and display immediately
          accumulatedResponse += chunk;
          process.stdout.write(chunk);
        },
        options.verbose
      );

      // Add spacing after streaming
      console.log();
      console.log(chalk.gray('─'.repeat(50)));
      console.log();

      // If no content was streamed but we got a response, show it
      if (!hasStartedStreaming && response.trim()) {
        process.stdout.write('\x1b[1A\x1b[2K'); // Clear status line
        console.log(chalk.cyan('🤖 Agent:'), chalk.gray('💭 Here\'s what I found:'));
        console.log();
        console.log(renderResponse(response));
        console.log();
        console.log(chalk.gray('─'.repeat(50)));
        console.log();
      }
    } else {
      // Non-streaming mode
      const response = await agent.processMessage(
        command,
        undefined,
        options.verbose
      );

      // Clear status line and show enhanced response
      process.stdout.write('\x1b[1A\x1b[2K');
      console.log(chalk.cyan('🤖 Agent:'), chalk.gray('💭 Here\'s what I found:'));
      console.log();

      // Print the response with enhanced formatting
      console.log(renderResponse(response));
      console.log();
      console.log(chalk.gray('─'.repeat(50)));
      console.log();
    }

    if (options.verbose) {
      console.log(chalk.gray('Conversation summary:'));
      console.log(chalk.gray(agent.getConversationSummary()));
    }
  } catch (error) {
    console.error(chalk.red('Error processing command:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Start interactive chat mode
 */
async function startInteractiveMode(agent: Agent, options: any, shouldStream: boolean = false) {
  if (options.verbose) {
    console.log(chalk.blue('Starting interactive chat mode...'));
  }

  // Enhanced welcome with better visual hierarchy
  console.log();
  console.log(chalk.yellow('┌─────────────────────────────────────────────┐'));
  console.log(chalk.yellow('│') + chalk.yellow.bold('  🤖 Coding Agent - Interactive Mode') + chalk.yellow('     │'));
  console.log(chalk.yellow('└─────────────────────────────────────────────┘'));
  console.log();
  console.log(chalk.cyan('🚀 Starting conversation session...'));
  console.log();

  try {
    // Import inquirer dynamically
    const inquirer = await import('inquirer');

    if (options.verbose) {
      console.log(chalk.blue('🛠️  Registered tools:'), agent.getRegisteredTools().map(t => t.name).join(', '));
      console.log();
    }

    // Enhanced welcome message with better visual structure
    console.log(chalk.cyan('┌─ 💬 Welcome to Interactive Chat Mode ─────────┐'));
    console.log(chalk.cyan('│') + chalk.white('  • Type your questions about code or project  ') + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white('  • Use "help" for suggestions                 ') + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white('  • Use "exit" or "quit" to leave              ') + chalk.cyan('│'));
    console.log(chalk.cyan('│') + chalk.white('  • Use Ctrl+C to exit anytime                ') + chalk.cyan('│'));
    console.log(chalk.cyan('└───────────────────────────────────────────────┘'));
    console.log();

    // Set up graceful exit handler for Ctrl+C
    const handleExit = () => {
      console.log(chalk.yellow('\n👋 Goodbye! Thanks for using Coding Agent.'));
      process.exit(0);
    };
    process.on('SIGINT', handleExit);

    // Start chat loop
    while (true) {
      try {
        const { message } = await inquirer.default.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.green('You:'),
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Please enter a message or type "exit" to quit.';
              }
              return true;
            }
          }
        ]);

        const trimmedMessage = message.trim();

        // Handle exit commands
        if (trimmedMessage.toLowerCase() === 'exit' ||
            trimmedMessage.toLowerCase() === 'quit' ||
            trimmedMessage.toLowerCase() === 'q') {
          console.log(chalk.yellow('👋 Goodbye! Thanks for using Coding Agent.'));
          break;
        }

        // Handle help command
        if (trimmedMessage.toLowerCase() === 'help') {
          displayChatHelp();
          continue;
        }

        // Process the message with the AI
        try {
          console.log(chalk.cyan('🤖 Agent:'), chalk.gray('🔍 Analyzing your message...'));

          let accumulatedResponse = '';
          let hasStartedStreaming = false;
          let currentLine = '';

          if (shouldStream) {
            // Streaming mode
            const response = await agent.processMessage(
              trimmedMessage,
              (chunk: string) => {
                // Clear status and start streaming on first chunk
                if (!hasStartedStreaming) {
                  process.stdout.write('\x1b[1A\x1b[2K'); // Move up one line and clear it
                  process.stdout.write(chalk.cyan('🤖 Agent: ') + chalk.gray('⚡ '));
                  hasStartedStreaming = true;
                }

                // Accumulate content for final rendering
                accumulatedResponse += chunk;

                // Stream raw text in real-time for immediate feedback
                process.stdout.write(chunk);
                currentLine += chunk;

                // Track current line for proper cursor positioning
                if (chunk.includes('\n')) {
                  currentLine = '';
                }
              },
              options.verbose
            );

            // Replace raw streaming output with formatted version
            if (hasStartedStreaming && accumulatedResponse.trim()) {
              const terminalWidth = process.stdout.columns || 80;
              const agentPrefix = '🤖 Agent: ⚡ ';

              // Calculate and execute the clearing sequence
              const clearSequence = calculateStreamingClearSequence(
                accumulatedResponse,
                terminalWidth,
                agentPrefix
              );
              process.stdout.write(clearSequence);

              // Show enhanced formatted response
              console.log(chalk.cyan('🤖 Agent:'), chalk.gray('💭 Here\'s what I found:'));
              console.log();
              console.log(renderResponse(accumulatedResponse));
              console.log();
              console.log(chalk.gray('─'.repeat(Math.min(50, process.stdout.columns || 50))));
            } else if (!hasStartedStreaming) {
              // No streaming occurred (tools only), show complete response
              process.stdout.write('\x1b[1A\x1b[2K'); // Clear status line
              console.log(chalk.cyan('🤖 Agent:'), chalk.gray('💭 Here\'s what I found:'));
              console.log();
              console.log(renderResponse(response));
              console.log();
              console.log(chalk.gray('─'.repeat(Math.min(50, process.stdout.columns || 50))));
            }
          } else {
            // Non-streaming mode
            const response = await agent.processMessage(
              trimmedMessage,
              undefined,
              options.verbose
            );

            // Clear status line and show enhanced response
            process.stdout.write('\x1b[1A\x1b[2K');
            console.log(chalk.cyan('🤖 Agent:'), chalk.gray('💭 Here\'s what I found:'));
            console.log();

            // Show formatted response
            console.log(renderResponse(response));
            console.log();
            console.log(chalk.gray('─'.repeat(Math.min(50, process.stdout.columns || 50))));
          }

          console.log(); // Add spacing for next input

        } catch (error) {
          console.log(); // Clear the status line
          console.log(chalk.red('┌─ ❌ Error ─────────────────────────────────┐'));
          console.log(chalk.red('│'), chalk.white(error instanceof Error ? error.message : 'Unknown error'), chalk.red('│'));
          console.log(chalk.red('└───────────────────────────────────────────┘'));
          console.log(chalk.gray('💡 Try rephrasing your question or type "help" for suggestions.'));
          console.log();
        }
      } catch (promptError: any) {
        // Handle Ctrl+C or other prompt interruptions
        if (promptError.name === 'ExitPromptError' || promptError.isTTYError) {
          handleExit();
        } else {
          throw promptError;
        }
      }
    }

    // Clean up signal handler
    process.removeListener('SIGINT', handleExit);

  } catch (error) {
    console.error(chalk.red('Failed to start interactive mode:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Run the configuration setup wizard
 */
async function runSetupWizard() {
  try {
    await configManager.setupWizard();

    // Test the connection after setup
    console.log(chalk.blue('Testing connection...'));
    const agent = new Agent();
    const initialized = await agent.initialize();

    if (initialized) {
      console.log(chalk.green('✅ Setup complete! Your coding agent is ready to use.'));
      console.log();
      console.log(chalk.white('Try it out:'));
      console.log(chalk.gray('  coding-agent "help me understand this project"'));
    } else {
      console.log(chalk.red('❌ Setup completed but connection test failed.'));
      console.log(chalk.yellow('Please check your API key and try again.'));
    }
  } catch (error) {
    console.error(chalk.red('Setup failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Display welcome banner
 */
function displayBanner() {
  console.log(chalk.yellow.bold('🤖 Coding Agent'));
  console.log(chalk.gray('AI Programming Assistant v' + version));
  console.log();
}

/**
 * Display chat help information
 */
function displayChatHelp() {
  console.log();
  console.log(chalk.yellow('┌─ 💡 Coding Agent Help ────────────────────────┐'));
  console.log(chalk.yellow('│                                               │'));
  console.log(chalk.yellow('│') + chalk.white.bold('  Available Commands:') + chalk.yellow('                        │'));
  console.log(chalk.yellow('│') + chalk.gray('    help               - Show this help') + chalk.yellow('       │'));
  console.log(chalk.yellow('│') + chalk.gray('    exit, quit, q      - Exit interactive mode') + chalk.yellow(' │'));
  console.log(chalk.yellow('│                                               │'));
  console.log(chalk.yellow('│') + chalk.white.bold('  Example Questions:') + chalk.yellow('                         │'));
  console.log(chalk.yellow('│') + chalk.gray('    "Explain what this project does"') + chalk.yellow('          │'));
  console.log(chalk.yellow('│') + chalk.gray('    "List files in the src directory"') + chalk.yellow('         │'));
  console.log(chalk.yellow('│') + chalk.gray('    "Help me understand this error"') + chalk.yellow('           │'));
  console.log(chalk.yellow('│') + chalk.gray('    "What are the main components?"') + chalk.yellow('           │'));
  console.log(chalk.yellow('│') + chalk.gray('    "Show me the test files"') + chalk.yellow('                │'));
  console.log(chalk.yellow('│                                               │'));
  console.log(chalk.yellow('│') + chalk.white.bold('  Tips:') + chalk.yellow('                                      │'));
  console.log(chalk.yellow('│') + chalk.gray('    • Be specific about what you want to know') + chalk.yellow('  │'));
  console.log(chalk.yellow('│') + chalk.gray('    • Ask about files, directories, or patterns') + chalk.yellow(' │'));
  console.log(chalk.yellow('│') + chalk.gray('    • Use natural language - no special syntax') + chalk.yellow('  │'));
  console.log(chalk.yellow('└───────────────────────────────────────────────┘'));
  console.log();
}

/**
 * Helper function to detect if content contains markdown and render it appropriately
 */
function renderResponse(content: string): string {
  // Simple heuristic to detect markdown content
  const hasMarkdown = /[#*`_\[\]()-]/.test(content) ||
                     content.includes('```') ||
                     content.includes('**') ||
                     content.includes('##') ||
                     content.includes('- ');

  if (hasMarkdown) {
    try {
      return MarkdownRenderer.renderWithCodeHighlight(content);
    } catch (error) {
      // Fallback to plain text if markdown rendering fails
      return content;
    }
  }

  return content;
}

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\nUnexpected error:'), error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\nUnhandled promise rejection:'), reason);
  process.exit(1);
});

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

export { main };
