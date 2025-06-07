import { Command } from 'commander';
import { Agent } from '../shared/core/agent';
import { CommanderInputHandler } from './implementations';
import { CLIToolExecutionContext } from './implementations';
import { configManager } from '../shared/core/config';
import chalk from 'chalk';
import { BoxRenderer } from '../shared/utils/boxRenderer';
import { MarkdownRenderer } from '../shared/utils/markdown';
import { calculateStreamingClearSequence } from '../shared/utils/terminalOutput';

/**
 * Configure the commander program with all available commands
 */
export function configureCommands(program: Command, version: string): void {
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

      // Create CLI implementations
      const toolContext = new CLIToolExecutionContext();
      const inputHandler = new CommanderInputHandler(toolContext);

      // Create and initialize agent with CLI implementations
      const agent = new Agent({
        toolContext
      });
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
        await startInteractiveMode(agent, options, shouldStream, inputHandler);
      }
    });
}

/**
 * Run the configuration setup wizard
 */
export async function runSetupWizard() {
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
 * Handle direct command execution
 */
export async function handleDirectCommand(command: string, agent: Agent, options: any, shouldStream: boolean = false) {
  if (options.verbose) {
    console.log(chalk.blue('Executing direct command:'), command);
  }

  // Enhanced visual hierarchy with better spacing
  console.log();
  console.log(BoxRenderer.createInfoBox('🤖 Coding Agent', ''));
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
export async function startInteractiveMode(agent: Agent, options: any, shouldStream: boolean = false, inputHandler?: CommanderInputHandler) {
  if (options.verbose) {
    console.log(chalk.blue('Starting interactive chat mode...'));
  }

  // Enhanced welcome with better visual hierarchy
  console.log();
  console.log(BoxRenderer.createInfoBox('🤖 Coding Agent - Interactive Mode', ''));
  console.log(chalk.cyan('🚀 Starting conversation session...'));
  console.log();

  try {
    if (options.verbose) {
      console.log(chalk.blue('🛠️  Registered tools:'), agent.getRegisteredTools().map(t => t.name).join(', '));
      console.log();
    }

    // Enhanced welcome message with better visual structure
    const welcomeContent = `• Type your questions about code or project
• Use @ for fuzzy file search, type to filter, Enter/Tab to select
• Use "/help" for suggestions
• Use "/exit" or "/quit" to leave
• Use Ctrl+C to exit anytime`;
    console.log(BoxRenderer.createInfoBox('💬 Welcome to Interactive Chat Mode', welcomeContent));
    console.log();

    // Set up graceful exit handler for Ctrl+C
    const handleExit = () => {
      console.log(chalk.yellow('\n👋 Goodbye! Thanks for using Coding Agent.'));
      process.exit(0);
    };
    process.on('SIGINT', handleExit);

    // Start chat loop using our enhanced input handler
    if (inputHandler) {
      await inputHandler.handleInteractiveMode(
        async (input: string) => {
          await processUserInput(input, agent, options, shouldStream);
        },
        () => {
          console.log(chalk.yellow('👋 Goodbye! Thanks for using Coding Agent.'));
        }
      );
    } else {
      console.error(chalk.red('Error: Input handler not available'));
      process.exit(1);
    }

    // Clean up signal handler
    process.removeListener('SIGINT', handleExit);

  } catch (error) {
    console.error(chalk.red('Failed to start interactive mode:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Process user input message
 */
export async function processUserInput(trimmedMessage: string, agent: Agent, options: any, shouldStream: boolean): Promise<boolean> {
  // Handle exit commands
  if (trimmedMessage.toLowerCase() === '/exit' ||
      trimmedMessage.toLowerCase() === '/quit' ||
      trimmedMessage.toLowerCase() === '/q') {
    return false; // Signal to exit
  }

  // Handle help command
  if (trimmedMessage.toLowerCase() === '/help') {
    displayChatHelp();
    return true; // Continue processing
  }

  // Handle clear command
  if (trimmedMessage.toLowerCase() === '/clear') {
    agent.clearHistory();
    console.log(chalk.green('✨ Chat history cleared. Context has been reset to initial state.'));
    return true; // Continue processing
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(BoxRenderer.createInfoBox('❌ Error', errorMessage));
    console.log(chalk.gray('💡 Try rephrasing your question or type "/help" for suggestions.'));
    console.log();
  }

  return true; // Continue processing
}

/**
 * Display chat help information
 */
export function displayChatHelp() {
  const helpContent = `Available Commands: (press TAB for auto-completion)
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
    "Show me the test files"

Tips:
    • Be specific about what you want to know
    • Use @ for fuzzy file search (like fzf)
    • Ask about files, directories, or patterns  
    • Use natural language - no special syntax`;

  console.log();
  console.log(BoxRenderer.createInfoBox('💡 Coding Agent Help', helpContent));
  console.log();
}

/**
 * Helper function to detect if content contains markdown and render it appropriately
 */
export function renderResponse(content: string): string {
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
