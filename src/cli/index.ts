#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { configManager } from '../core/config';
import { llmService } from '../services/llm';

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

        // Initialize LLM service
        const initialized = await llmService.initialize();
        if (!initialized) {
          console.error(chalk.red('Failed to initialize AI service.'));
          console.log(chalk.yellow('Run'), chalk.white('coding-agent --setup'), chalk.yellow('to configure the agent.'));
          process.exit(1);
        }

        if (command) {
          // Direct command mode
          await handleDirectCommand(command, options);
        } else {
          // Interactive chat mode
          await startInteractiveMode(options);
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
async function handleDirectCommand(command: string, options: any) {
  if (options.verbose) {
    console.log(chalk.blue('Executing direct command:'), command);
  }

  console.log(chalk.yellow('🤖 Coding Agent'));
  console.log(chalk.gray('Processing your request...'));
  console.log();

  try {
    // Create conversation with system message and user command
    const systemMessage = llmService.createSystemMessage();
    const userMessage = llmService.createUserMessage(command);

    console.log(chalk.cyan('📝 Response:'));

    // Stream the response
    await llmService.streamMessage(
      [systemMessage, userMessage],
      (chunk: string) => {
        // Print each chunk as it arrives
        process.stdout.write(chunk);
      },
      (response: any) => {
        // Print newline when complete
        console.log();
        console.log();

        if (options.verbose) {
          console.log(chalk.gray('Finish reason:'), response.finishReason);
        }
      }
    );
  } catch (error) {
    console.error(chalk.red('Error processing command:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Start interactive chat mode
 */
async function startInteractiveMode(options: any) {
  if (options.verbose) {
    console.log(chalk.blue('Starting interactive chat mode...'));
  }

  console.log(chalk.yellow('🤖 Coding Agent - Interactive Mode'));
  console.log(chalk.gray('Starting a conversation session...'));
  console.log();

  // TODO: Implement interactive chat with inquirer
  // For now, provide instructions for the user
  console.log(chalk.cyan('💡 Interactive chat mode will be available soon!'));
  console.log();
  console.log(chalk.white('For now, you can use direct commands:'));
  console.log(chalk.gray('  coding-agent "help me understand this file"'));
  console.log(chalk.gray('  coding-agent "explain how this function works"'));
  console.log(chalk.gray('  coding-agent "analyze the test failures"'));
  console.log();
  console.log(chalk.gray('Use'), chalk.white('coding-agent --help'), chalk.gray('for more options.'));
}

/**
 * Run the configuration setup wizard
 */
async function runSetupWizard() {
  try {
    await configManager.setupWizard();

    // Test the connection after setup
    console.log(chalk.blue('Testing connection...'));
    const initialized = await llmService.initialize();

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
