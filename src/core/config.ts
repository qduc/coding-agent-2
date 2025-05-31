import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';

export interface Config {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  provider?: 'openai' | 'anthropic';
  verbose?: boolean;
  maxTokens?: number;
  model?: string;
  logToolUsage?: boolean;
  streaming?: boolean;
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
      model: 'gpt-4o',
      provider: 'openai',
      verbose: false,
      logToolUsage: true,
      streaming: false // Disable streaming by default
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
    if (process.env.ANTHROPIC_API_KEY) {
      envConfig.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.CODING_AGENT_PROVIDER) {
      envConfig.provider = process.env.CODING_AGENT_PROVIDER as 'openai' | 'anthropic';
    }
    if (process.env.CODING_AGENT_MODEL) {
      envConfig.model = process.env.CODING_AGENT_MODEL;
    }
    if (process.env.CODING_AGENT_MAX_TOKENS) {
      envConfig.maxTokens = parseInt(process.env.CODING_AGENT_MAX_TOKENS, 10);
    }
    if (process.env.CODING_AGENT_LOG_TOOLS) {
      envConfig.logToolUsage = process.env.CODING_AGENT_LOG_TOOLS === 'true';
    }
    if (process.env.CODING_AGENT_STREAMING) {
      envConfig.streaming = process.env.CODING_AGENT_STREAMING === 'true';
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
    delete configToSave.anthropicApiKey; // Never save API key to file

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
   * Check if Anthropic API key is configured
   */
  hasAnthropicKey(): boolean {
    return !!this.config.anthropicApiKey;
  }

  /**
   * Check if the current provider has a valid API key
   */
  hasValidProviderKey(): boolean {
    const provider = this.config.provider || 'openai';
    return provider === 'openai' ? this.hasOpenAIKey() : this.hasAnthropicKey();
  }

  /**
   * Get OpenAI API key
   */
  getOpenAIKey(): string | undefined {
    return this.config.openaiApiKey;
  }

  /**
   * Get Anthropic API key
   */
  getAnthropicKey(): string | undefined {
    return this.config.anthropicApiKey;
  }

  /**
   * Set OpenAI API key (in memory only)
   */
  setOpenAIKey(apiKey: string): void {
    this.config.openaiApiKey = apiKey;
  }

  /**
   * Set Anthropic API key (in memory only)
   */
  setAnthropicKey(apiKey: string): void {
    this.config.anthropicApiKey = apiKey;
  }

  /**
   * Validate configuration
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const provider = this.config.provider || 'openai';

    if (!this.hasValidProviderKey()) {
      if (provider === 'openai') {
        errors.push('OpenAI API key is required. Set it via OPENAI_API_KEY environment variable or run: coding-agent --setup');
      } else {
        errors.push('Anthropic API key is required. Set it via ANTHROPIC_API_KEY environment variable or run: coding-agent --setup');
      }
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
    console.log(`Provider: ${chalk.white(config.provider)}`);
    console.log(`Model: ${chalk.white(config.model)}`);
    console.log(`Max Tokens: ${chalk.white(config.maxTokens)}`);

    if (config.provider === 'openai') {
      console.log(`OpenAI API Key: ${config.openaiApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
    } else {
      console.log(`Anthropic API Key: ${config.anthropicApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
    }

    console.log(`Tool Logging: ${config.logToolUsage ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')}`);
    console.log(`Streaming: ${config.streaming ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')}`);
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

    // Select provider first
    const { provider } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select LLM provider:',
        default: this.config.provider,
        choices: [
          { name: 'OpenAI (GPT-4, GPT-4o)', value: 'openai' },
          { name: 'Anthropic (Claude 3)', value: 'anthropic' }
        ]
      }
    ]);

    // Get API key based on provider
    const needsApiKey = provider === 'openai' ? !this.hasOpenAIKey() : !this.hasAnthropicKey();

    if (needsApiKey) {
      if (provider === 'openai') {
        console.log(chalk.cyan('OpenAI API Key:'));
        console.log(chalk.gray('You can get your API key from: https://platform.openai.com/api-keys'));
      } else {
        console.log(chalk.cyan('Anthropic API Key:'));
        console.log(chalk.gray('You can get your API key from: https://console.anthropic.com/'));
      }
      console.log();

      const { apiKey } = await inquirer.default.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter your ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key:`,
          mask: '*',
          validate: (input: string) => {
            if (!input.trim()) {
              return 'API key is required';
            }
            if (provider === 'openai' && !input.startsWith('sk-')) {
              return 'OpenAI API keys start with "sk-"';
            }
            if (provider === 'anthropic' && !input.startsWith('sk-ant-')) {
              return 'Anthropic API keys start with "sk-ant-"';
            }
            return true;
          }
        }
      ]);

      if (provider === 'openai') {
        this.setOpenAIKey(apiKey);
      } else {
        this.setAnthropicKey(apiKey);
      }
    }

    // Get model choices based on provider
    const modelChoices = provider === 'openai'
      ? [
          { name: 'GPT-4o (Latest, Function Calling)', value: 'gpt-4o' },
          { name: 'GPT-4o 2024-08-06 (Structured Outputs)', value: 'gpt-4o-2024-08-06' },
          { name: 'GPT-4.1 (Advanced Reasoning)', value: 'gpt-4.1' }
        ]
      : [
          { name: 'Claude 3.5 Sonnet (Latest)', value: 'claude-3-5-sonnet-20241022' },
          { name: 'Claude 3 Opus (Most Capable)', value: 'claude-3-opus-20240229' },
          { name: 'Claude 3 Haiku (Fast)', value: 'claude-3-haiku-20240307' }
        ];

    // Optional configuration
    const { model, maxTokens, logToolUsage, streaming } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'model',
        message: `Select ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} model:`,
        default: this.config.model,
        choices: modelChoices
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
      },
      {
        type: 'confirm',
        name: 'logToolUsage',
        message: 'Enable tool usage logging?',
        default: this.config.logToolUsage || false
      },
      {
        type: 'confirm',
        name: 'streaming',
        message: 'Enable response streaming? (real-time output)',
        default: this.config.streaming || false
      }
    ]);

    // Save configuration (excluding API key)
    await this.saveConfig({ provider, model, maxTokens, logToolUsage, streaming });

    console.log();
    console.log(chalk.green('✅ Configuration saved!'));
    console.log(chalk.gray('Note: API key is stored in memory only for security.'));
    console.log(chalk.gray(`Set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} environment variable for persistent usage.`));
    console.log();
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
