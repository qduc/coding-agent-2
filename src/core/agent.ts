import { LLMService } from '../services/llm';
import { configManager } from './config';
import { LSTool } from '../tools/ls';
import { GlobTool } from '../tools/glob';
import { ReadTool } from '../tools/read';
import { ToolOrchestrator } from './orchestrator';

/**
 * Core Agent - Primary interface for AI programming assistant
 *
 * Provides high-level API for initialization, configuration, and message processing.
 * Delegates tool execution to ToolOrchestrator while handling session management.
 */
export class Agent {
  private llmService: LLMService;
  private orchestrator: ToolOrchestrator;

  constructor() {
    this.llmService = new LLMService();

    // Create instances of all tools with default context
    const lsTool = new LSTool();
    const globTool = new GlobTool();
    const readTool = new ReadTool();

    // Initialize the orchestrator with all tools
    this.orchestrator = new ToolOrchestrator(this.llmService, [lsTool, globTool, readTool]);
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
   * Register a new tool
   */
  registerTool(tool: any): void {
    this.orchestrator.registerTool(tool);
  }
}
