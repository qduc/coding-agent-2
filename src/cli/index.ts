#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

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
      .helpOption('-h, --help', 'Display help information')
      .action(async (command: string | undefined, options: any) => {
        // Handle colored output setting
        if (options.noColor) {
          chalk.level = 0;
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

  // TODO: Implement actual command processing with AI agent
  // For now, provide a placeholder response
  console.log(chalk.green('Command received:'), `"${command}"`);
  console.log();
  console.log(chalk.cyan('📝 Response:'));
  console.log('I understand you want me to:', command);
  console.log();
  console.log(chalk.gray('Note: Full AI integration is coming soon! This is the basic CLI foundation.'));
  console.log(chalk.gray('The agent will soon be able to read files, analyze code, and provide intelligent assistance.'));
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
