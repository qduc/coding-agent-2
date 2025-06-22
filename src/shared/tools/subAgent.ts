/**
 * SubAgentTool - Tool for delegating tasks to specialized sub-agents
 *
 * Allows the main agent to delegate focused tasks to specialized sub-agents
 * for improved efficiency, cost optimization, and parallel processing.
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import { SubAgentFactory } from '../factories/SubAgentFactory';
import {
  SubAgentSpecialization,
  TaskDelegation,
  SubAgentOptions
} from '../types/subAgent';
import { ISubAgent } from '../interfaces/ISubAgent';
import { logger } from '../utils/logger';

export class SubAgentTool extends BaseTool {
  readonly name = 'sub_agent';
  readonly description = 'Delegate focused tasks to specialized sub-agents for efficient processing';

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      task_description: {
        type: 'string',
        description: 'Clear description of the task to delegate to the sub-agent',
        minLength: 10,
        maxLength: 2000
      },
      specialization: {
        type: 'string',
        description: 'Type of sub-agent specialization needed for the task',
        enum: ['code', 'test', 'debug', 'docs', 'search', 'validation', 'general']
      },
      priority: {
        type: 'string',
        description: 'Priority level for task execution',
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      context: {
        type: 'object',
        description: 'Additional context information for the sub-agent',
        properties: {
          working_directory: {
            type: 'string',
            description: 'Working directory for the sub-agent'
          },
          files_to_focus: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific files the sub-agent should focus on'
          },
          constraints: {
            type: 'array',
            items: { type: 'string' },
            description: 'Any constraints or limitations for the task'
          }
        }
      },
      auto_detect_specialization: {
        type: 'boolean',
        description: 'Automatically detect optimal specialization based on task description',
        default: false
      }
    },
    required: ['task_description'],
    additionalProperties: false
  };

  private subAgentFactory: SubAgentFactory;
  private activeSubAgents: Map<string, ISubAgent> = new Map();

  constructor() {
    super();
    this.subAgentFactory = SubAgentFactory.getInstance();
  }

  /**
   * Execute task delegation to sub-agent
   */
  protected async executeImpl(params: any, abortSignal?: AbortSignal): Promise<ToolResult> {
    const {
      task_description,
      specialization,
      priority = 'medium',
      context = {},
      auto_detect_specialization = false
    } = params;

    try {
      // Determine specialization
      let targetSpecialization: SubAgentSpecialization;

      if (auto_detect_specialization || !specialization) {
        targetSpecialization = this.detectSpecialization(task_description);
        logger.debug(`Auto-detected specialization: ${targetSpecialization} for task: ${task_description.substring(0, 100)}...`);
      } else {
        targetSpecialization = specialization as SubAgentSpecialization;
      }

      // Create task delegation
      const taskId = uuidv4();
      const delegation: TaskDelegation = {
        taskId,
        description: `Delegated task: ${task_description}`,
        userInput: task_description,
        priority,
        context
      };

      // Get or create sub-agent
      const subAgent = await this.getOrCreateSubAgent(targetSpecialization);

      // Execute task
      const startTime = Date.now();
      const result = await subAgent.processTask(delegation);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return this.createErrorResult(
          `Sub-agent task failed: ${result.error?.message || 'Unknown error'}`,
          'SUB_AGENT_TASK_FAILED',
          [
            'Check if the task description is clear and complete',
            'Verify the specialization matches the task type',
            'Consider breaking down complex tasks into smaller parts'
          ]
        );
      }

      // Format successful result
      const output = {
        task_id: taskId,
        specialization: targetSpecialization,
        result: result.result,
        execution_time: executionTime,
        tools_used: result.metadata?.toolsUsed || [],
        sub_agent_id: subAgent.id
      };

      return this.createSuccessResult(output, {
        executionTime,
        delegationSuccessful: true,
        subAgentSpecialization: targetSpecialization
      });

    } catch (error) {
      return this.createErrorResult(
        `Failed to delegate task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DELEGATION_ERROR',
        [
          'Ensure the sub-agent system is properly initialized',
          'Check system resources and availability',
          'Verify the task description is valid'
        ]
      );
    }
  }

  /**
   * Get or create sub-agent for specialization
   */
  private async getOrCreateSubAgent(specialization: SubAgentSpecialization): Promise<ISubAgent> {
    // Check for existing idle sub-agent with this specialization
    for (const [agentId, agent] of this.activeSubAgents) {
      if (agent.specialization === specialization && agent.isReady()) {
        logger.debug(`Reusing existing sub-agent ${agentId} for specialization: ${specialization}`);
        return agent;
      }
    }

    // Create new sub-agent
    try {
      const subAgent = await this.subAgentFactory.createSpecializedAgent(specialization);
      this.activeSubAgents.set(subAgent.id, subAgent);

      logger.info(`Created new sub-agent ${subAgent.id} for specialization: ${specialization}`);

      // Clean up sub-agent after a period of inactivity
      this.scheduleCleanup(subAgent.id, 300000); // 5 minutes

      return subAgent;
    } catch (error) {
      logger.error(`Failed to create sub-agent for specialization ${specialization}:`, error instanceof Error ? error : new Error('Unknown error'));
      throw new ToolError(
        `Failed to create sub-agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SUB_AGENT_CREATION_FAILED'
      );
    }
  }

  /**
   * Detect optimal specialization based on task description
   */
  private detectSpecialization(taskDescription: string): SubAgentSpecialization {
    const task = taskDescription.toLowerCase();

    // Test-related patterns
    if (this.containsPatterns(task, ['test', 'spec', 'coverage', 'jest', 'mocha', 'pytest', 'unittest'])) {
      return 'test';
    }

    // Debug-related patterns
    if (this.containsPatterns(task, ['debug', 'error', 'fix', 'bug', 'troubleshoot', 'stack trace', 'exception'])) {
      return 'debug';
    }

    // Documentation patterns
    if (this.containsPatterns(task, ['document', 'readme', 'comment', 'docs', 'explain', 'api doc', 'jsdoc'])) {
      return 'docs';
    }

    // Search patterns
    if (this.containsPatterns(task, ['find', 'search', 'locate', 'discover', 'pattern', 'grep', 'look for'])) {
      return 'search';
    }

    // Validation patterns
    if (this.containsPatterns(task, ['lint', 'validate', 'check', 'verify', 'build', 'eslint', 'tsc'])) {
      return 'validation';
    }

    // Code patterns
    if (this.containsPatterns(task, ['implement', 'create', 'add', 'refactor', 'function', 'class', 'module', 'component'])) {
      return 'code';
    }

    // Default to general for complex or ambiguous tasks
    return 'general';
  }

  /**
   * Check if task contains any of the given patterns
   */
  private containsPatterns(task: string, patterns: string[]): boolean {
    return patterns.some(pattern => task.includes(pattern));
  }


  /**
   * Schedule cleanup of inactive sub-agent
   */
  private scheduleCleanup(agentId: string, delayMs: number): void {
    setTimeout(async () => {
      const agent = this.activeSubAgents.get(agentId);
      if (agent && agent.isReady()) {
        const status = agent.getStatus();
        const timeSinceLastActivity = Date.now() - status.lastActivity;

        // Only cleanup if agent has been idle for the full delay period
        if (timeSinceLastActivity >= delayMs) {
          try {
            await agent.shutdown();
            this.activeSubAgents.delete(agentId);
            logger.debug(`Cleaned up inactive sub-agent: ${agentId}`);
          } catch (error) {
            logger.error(`Failed to cleanup sub-agent ${agentId}:`, error instanceof Error ? error : new Error('Unknown error'));
          }
        }
      }
    }, delayMs);
  }

  /**
   * Get active sub-agents status
   */
  getActiveSubAgentsStatus(): Array<{
    id: string;
    specialization: SubAgentSpecialization;
    status: string;
    lastActivity: number;
  }> {
    return Array.from(this.activeSubAgents.values()).map(agent => {
      const status = agent.getStatus();
      return {
        id: agent.id,
        specialization: agent.specialization,
        status: status.state,
        lastActivity: status.lastActivity
      };
    });
  }

  /**
   * Shutdown all active sub-agents
   */
  async shutdownAllSubAgents(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    for (const [agentId, agent] of this.activeSubAgents) {
      shutdownPromises.push(
        agent.shutdown().catch(error =>
          logger.error(`Failed to shutdown sub-agent ${agentId}:`, error)
        )
      );
    }

    await Promise.allSettled(shutdownPromises);
    this.activeSubAgents.clear();

    logger.info('All sub-agents shut down via SubAgentTool');
  }

  /**
   * Get tool statistics
   */
  getStats(): {
    activeSubAgents: number;
    totalDelegations: number;
    subAgentsBySpecialization: Record<string, number>;
  } {
    const subAgentsBySpecialization: Record<string, number> = {};

    for (const agent of this.activeSubAgents.values()) {
      const spec = agent.specialization;
      subAgentsBySpecialization[spec] = (subAgentsBySpecialization[spec] || 0) + 1;
    }

    return {
      activeSubAgents: this.activeSubAgents.size,
      totalDelegations: 0, // Would need to track this in metadata
      subAgentsBySpecialization
    };
  }
}