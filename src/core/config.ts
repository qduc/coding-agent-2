import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { Logger, LogLevel } from '../utils/logger';

export interface Config {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  provider?: 'openai' | 'anthropic' | 'gemini';
  verbose?: boolean;
  maxTokens?: number;
  model?: string;
  logToolUsage?: boolean;
  streaming?: boolean;
  // Logging configuration
  logLevel?: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  enableFileLogging?: boolean;
  enableConsoleLogging?: boolean;
  enableToolConsoleLogging?: boolean; // Separate setting for tool messages
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
      maxTokens: 8000,
      model: 'gpt-4o-2024-11-20',
      provider: 'openai',
      verbose: false,
      logToolUsage: true,
      streaming: false, // Disable streaming by default
      // Default logging configuration
      logLevel: 'info',
      enableFileLogging: true,
      enableConsoleLogging: false, // Disable general console logging by default
      enableToolConsoleLogging: true, // But keep tool messages in console
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
    if (process.env.GEMINI_API_KEY) {
      envConfig.geminiApiKey = process.env.GEMINI_API_KEY;
    }
    if (process.env.CODING_AGENT_PROVIDER) {
      envConfig.provider = process.env.CODING_AGENT_PROVIDER as 'openai' | 'anthropic' | 'gemini';
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
    if (process.env.CODING_AGENT_LOG_LEVEL) {
      envConfig.logLevel = process.env.CODING_AGENT_LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug' | 'trace';
    }
    if (process.env.CODING_AGENT_FILE_LOGGING) {
      envConfig.enableFileLogging = process.env.CODING_AGENT_FILE_LOGGING === 'true';
    }
    if (process.env.CODING_AGENT_CONSOLE_LOGGING) {
      envConfig.enableConsoleLogging = process.env.CODING_AGENT_CONSOLE_LOGGING === 'true';
    }
    if (process.env.CODING_AGENT_TOOL_CONSOLE_LOGGING) {
      envConfig.enableToolConsoleLogging = process.env.CODING_AGENT_TOOL_CONSOLE_LOGGING === 'true';
    }

    const finalConfig = { ...defaultConfig, ...fileConfig, ...envConfig };

    // Initialize logger with configuration
    this.initializeLogger(finalConfig);

    return finalConfig;
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
    delete configToSave.geminiApiKey; // Never save API key to file

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
   * Check if Gemini API key is configured
   */
  hasGeminiKey(): boolean {
    return !!this.config.geminiApiKey;
  }

  /**
   * Check if the current provider has a valid API key
   */
  hasValidProviderKey(): boolean {
    const provider = this.config.provider || 'openai';
    if (provider === 'openai') {
      return this.hasOpenAIKey();
    } else if (provider === 'anthropic') {
      return this.hasAnthropicKey();
    } else if (provider === 'gemini') {
      return this.hasGeminiKey();
    }
    return false;
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
   * Get Gemini API key
   */
  getGeminiKey(): string | undefined {
    return this.config.geminiApiKey;
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
   * Set Gemini API key (in memory only)
   */
  setGeminiKey(apiKey: string): void {
    this.config.geminiApiKey = apiKey;
  }

  /**
   * Initialize logger with configuration settings
   */
  private initializeLogger(config: Config): void {
    const logger = Logger.getInstance();

    // Convert string log level to enum
    const logLevelMap: Record<string, LogLevel> = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
      trace: LogLevel.TRACE,
    };

    const logLevel = config.logLevel ? logLevelMap[config.logLevel] : LogLevel.INFO;

    logger.configure({
      level: logLevel,
      enableConsole: config.enableConsoleLogging ?? false, // Default to false for general logs
      enableFile: config.enableFileLogging ?? true,
      enableToolConsole: config.enableToolConsoleLogging ?? true, // Default to true for tool logs
    });
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
      } else if (provider === 'anthropic') {
        errors.push('Anthropic API key is required. Set it via ANTHROPIC_API_KEY environment variable or run: coding-agent --setup');
      } else if (provider === 'gemini') {
        errors.push('Gemini API key is required. Set it via GEMINI_API_KEY environment variable or run: coding-agent --setup');
      }
    }

    if (this.config.maxTokens && (this.config.maxTokens < 100 || this.config.maxTokens > 32000)) {
      errors.push('maxTokens must be between 100 and 32000');
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
    } else if (config.provider === 'anthropic') {
      console.log(`Anthropic API Key: ${config.anthropicApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
    } else if (config.provider === 'gemini') {
      console.log(`Gemini API Key: ${config.geminiApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
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
          { name: 'OpenAI (GPT-4o, o3-mini, GPT-4.1)', value: 'openai' },
          { name: 'Anthropic (Claude 4, Claude 3.7)', value: 'anthropic' },
          { name: 'Google Gemini (Gemini 2.5, 2.0)', value: 'gemini' }
        ]
      }
    ]);

