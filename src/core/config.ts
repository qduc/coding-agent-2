import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface Config {
  openaiApiKey?: string;
  verbose?: boolean;
  maxTokens?: number;
  model?: string;
}

export class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor() {
    // Store config in user's home directory
    this.configPath = path.join(os.homedir(), '.coding-agent', 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file system and environment variables
   */
  private loadConfig(): Config {
    const defaultConfig: Config = {
      maxTokens: 4000,
      model: 'gpt-4-turbo-preview',
      verbose: false
    };

    let fileConfig: Partial<Config> = {};

    // Try to load from config file
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        fileConfig = JSON.parse(configData);
      }
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      if (process.env.NODE_ENV !== 'test') {
        console.warn(chalk.yellow('Warning: Could not load config file, using defaults'));
      }
    }

    // Environment variables take precedence
    const envConfig: Partial<Config> = {};
    if (process.env.OPENAI_API_KEY) {
      envConfig.openaiApiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.CODING_AGENT_MODEL) {
      envConfig.model = process.env.CODING_AGENT_MODEL;
    }
    if (process.env.CODING_AGENT_MAX_TOKENS) {
      envConfig.maxTokens = parseInt(process.env.CODING_AGENT_MAX_TOKENS, 10);
    }

    return { ...defaultConfig, ...fileConfig, ...envConfig };
  }

  /**
   * Save configuration to file
   */
  async saveConfig(newConfig: Partial<Config>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Ensure config directory exists
    await fs.ensureDir(path.dirname(this.configPath));

    // Save to file (exclude sensitive data from being persisted)
    const configToSave = { ...this.config };
    delete configToSave.openaiApiKey; // Never save API key to file

    await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Check if OpenAI API key is configured
   */
  hasOpenAIKey(): boolean {
    return !!this.config.openaiApiKey;
  }

  /**
   * Get OpenAI API key
   */
  getOpenAIKey(): string | undefined {
    return this.config.openaiApiKey;
  }

  /**
   * Set OpenAI API key (in memory only)
   */
  setOpenAIKey(apiKey: string): void {
    this.config.openaiApiKey = apiKey;
  }

  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.hasOpenAIKey()) {
      errors.push('OpenAI API key is required. Set it via OPENAI_API_KEY environment variable or run: coding-agent --setup');
    }

    if (this.config.maxTokens && (this.config.maxTokens < 100 || this.config.maxTokens > 8000)) {
      errors.push('maxTokens must be between 100 and 8000');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Display current configuration (safely)
   */
  displayConfig(): void {
    const config = this.getConfig();
    console.log(chalk.cyan('Current Configuration:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Model: ${chalk.white(config.model)}`);
    console.log(`Max Tokens: ${chalk.white(config.maxTokens)}`);
    console.log(`API Key: ${config.openaiApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
    console.log(`Config file: ${chalk.gray(this.configPath)}`);
    console.log();
  }

  /**
   * Interactive setup wizard
   */
  async setupWizard(): Promise<void> {
    const inquirer = await import('inquirer');

    console.log(chalk.yellow('🔧 Coding Agent Setup'));
    console.log(chalk.gray('Let\'s configure your coding agent...'));
    console.log();

    // Get OpenAI API key
    if (!this.hasOpenAIKey()) {
      console.log(chalk.cyan('OpenAI API Key:'));
      console.log(chalk.gray('You can get your API key from: https://platform.openai.com/api-keys'));
      console.log();

      const { apiKey } = await inquirer.default.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter your OpenAI API key:',
          mask: '*',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'API key is required';
            }
            if (!input.startsWith('sk-')) {
              return 'OpenAI API keys start with "sk-"';
            }
            return true;
          }
        }
      ]);

      this.setOpenAIKey(apiKey);
    }

    // Optional configuration
    const { model, maxTokens } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'model',
        message: 'Select OpenAI model:',
        default: this.config.model,
        choices: [
          { name: 'GPT-4 Turbo (Recommended)', value: 'gpt-4-turbo-preview' },
          { name: 'GPT-4', value: 'gpt-4' },
          { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' }
        ]
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Maximum tokens per response:',
        default: this.config.maxTokens,
        validate: (input: number) => {
          if (input < 100 || input > 8000) {
            return 'Must be between 100 and 8000';
          }
          return true;
        }
      }
    ]);

    // Save configuration (excluding API key)
    await this.saveConfig({ model, maxTokens });

    console.log();
    console.log(chalk.green('✅ Configuration saved!'));
    console.log(chalk.gray('Note: API key is stored in memory only for security.'));
    console.log(chalk.gray('Set OPENAI_API_KEY environment variable for persistent usage.'));
    console.log();
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
