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
import { Logger } from '../shared/utils/logger';

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
    .option('--tool-display <mode>', 'Set tool display mode: off, minimal, condensed, standard, verbose')
    .option('--setup', 'Run configuration setup wizard')
    .option('--config', 'Show current configuration')
    .option('--model <model>', 'Temporarily specify the LLM model to use for this session')
    .helpOption('-h, --help', 'Display help information')
    .action(async (command: string | undefined, options: any) => {
      // Generate correlation ID for this CLI session
      const correlationId = Logger.generateCorrelationId();
      const logger = Logger.getInstance();
      logger.setCorrelationId(correlationId);

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

      // Handle tool display mode override
      if (options.toolDisplay) {
        const validModes = ['off', 'minimal', 'condensed', 'standard', 'verbose'];
        if (!validModes.includes(options.toolDisplay)) {
          console.error(chalk.red('Invalid tool display mode:'), options.toolDisplay);
          console.log(chalk.yellow('Valid modes:'), validModes.join(', '));
          process.exit(1);
        }
        
        // Override tool display mode for this session
        await configManager.saveConfig({ toolDisplayMode: options.toolDisplay });
        console.log(chalk.blue('Tool display mode set to:'), chalk.white(options.toolDisplay));
        console.log();
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

      // Handle model selection from CLI option
      if (options.model) {
  const { detectProviderFromModel } = await import('../shared/core/config');
  const provider = detectProviderFromModel(options.model);
  await configManager.saveConfig({ model: options.model, provider });
  console.log(chalk.blue('Model set to:'), chalk.white(options.model));
  console.log(chalk.blue('Provider auto-selected:'), chalk.white(provider));
}


      // Create CLI implementations
      const toolContext = new CLIToolExecutionContext();

      // Create and initialize agent with CLI implementations
      const agentOptions: any = { toolContext };
      if (options.model) {
        console.log(chalk.blue('🤖 Using temporary model:'), chalk.white(options.model));
        const { detectProviderFromModel } = await import('../shared/core/config');
const provider = detectProviderFromModel(options.model);
agentOptions.temporaryModel = options.model;
agentOptions.temporaryProvider = provider;
      }

      const agent = new Agent(agentOptions);
      const initialized = await agent.initialize();
      if (!initialized) {
        console.error(chalk.red('Failed to initialize AI service.'));
        console.log(chalk.yellow('Run'), chalk.white('coding-agent --setup'), chalk.yellow('to configure the agent.'));
        process.exit(1);
      }

      if (command) {
        // Direct command mode
        await handleDirectCommand(command, agent, options);
      } else {
        // Interactive chat mode - use full Ink control
        await startInteractiveMode(agent, options, toolContext);
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
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Setup failed:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Handle direct command execution
 */
export async function handleDirectCommand(command: string, agent: Agent, options: any) {
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
export async function startInteractiveMode(agent: Agent, options: any, toolContext: CLIToolExecutionContext) {
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

    // If model was specified, show the temporary model and provider being used
    if (options.model) {
      console.log(chalk.blue('🤖 Using temporary model:'), chalk.white(options.model));
      const { detectProviderFromModel } = await import('../shared/core/config');
      const provider = detectProviderFromModel(options.model);
      console.log(chalk.blue('Provider auto-selected:'), chalk.white(provider));
    }

    // Start the full Ink interactive mode with the already initialized agent
    await chatHandler.handleInteractiveChatMode(
      agent, 
      {
        verbose: options.verbose
      }
    );

    // Clean up signal handler
    process.removeListener('SIGINT', handleExit);

    // Exit message
    console.log(chalk.yellow('👋 Goodbye! Thanks for using Coding Agent.'));
    process.exit(0);

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
      return MarkdownRenderer.render(content);
    } catch (error) {
      // Fallback to plain text if markdown rendering fails
      return content;
    }
  }

  return content;
}
