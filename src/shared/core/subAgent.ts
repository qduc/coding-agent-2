/**
 * SubAgent - Specialized agent for focused task execution
 * 
 * Extends the core Agent functionality with specialization-specific
 * configurations, limited tool access, and parent-child communication.
 */

import { v4 as uuidv4 } from 'uuid';
import { Agent } from './agent';
import { LLMService } from '../services/llm';
import { ToolOrchestrator } from './orchestrator';
import { BaseTool } from '../tools/base';
import { 
  SubAgentOptions, 
  SubAgentSpecialization, 
  SubAgentStatus, 
  TaskDelegation, 
  TaskResult,
  SubAgentMessage,
  SubAgentModelConfig
} from '../types/subAgent';
import { ISubAgent } from '../interfaces/ISubAgent';
import { SubAgentCommunication } from '../communication/SubAgentMessaging';
import { logger } from '../utils/logger';
import { ProjectDiscovery, ProjectDiscoveryResult } from '../utils/projectDiscovery';

export class SubAgent implements ISubAgent {
  public readonly id: string;
  public readonly specialization: SubAgentSpecialization;
  
  private agent: Agent;
  private llmService: LLMService;
  private orchestrator: ToolOrchestrator;
  private communication?: SubAgentCommunication;
  private currentStatus: SubAgentStatus;
  private currentTaskId?: string;
  private allowedTools: string[];
  private verbose: boolean;
  private parentAgent?: Agent;
  private modelConfig?: SubAgentModelConfig;

  constructor(options: SubAgentOptions) {
    this.id = options.agentId || uuidv4();
    this.specialization = options.specialization;
    this.parentAgent = options.parentAgent;
    this.allowedTools = options.allowedTools || this.getDefaultToolsForSpecialization();
    this.verbose = options.verbose || false;
    this.modelConfig = options.modelConfig;

    // Initialize communication if provided
    if (options.communicationChannel) {
      this.communication = options.communicationChannel as SubAgentCommunication;
    }

    // Initialize status
    this.currentStatus = {
      id: this.id,
      state: 'idle',
      specialization: this.specialization,
      lastActivity: Date.now()
    };

    // Create LLM service with specialization-specific configuration
    this.llmService = new LLMService();
    
    // Initialize agent with filtered tools
    this.agent = new Agent({
      toolContext: options.toolContext
    });

    // Will be set during initialization
    this.orchestrator = {} as ToolOrchestrator;

    if (this.verbose) {
      logger.debug(`Created sub-agent ${this.id} with specialization: ${this.specialization}`);
    }
  }

  /**
   * Initialize the sub-agent and its dependencies
   */
  async initialize(): Promise<boolean> {
    try {
      this.updateStatus('busy');

      // Initialize the base agent first
      const agentInitialized = await this.agent.initialize();
      if (!agentInitialized) {
        throw new Error('Failed to initialize base agent');
      }

      // Get the orchestrator from the initialized agent
      this.orchestrator = (this.agent as any).orchestrator;
      this.llmService = (this.agent as any).llmService;

      // Filter tools based on specialization
      await this.setupSpecializationTools();

      // Configure model if specified
      if (this.modelConfig) {
        await this.configureModel();
      }

      // Set up project context if parent has it
      if (this.parentAgent) {
        const parentDiscovery = (this.parentAgent as any).discoveryResult;
        if (parentDiscovery) {
          this.orchestrator.setProjectContext(parentDiscovery);
        }
      }

      this.updateStatus('idle');
      
      if (this.verbose) {
        logger.info(`Sub-agent ${this.id} initialized successfully with ${this.allowedTools.length} tools`);
      }

      return true;
    } catch (error) {
      this.updateStatus('error');
      logger.error(`Failed to initialize sub-agent ${this.id}:`, error instanceof Error ? error : new Error('Unknown error'));
      return false;
    }
  }

  /**
   * Check if sub-agent is ready to process tasks
   */
  isReady(): boolean {
    return this.currentStatus.state === 'idle' && this.agent.isReady();
  }

