import { LLMService } from '../services/llm';
import { configManager } from './config';
import { BaseTool } from '../tools/base';
import { LSTool } from '../tools/ls';
import { GlobTool } from '../tools/glob';
import { ReadTool } from '../tools/read';
import { RipgrepTool } from '../tools/ripgrep';
import { WriteTool } from '../tools/write';
import { BashTool } from '../tools/bash';
import { SubAgentTool } from '../tools/subAgent';
import { ToolOrchestrator } from './orchestrator';
import { ProjectDiscovery, ProjectDiscoveryResult } from '../utils/projectDiscovery';
import { toolContextManager } from '../utils/ToolContextManager';

/**
 * Core Agent - Primary interface for AI programming assistant
 *
 * Provides high-level API for initialization, configuration, and message processing.
 * Delegates tool execution to ToolOrchestrator while handling session management.
 */
import { IInputHandler, IToolExecutionContext } from '../interfaces';

export interface AgentOptions {
  inputHandler?: IInputHandler;
  toolContext?: IToolExecutionContext;
}

export class Agent {
  private llmService: LLMService;
  private orchestrator: ToolOrchestrator;
  private projectDiscovery: ProjectDiscovery;
  private discoveryResult?: ProjectDiscoveryResult;
  private inputHandler?: IInputHandler;
  private toolContext?: IToolExecutionContext;
  public addAgentInfo?: (info: string) => void;
  public clearAgentInfo?: () => void;

  constructor(options: AgentOptions = {}) {
    this.inputHandler = options.inputHandler;
    this.toolContext = options.toolContext;
    this.llmService = new LLMService();

    // Create instances of all tools with provided or default context
    const toolContext = {
      workingDirectory: this.toolContext?.workingDirectory || process.cwd(),
      maxFileSize: 1024 * 1024 * 5, // 5MB
      timeout: 30000, // 30s
      allowHidden: false,
      allowedExtensions: [],
      blockedPaths: ['node_modules', '.git', 'dist', 'build', 'coverage']
    };

    const lsTool = new LSTool(toolContext);
    const globTool = new GlobTool(toolContext);
    const readTool = new ReadTool(toolContext);
    const writeTool = new WriteTool(toolContext);
    const bashTool = new BashTool(toolContext);
    const subAgentTool = new SubAgentTool();

    // Create ripgrep tool and check if ripgrep is available
    const ripgrepTool = new RipgrepTool();
    const ripgrepAvailable = ripgrepTool.isRipgrepAvailable();

    // Create the list of tools - only add ripgrep if available
    const tools: BaseTool[] = [lsTool, globTool, readTool, writeTool, bashTool, subAgentTool];

    if (ripgrepAvailable) {
      tools.push(ripgrepTool);
    } else {
      // Use UI display if available, otherwise fall back to console
      const warnMessage1 = '⚠️ System ripgrep (rg) command not found. Ripgrep tool will not be available.';
      const warnMessage2 = '💡 For better search capabilities, install ripgrep: https://github.com/BurntSushi/ripgrep#installation';
      
      if (this.addAgentInfo) {
        this.addAgentInfo(warnMessage1);
        this.addAgentInfo(warnMessage2);
      } else {
        console.warn('System ripgrep (rg) command not found. Ripgrep tool will not be available.');
        console.warn('For better search capabilities, install ripgrep: https://github.com/BurntSushi/ripgrep#installation');
      }
    }

    // Initialize the orchestrator with available tools
    this.orchestrator = new ToolOrchestrator(this.llmService, tools);

    // Initialize project discovery
    this.projectDiscovery = new ProjectDiscovery();

    // Set up periodic cleanup of tool context manager (every 30 minutes)
    setInterval(() => {
      toolContextManager.cleanup();
    }, 30 * 60 * 1000);
  }

  /**
   * Initialize the agent and validate configuration
   */
  async initialize(): Promise<boolean> {
    // Validate configuration
    const validation = configManager.validate();
    if (!validation.isValid) {
      throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
    }

    // Run project discovery
    this.discoveryResult = await this.projectDiscovery.discover();

    // Set project context in orchestrator
    this.orchestrator.setProjectContext(this.discoveryResult);

    // Initialize LLM service
    const initialized = await this.llmService.initialize();
    
    if (initialized) {
      // Output the current provider and model being used
      const providerName = this.llmService.getProviderName();
      let modelName = 'unknown';
      try {
        modelName = this.llmService.getModelName();
      } catch (error) {
        const warnMessage = '⚠️ Could not get model name, showing provider only';
        if (this.addAgentInfo) {
          this.addAgentInfo(warnMessage);
        } else {
          console.warn('Could not get model name, showing provider only');
        }
      }
      
      const initMessage = `✅ Initialized with provider: ${providerName}${modelName !== 'unknown' ? `, model: ${modelName}` : ''}`;
      if (this.addAgentInfo) {
        this.addAgentInfo(initMessage);
      } else {
        console.log(`Initialized with provider: ${providerName}${modelName !== 'unknown' ? `, model: ${modelName}` : ''}`);
      }

      // Initialize the orchestrator's provider strategy now that LLM service is ready
      this.orchestrator.initializeProviderStrategy();
    }
    
    return initialized;
  }

  /**
   * Check if agent is ready for operation
   */
  isReady(): boolean {
    return this.llmService.isReady();
  }

  /**
   * Process a user message with full tool support
   */
  async processMessage(
    userMessage: string,
    onChunk?: (chunk: string) => void,
    verbose: boolean = false
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    return await this.orchestrator.processMessage(userMessage, onChunk, verbose);
  }

  /**
   * Get list of registered tools
   */
  getRegisteredTools(): Array<{ name: string; description: string }> {
    return this.orchestrator.getRegisteredTools().map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.orchestrator.clearHistory();
  }

  /**
   * Clear conversation history and refresh project context
   */
  async clearHistoryAndRefresh(): Promise<void> {
    this.orchestrator.clearHistory();
    await this.refreshProjectContext();
  }

  /**
   * Refresh project discovery context
   */
  async refreshProjectContext(): Promise<void> {
    // Re-run project discovery with force refresh
    this.discoveryResult = await this.projectDiscovery.discover(true);
    
    // Update project context in orchestrator
    this.orchestrator.setProjectContext(this.discoveryResult);
  }

  /**
   * Get conversation summary for debugging
   */
  getConversationSummary(): string {
    return this.orchestrator.getConversationSummary();
  }

  /**
   * Get project discovery results
   */
  getProjectDiscovery(): ProjectDiscoveryResult | undefined {
    return this.discoveryResult;
  }

  /**
   * Register a new tool
   */
  registerTool(tool: any): void {
    this.orchestrator.registerTool(tool);
  }

  /**
   * Get current model information
   */
  getCurrentModel(): string {
    if (!this.isReady()) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    return this.llmService.getModelName();
  }
}