    // Get API key based on provider
    const needsApiKey = provider === 'openai' ? !this.hasOpenAIKey() :
                       provider === 'anthropic' ? !this.hasAnthropicKey() :
                       !this.hasGeminiKey();

    if (needsApiKey) {
      if (provider === 'openai') {
        console.log(chalk.cyan('OpenAI API Key:'));
        console.log(chalk.gray('You can get your API key from: https://platform.openai.com/api-keys'));
      } else if (provider === 'anthropic') {
        console.log(chalk.cyan('Anthropic API Key:'));
        console.log(chalk.gray('You can get your API key from: https://console.anthropic.com/'));
      } else if (provider === 'gemini') {
        console.log(chalk.cyan('Gemini API Key:'));
        console.log(chalk.gray('You can get your API key from: https://aistudio.google.com/app/apikey'));
      }
      console.log();

      const { apiKey } = await inquirer.default.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: `Enter your ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Gemini'} API key:`,
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
            if (provider === 'gemini' && !/^AIza[0-9A-Za-z_-]{35}$/.test(input)) {
              return 'Gemini API keys should be 39 characters starting with "AIza"';
            }
            return true;
          }
        }
      ]);

      if (provider === 'openai') {
        this.setOpenAIKey(apiKey);
      } else if (provider === 'anthropic') {
        this.setAnthropicKey(apiKey);
      } else if (provider === 'gemini') {
        this.setGeminiKey(apiKey);
      }
    }

    // Get model choices based on provider
    const modelChoices = provider === 'openai'
      ? [
          { name: 'o3-mini (Latest Reasoning Model)', value: 'o3-mini' },
          { name: 'GPT-4.1 (Advanced Reasoning)', value: 'gpt-4.1' },
          { name: 'GPT-4o 2024-11-20 (Latest, Enhanced)', value: 'gpt-4o-2024-11-20' },
          { name: 'GPT-4o (Stable)', value: 'gpt-4o' },
          { name: 'GPT-4o Mini (Fast & Efficient)', value: 'gpt-4o-mini' }
        ]
      : provider === 'anthropic'
        ? [
            { name: 'Claude 4 Opus (Latest, Most Capable)', value: 'claude-opus-4-20250514' },
            { name: 'Claude 4 Sonnet (Latest, Balanced)', value: 'claude-sonnet-4-20250514' },
            { name: 'Claude 3.7 Sonnet (Enhanced)', value: 'claude-3-7-sonnet-20250219' },
            { name: 'Claude 3.5 Sonnet (Stable)', value: 'claude-3-5-sonnet-20241022' },
            { name: 'Claude 3.5 Haiku (Fast)', value: 'claude-3-5-haiku-20241022' }
          ]
        : [
            { name: 'Gemini 2.5 Flash (Latest, Fast)', value: 'gemini-2.5-flash' },
            { name: 'Gemini 2.5 Pro (Latest, Most Capable)', value: 'gemini-2.5-pro' },
            { name: 'Gemini 2.0 Flash (Multimodal)', value: 'gemini-2.0-flash-exp' },
            { name: 'Gemini 1.5 Pro (Stable)', value: 'gemini-1.5-pro-002' },
            { name: 'Gemini 1.5 Flash (Fast)', value: 'gemini-1.5-flash-002' }
          ];

    // Optional configuration
    const { model, maxTokens, logToolUsage, streaming } = await inquirer.default.prompt([
      {
        type: 'list',
        name: 'model',
        message: `Select ${provider === 'openai' ? 'OpenAI' : provider === 'anthropic' ? 'Anthropic' : 'Google Gemini'} model:`,
        default: this.config.model,
        choices: modelChoices
      },
      {
        type: 'number',
        name: 'maxTokens',
        message: 'Maximum tokens per response:',
        default: this.config.maxTokens,
        validate: (input: number) => {
          if (input < 100 || input > 32000) {
            return 'Must be between 100 and 32000';
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
    const envVar = provider === 'openai'
      ? 'OPENAI_API_KEY'
      : provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : 'GEMINI_API_KEY';
    console.log(chalk.gray(`Set ${envVar} environment variable for persistent usage.`));
    console.log();
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
