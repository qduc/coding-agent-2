/**
 * SubAgentFactory - Factory for creating and configuring specialized sub-agents
 * 
 * Provides a centralized way to create sub-agents with predefined configurations
 * for different specializations, ensuring consistency and proper setup.
 */

import { SubAgent } from '../core/subAgent';
import { Agent } from '../core/agent';
import { 
  SubAgentSpecialization, 
  SubAgentOptions, 
  SpecializationConfig,
  SubAgentModelConfig,
  DEFAULT_MODEL_CONFIGS
} from '../types/subAgent';
import { ISubAgent, ISubAgentFactory } from '../interfaces/ISubAgent';
import { SubAgentCommunication, SubAgentCommunicationCoordinator } from '../communication/SubAgentMessaging';
import { logger } from '../utils/logger';
import { ToolContext } from '../tools/types';

/**
 * Default specialization configurations
 */
export const DEFAULT_SPECIALIZATION_CONFIGS: Record<SubAgentSpecialization, SpecializationConfig> = {
  code: {
    allowedTools: ['read', 'write', 'glob', 'ripgrep'],
    modelConfig: DEFAULT_MODEL_CONFIGS.code,
    systemPromptAddition: 'You are a code generation specialist focused on clean, efficient implementations.',
    maxConcurrentTasks: 3
  },
  test: {
    allowedTools: ['read', 'write', 'bash', 'glob'],
    modelConfig: DEFAULT_MODEL_CONFIGS.test,
    systemPromptAddition: 'You are a test specialist focused on comprehensive testing and coverage.',
    maxConcurrentTasks: 2
  },
  debug: {
    allowedTools: ['read', 'bash', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.debug,
    systemPromptAddition: 'You are a debugging specialist focused on root cause analysis and problem solving.',
    maxConcurrentTasks: 1
  },
  docs: {
    allowedTools: ['read', 'write', 'glob'],
    modelConfig: DEFAULT_MODEL_CONFIGS.docs,
    systemPromptAddition: 'You are a documentation specialist focused on clear, comprehensive documentation.',
    maxConcurrentTasks: 3
  },
  search: {
    allowedTools: ['glob', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.search,
    systemPromptAddition: 'You are a search specialist focused on efficient code discovery and pattern matching.',
    maxConcurrentTasks: 5
  },
  validation: {
    allowedTools: ['bash', 'read', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.validation,
    systemPromptAddition: 'You are a validation specialist focused on code quality and build verification.',
    maxConcurrentTasks: 2
  },
  general: {
    allowedTools: ['read', 'write', 'bash', 'glob', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.general,
    systemPromptAddition: 'You are a general-purpose assistant with full capabilities.',
    maxConcurrentTasks: 2
  }
};

export class SubAgentFactory implements ISubAgentFactory {
  private static instance: SubAgentFactory;
  private communicationCoordinator: SubAgentCommunicationCoordinator;
  private customConfigs: Map<string, SpecializationConfig> = new Map();
  private createdAgents: Map<string, ISubAgent> = new Map();

  private constructor() {
    this.communicationCoordinator = new SubAgentCommunicationCoordinator();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SubAgentFactory {
    if (!SubAgentFactory.instance) {
      SubAgentFactory.instance = new SubAgentFactory();
    }
    return SubAgentFactory.instance;
  }

  /**
   * Create sub-agent with default configuration for specialization
   */
  async createSpecializedAgent(
    specialization: SubAgentSpecialization,
    parentAgent?: Agent
  ): Promise<ISubAgent> {
    const config = this.getSpecializationConfig(specialization);
    
    return this.createCustomAgent(specialization, {
      parentAgent,
      allowedTools: config.allowedTools,
      modelConfig: config.modelConfig
    });
  }

  /**
   * Create sub-agent with custom configuration
   */
  async createCustomAgent(
    specialization: SubAgentSpecialization, 
    options: Partial<SubAgentOptions>
  ): Promise<ISubAgent> {
    try {
      // Create communication channel
      const parentId = options.parentAgent ? 'main-agent' : undefined;
      const communication = this.communicationCoordinator.createChannel(
        options.agentId || `sub-agent-${Date.now()}`,
        parentId
      );

      // Merge with default configuration
      const config = this.getSpecializationConfig(specialization);
      const subAgentOptions: SubAgentOptions = {
        specialization,
        allowedTools: options.allowedTools || config.allowedTools,
        modelConfig: options.modelConfig || config.modelConfig,
        communicationChannel: communication,
        verbose: options.verbose || false,
        // Only include compatible options
        parentAgent: options.parentAgent,
        agentId: options.agentId,
        toolContext: options.toolContext
      };

      // Create and initialize sub-agent
      const subAgent = new SubAgent(subAgentOptions);
      const initialized = await subAgent.initialize();
      
      if (!initialized) {
        await communication.close();
        throw new Error(`Failed to initialize sub-agent with specialization: ${specialization}`);
      }

      // Track created agent
      this.createdAgents.set(subAgent.id, subAgent);

      logger.info(`Created sub-agent ${subAgent.id} with specialization: ${specialization}`);
      return subAgent;

    } catch (error) {
      logger.error(`Failed to create sub-agent with specialization ${specialization}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw error;
    }
  }

  /**
   * Create multiple sub-agents for parallel processing
   */
  async createAgentPool(
    specialization: SubAgentSpecialization,
    poolSize: number,
    parentAgent?: Agent
  ): Promise<ISubAgent[]> {
    const agents: ISubAgent[] = [];
    const promises: Promise<ISubAgent>[] = [];

    for (let i = 0; i < poolSize; i++) {
      promises.push(this.createSpecializedAgent(specialization, parentAgent));
    }

    try {
      const results = await Promise.allSettled(promises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          agents.push(result.value);
        } else {
          logger.error('Failed to create sub-agent in pool:', result.reason);
        }
      }

      logger.info(`Created agent pool of ${agents.length}/${poolSize} agents for ${specialization}`);
      return agents;

    } catch (error) {
      logger.error(`Failed to create agent pool for ${specialization}:`, error instanceof Error ? error : new Error('Unknown error'));
      
      // Clean up any successfully created agents
      await Promise.allSettled(agents.map(agent => agent.shutdown()));
      throw error;
    }
  }

  /**
   * Get default configuration for specialization
   */
  getSpecializationConfig(specialization: SubAgentSpecialization): SpecializationConfig {
    const customConfig = this.customConfigs.get(specialization);
    if (customConfig) {
      return customConfig;
    }

    const defaultConfig = DEFAULT_SPECIALIZATION_CONFIGS[specialization];
    if (!defaultConfig) {
      throw new Error(`No configuration found for specialization: ${specialization}`);
    }

    return defaultConfig;
  }

  /**
   * Register custom specialization configuration
   */
  registerSpecialization(name: string, config: SpecializationConfig): void {
    this.customConfigs.set(name, config);
    logger.debug(`Registered custom specialization configuration: ${name}`);
  }

  /**
   * Get supported specializations
   */
  getSupportedSpecializations(): SubAgentSpecialization[] {
    return Object.keys(DEFAULT_SPECIALIZATION_CONFIGS) as SubAgentSpecialization[];
  }

  /**
   * Get created agent by ID
   */
  getAgent(agentId: string): ISubAgent | undefined {
    return this.createdAgents.get(agentId);
  }

  /**
   * Get all created agents
   */
  getAllAgents(): ISubAgent[] {
    return Array.from(this.createdAgents.values());
  }

  /**
   * Remove agent from tracking
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.createdAgents.get(agentId);
    if (agent) {
      await agent.shutdown();
      this.createdAgents.delete(agentId);
      
      // Remove communication channel
      await this.communicationCoordinator.removeChannel(agentId);
      
      logger.debug(`Removed sub-agent: ${agentId}`);
    }
  }

  /**
   * Shutdown all created agents
   */
  async shutdownAllAgents(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [agentId, agent] of this.createdAgents) {
      shutdownPromises.push(
        agent.shutdown().catch(error => 
          logger.error(`Failed to shutdown agent ${agentId}:`, error)
        )
      );
    }

    await Promise.allSettled(shutdownPromises);
    this.createdAgents.clear();
    
    // Shutdown communication coordinator
    await this.communicationCoordinator.shutdown();
    
    logger.info('All sub-agents shut down');
  }

  /**
   * Get factory statistics
   */
  getFactoryStats(): {
    totalAgentsCreated: number;
    activeAgents: number;
    agentsBySpecialization: Record<string, number>;
    communicationStats: any;
  } {
    const agentsBySpecialization: Record<string, number> = {};
    
    for (const agent of this.createdAgents.values()) {
      const spec = agent.specialization;
      agentsBySpecialization[spec] = (agentsBySpecialization[spec] || 0) + 1;
    }

    return {
      totalAgentsCreated: this.createdAgents.size,
      activeAgents: Array.from(this.createdAgents.values())
        .filter(agent => agent.getStatus().state !== 'stopped').length,
      agentsBySpecialization,
      communicationStats: this.communicationCoordinator.getStats()
    };
  }

  /**
   * Create agent with optimized configuration for task type
   */
  async createOptimizedAgent(
    taskDescription: string,
    parentAgent?: Agent
  ): Promise<ISubAgent> {
    const specialization = this.analyzeTaskForSpecialization(taskDescription);
    return this.createSpecializedAgent(specialization, parentAgent);
  }

  /**
   * Analyze task to determine optimal specialization
   */
  private analyzeTaskForSpecialization(taskDescription: string): SubAgentSpecialization {
    const task = taskDescription.toLowerCase();
    
    // Test-related keywords
    if (task.includes('test') || task.includes('spec') || task.includes('coverage')) {
      return 'test';
    }
    
    // Debug-related keywords
    if (task.includes('debug') || task.includes('error') || task.includes('fix') || 
        task.includes('bug') || task.includes('troubleshoot')) {
      return 'debug';
    }
    
    // Documentation keywords
    if (task.includes('document') || task.includes('readme') || task.includes('comment') ||
        task.includes('docs') || task.includes('explain')) {
      return 'docs';
    }
    
    // Search keywords
    if (task.includes('find') || task.includes('search') || task.includes('locate') ||
        task.includes('discover') || task.includes('pattern')) {
      return 'search';
    }
    
    // Validation keywords  
    if (task.includes('lint') || task.includes('validate') || task.includes('check') ||
        task.includes('verify') || task.includes('build')) {
      return 'validation';
    }
    
    // Code keywords
    if (task.includes('implement') || task.includes('create') || task.includes('add') ||
        task.includes('refactor') || task.includes('function') || task.includes('class')) {
      return 'code';
    }
    
    // Default to general for complex or unclear tasks
    return 'general';
  }
}

// Export singleton instance for convenience
export const subAgentFactory = SubAgentFactory.getInstance();