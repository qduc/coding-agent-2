import { LLMService } from '../services/llm';
import { configManager } from './config';
import { BaseTool } from '../tools/base';
import { LSTool } from '../tools/ls';
import { GlobTool } from '../tools/glob';
import { ReadTool } from '../tools/read';
import { RipgrepTool } from '../tools/ripgrep';
import { WriteTool } from '../tools/write';
import { BashTool } from '../tools/bash';
import { ToolOrchestrator } from './orchestrator';
import { ProjectDiscovery, ProjectDiscoveryResult } from '../utils/projectDiscovery';

/**
 * Core Agent - Primary interface for AI programming assistant
 *
 * Provides high-level API for initialization, configuration, and message processing.
 * Delegates tool execution to ToolOrchestrator while handling session management.
 */
export class Agent {
  private llmService: LLMService;
  private orchestrator: ToolOrchestrator;
  private projectDiscovery: ProjectDiscovery;
  private discoveryResult?: ProjectDiscoveryResult;

  constructor() {
    this.llmService = new LLMService();

    // Create instances of all tools with default context
    const lsTool = new LSTool();
    const globTool = new GlobTool();
    const readTool = new ReadTool();
    const writeTool = new WriteTool();
    const bashTool = new BashTool();

    // Create ripgrep tool and check if ripgrep is available
    const ripgrepTool = new RipgrepTool();
    const ripgrepAvailable = ripgrepTool.isRipgrepAvailable();

    // Create the list of tools - only add ripgrep if available
    const tools: BaseTool[] = [lsTool, globTool, readTool, writeTool, bashTool];

    if (ripgrepAvailable) {
      tools.push(ripgrepTool);
    } else {
      console.warn('System ripgrep (rg) command not found. Ripgrep tool will not be available.');
      console.warn('For better search capabilities, install ripgrep: https://github.com/BurntSushi/ripgrep#installation');
    }

    // Initialize the orchestrator with available tools
    this.orchestrator = new ToolOrchestrator(this.llmService, tools);

    // Initialize project discovery
    this.projectDiscovery = new ProjectDiscovery();
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
    return await this.llmService.initialize();
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
}