  /**
   * Process a delegated task
   */
  async processTask(delegation: TaskDelegation): Promise<TaskResult> {
    if (!this.isReady()) {
      return {
        taskId: delegation.taskId,
        success: false,
        error: {
          message: 'Sub-agent is not ready to process tasks',
          code: 'AGENT_NOT_READY'
        }
      };
    }

    const startTime = Date.now();
    this.currentTaskId = delegation.taskId;
    this.updateStatus('busy');

    try {
      // Send progress update to parent
      await this.sendStatusUpdate('progress_update', {
        taskId: delegation.taskId,
        status: 'started',
        message: 'Task processing started'
      });

      // Add specialization context to the user input
      const enhancedInput = this.enhanceInputWithSpecialization(delegation.userInput, delegation);

      // Process the task using the orchestrator
      const result = await this.orchestrator.processMessage(
        enhancedInput,
        undefined, // No chunk callback for sub-agents by default
        this.verbose
      );

      const executionTime = Date.now() - startTime;
      const toolsUsed = this.getUsedTools();

      // Send completion update to parent
      await this.sendStatusUpdate('result', {
        taskId: delegation.taskId,
        status: 'completed',
        result,
        executionTime
      });

      this.updateStatus('idle');
      this.currentTaskId = undefined;

      return {
        taskId: delegation.taskId,
        success: true,
        result,
        metadata: {
          toolsUsed,
          executionTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Send error update to parent
      await this.sendStatusUpdate('error', {
        taskId: delegation.taskId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.updateStatus('error');
      this.currentTaskId = undefined;

      return {
        taskId: delegation.taskId,
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'TASK_EXECUTION_ERROR',
          details: { executionTime }
        }
      };
    }
  }

  /**
   * Get available tools for this sub-agent
   */
  getAvailableTools(): BaseTool[] {
    if (!this.orchestrator) {
      return [];
    }
    
    const allTools = this.orchestrator.getRegisteredTools();
    return allTools.filter(tool => this.allowedTools.includes(tool.name));
  }

  /**
   * Get current status information
   */
  getStatus(): SubAgentStatus {
    return { ...this.currentStatus };
  }

  /**
   * Shutdown the sub-agent gracefully
   */
  async shutdown(): Promise<void> {
    this.updateStatus('stopped');
    
    if (this.communication) {
      await this.communication.close();
    }

    if (this.verbose) {
      logger.info(`Sub-agent ${this.id} shutdown complete`);
    }
  }

  /**
   * Set up tools based on specialization
   */
  private async setupSpecializationTools(): Promise<void> {
    // The base agent already has all tools registered
    // We control access through the allowedTools filter
    
    if (this.verbose) {
      logger.debug(`Sub-agent ${this.id} configured with tools:`, this.allowedTools);
    }
  }

  /**
   * Configure model based on specialization
   */
  private async configureModel(): Promise<void> {
    if (!this.modelConfig) return;

    try {
      // Note: Model configuration is handled by the config manager and provider factory
      // For now, we'll log the intended configuration
      if (this.verbose) {
        logger.debug(`Sub-agent ${this.id} configured with model:`, {
          provider: this.modelConfig.provider,
          model: this.modelConfig.model,
          profile: this.modelConfig.profile
        });
      }
    } catch (error) {
      logger.error(`Failed to configure model for sub-agent ${this.id}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  /**
   * Get default tools for a specialization
   */
  private getDefaultToolsForSpecialization(): string[] {
    switch (this.specialization) {
      case 'code':
        return ['read', 'write', 'glob', 'ripgrep'];
      case 'test':
        return ['read', 'write', 'bash', 'glob'];
      case 'debug':
        return ['read', 'bash', 'ripgrep', 'ls'];
      case 'docs':
        return ['read', 'write', 'glob'];
      case 'search':
        return ['glob', 'ripgrep', 'ls'];
      case 'validation':
        return ['bash', 'read', 'ls'];
      case 'general':
      default:
        return ['read', 'write', 'bash', 'glob', 'ripgrep', 'ls'];
    }
  }

  /**
   * Enhance user input with specialization-specific context
   */
  private enhanceInputWithSpecialization(userInput: string, delegation: TaskDelegation): string {
    const specializationPrompts = {
      code: "You are a code generation specialist. Focus on clean, efficient code implementation.",
      test: "You are a test specialist. Focus on comprehensive testing, test coverage, and test reliability.",
      debug: "You are a debugging specialist. Focus on identifying root causes, analyzing errors, and providing solutions.",
      docs: "You are a documentation specialist. Focus on clear, comprehensive documentation and comments.",
      search: "You are a code search specialist. Focus on finding relevant code, patterns, and dependencies efficiently.",
      validation: "You are a validation specialist. Focus on code quality, linting, type checking, and build validation.",
      general: "You are a general-purpose assistant. Handle the task comprehensively."
    };

    const specializationContext = specializationPrompts[this.specialization];
    const toolContext = `Available tools: ${this.allowedTools.join(', ')}`;
    
    return `${specializationContext}\n\n${toolContext}\n\nTask: ${userInput}`;
  }

  /**
   * Update agent status
   */
  private updateStatus(state: SubAgentStatus['state']): void {
    this.currentStatus = {
      ...this.currentStatus,
      state,
      currentTaskId: this.currentTaskId,
      lastActivity: Date.now()
    };
  }

  /**
   * Send status update to parent agent
   */
  private async sendStatusUpdate(type: SubAgentMessage['type'], payload: any): Promise<void> {
    if (!this.communication) return;

    try {
      const message: SubAgentMessage = {
        id: uuidv4(),
        type,
        from: this.id,
        to: 'parent', // Will be handled by communication layer
        payload,
        timestamp: Date.now()
      };

      await this.communication.sendToParent(message);
    } catch (error) {
      logger.error(`Failed to send status update from sub-agent ${this.id}:`, error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  /**
   * Get tools used in current conversation
   */
  private getUsedTools(): string[] {
    // For now, return all available tools
    // In a future enhancement, we could track actual tool usage
    return this.allowedTools;
  }
}