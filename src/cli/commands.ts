import { Command } from 'commander';
import { Agent } from '../shared/core/agent';
import { InkInputHandler } from './implementations';
import { InkChatHandler } from './implementations/ink/InkChatHandler';
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
        // Interactive chat mode - use full Ink control
        await startInteractiveMode(agent, options, shouldStream, toolContext);
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
 * Start interactive chat mode with full Ink control
 */
export async function startInteractiveMode(agent: Agent, options: any, shouldStream: boolean = false, toolContext: CLIToolExecutionContext) {
  if (options.verbose) {
    console.log(chalk.blue('Starting interactive chat mode...'));
  }

  try {
    // Create the Ink chat handler
    const chatHandler = new InkChatHandler(toolContext);

    // Set up graceful exit handler for Ctrl+C
    const handleExit = () => {
      console.log(chalk.yellow('\n👋 Goodbye! Thanks for using Coding Agent.'));
      process.exit(0);
    };
    process.on('SIGINT', handleExit);

    // Start the full Ink interactive mode
    await chatHandler.handleInteractiveMode(agent, {
      verbose: options.verbose,
      streaming: shouldStream,
    });

    // Clean up signal handler
    process.removeListener('SIGINT', handleExit);

    // Exit message
    console.log(chalk.yellow('👋 Goodbye! Thanks for using Coding Agent.'));

  } catch (error) {
    console.error(chalk.red('Failed to start interactive mode:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// processUserInput function removed - now handled entirely within ChatApp component

// displayChatHelp function removed - now handled within ChatApp component

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
