#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { configureCommands } from './commands';

// ESM equivalents for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // Display welcome banner
    displayBanner();

    // Configure commander with all available commands
    configureCommands(program, version);

    // Parse command line arguments
    await program.parseAsync();
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error');
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
// Check if this script is being executed directly (handles npm link symlinks)
const scriptPath = process.argv[1];
const isMainModule = scriptPath?.endsWith('index.js') || 
                    scriptPath?.endsWith('cli/index.js') || 
                    scriptPath?.endsWith('coding-agent');

if (isMainModule) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

export { main };
