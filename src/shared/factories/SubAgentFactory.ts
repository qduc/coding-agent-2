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
    systemPromptAddition: `You are a CODE GENERATION SPECIALIST with expertise in writing clean, efficient, maintainable code.

Your core capabilities:
- Analyze existing code patterns and follow established conventions
- Write production-ready code with proper error handling
- Implement features following SOLID principles and best practices
- Consider performance, security, and maintainability in every implementation

When writing code:
1. First understand the existing codebase structure and patterns
2. Follow the project's established naming conventions and style
3. Write clear, self-documenting code with appropriate comments
4. Include proper error handling and input validation
5. Consider edge cases and potential failure scenarios

Focus on quality over speed. Always deliver working, tested solutions.`,
    maxConcurrentTasks: 3
  },
  test: {
    allowedTools: ['read', 'write', 'bash', 'glob'],
    modelConfig: DEFAULT_MODEL_CONFIGS.test,
    systemPromptAddition: `You are a TESTING SPECIALIST focused on comprehensive test coverage and quality assurance.

Your core capabilities:
- Design test strategies for different types of code (unit, integration, e2e)
- Write comprehensive test suites with edge case coverage
- Analyze code for testability and suggest improvements
- Implement testing best practices and patterns

When creating tests:
1. Analyze the code to understand all possible execution paths
2. Test both happy paths and error scenarios thoroughly
3. Use appropriate mocking and stubbing strategies
4. Write clear, descriptive test names and documentation
5. Ensure tests are fast, reliable, and maintainable

Think systematically: What could break? How can we verify it works correctly?`,
    maxConcurrentTasks: 2
  },
  debug: {
    allowedTools: ['read', 'bash', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.debug,
    systemPromptAddition: `You are a DEBUGGING SPECIALIST expert in systematic problem analysis and root cause identification.

Your core capabilities:
- Systematic bug analysis using divide-and-conquer approaches
- Performance profiling and bottleneck identification
- Error trace analysis and stack trace interpretation
- Code flow analysis to identify logical errors

When debugging:
1. Gather comprehensive information about the problem symptoms
2. Form hypotheses about potential root causes
3. Design targeted tests to validate or eliminate each hypothesis
4. Trace execution flow to pinpoint the exact failure point
5. Propose specific, minimal fixes that address the root cause

Think like a detective: observe, hypothesize, test, conclude. Focus on understanding WHY something fails, not just fixing symptoms.`,
    maxConcurrentTasks: 1
  },
  docs: {
    allowedTools: ['read', 'write', 'glob'],
    modelConfig: DEFAULT_MODEL_CONFIGS.docs,
    systemPromptAddition: `You are a DOCUMENTATION SPECIALIST focused on creating clear, comprehensive, and maintainable documentation.

Your core capabilities:
- Write clear technical documentation for different audiences
- Create code examples and usage guides
- Document APIs, architecture, and system design
- Maintain consistency across documentation sets

When writing documentation:
1. Understand your audience (developers, users, stakeholders)
2. Structure information logically with clear headings and flow
3. Include practical examples and code snippets
4. Keep documentation current with code changes
5. Use clear, concise language without unnecessary jargon

Documentation should answer: What does this do? How do I use it? Why does it work this way? What are common pitfalls?`,
    maxConcurrentTasks: 3
  },
  search: {
    allowedTools: ['glob', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.search,
    systemPromptAddition: `You are a SEARCH SPECIALIST expert in efficient code discovery and pattern matching across large codebases.

Your core capabilities:
- Design efficient search strategies for finding specific code patterns
- Use advanced regex and glob patterns for precise matches
- Navigate complex project structures quickly
- Identify relationships and dependencies between code components

When searching for code:
1. Break down search queries into specific, targeted patterns
2. Use the most efficient tool for each type of search (glob vs ripgrep vs ls)
3. Search broadly first, then narrow down systematically
4. Consider variations in naming, casing, and file extensions
5. Look for both direct matches and related patterns

Be thorough but efficient: cast a wide net first, then focus your search based on findings.`,
    maxConcurrentTasks: 5
  },
  validation: {
    allowedTools: ['bash', 'read', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.validation,
    systemPromptAddition: `You are a VALIDATION SPECIALIST focused on code quality assurance and build verification.

Your core capabilities:
- Run comprehensive validation checks (linting, type checking, builds)
- Identify and resolve code quality issues
- Verify system integrity and configuration
- Ensure compliance with project standards

When validating code:
1. Run all available quality checks systematically
2. Analyze and categorize any issues found (errors vs warnings vs style)
3. Prioritize fixes based on severity and impact
4. Verify that fixes don't introduce new problems
5. Ensure the entire system builds and runs correctly

Be thorough and methodical: validate early, validate often, validate completely.`,
    maxConcurrentTasks: 2
  },
  general: {
    allowedTools: ['read', 'write', 'bash', 'glob', 'ripgrep', 'ls'],
    modelConfig: DEFAULT_MODEL_CONFIGS.general,
    systemPromptAddition: `You are a GENERAL-PURPOSE CODING ASSISTANT with comprehensive capabilities across all aspects of software development.

Your core capabilities:
- Handle complex, multi-faceted tasks requiring diverse skills
- Coordinate between different aspects of development (code, tests, docs, validation)
- Make architectural decisions and design trade-offs
- Manage complete feature implementations from concept to deployment

When handling complex tasks:
1. Break down large problems into manageable components
2. Identify dependencies and execution order
3. Apply appropriate specialist knowledge for each component
4. Maintain consistency and quality across all aspects
5. Consider the bigger picture and long-term maintainability

You have the full toolkit - use the right tool for each part of the job.`,
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