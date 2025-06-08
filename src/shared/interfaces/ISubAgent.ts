/**
 * Interface definitions for sub-agent system contracts
 */

import { SubAgentSpecialization, SubAgentStatus, TaskDelegation, TaskResult, SubAgentMessage } from '../types/subAgent';
import { BaseTool, ToolResult } from '../tools';

/**
 * Core interface for sub-agent implementations
 */
export interface ISubAgent {
  /** Unique identifier for this sub-agent */
  readonly id: string;
  
  /** Specialization of this sub-agent */
  readonly specialization: SubAgentSpecialization;
  
  /** Get current status of the sub-agent */
  getStatus(): SubAgentStatus;
  
  /** Initialize the sub-agent and its dependencies */
  initialize(): Promise<boolean>;
  
  /** Check if sub-agent is ready to process tasks */
  isReady(): boolean;
  
  /** Process a delegated task */
  processTask(delegation: TaskDelegation): Promise<TaskResult>;
  
  /** Get available tools for this sub-agent */
  getAvailableTools(): BaseTool[];
  
  /** Get current status information (duplicate removed) */
  
  /** Shutdown the sub-agent gracefully */
  shutdown(): Promise<void>;
}

/**
 * Interface for sub-agent management and coordination
 */
export interface ISubAgentManager {
  /** Create a new sub-agent with specified specialization */
  createSubAgent(specialization: SubAgentSpecialization, options?: any): Promise<ISubAgent>;
  
  /** Get sub-agent by ID */
  getSubAgent(id: string): ISubAgent | undefined;
  
  /** Get all active sub-agents */
  getActiveSubAgents(): ISubAgent[];
  
  /** Delegate task to appropriate sub-agent */
  delegateTask(task: TaskDelegation): Promise<TaskResult>;
  
  /** Shutdown specific sub-agent */
  shutdownSubAgent(id: string): Promise<void>;
  
  /** Shutdown all sub-agents */
  shutdownAllSubAgents(): Promise<void>;
  
  /** Get manager status */
  getManagerStatus(): {
    totalSubAgents: number;
    activeSubAgents: number;
    busySubAgents: number;
  };
}

/**
 * Interface for task delegation and routing
 */
export interface ITaskDelegator {
  /** Analyze task to determine if it should be delegated */
  shouldDelegate(userInput: string, context?: any): Promise<{
    shouldDelegate: boolean;
    reason: string;
    recommendedSpecialization?: SubAgentSpecialization;
    estimatedComplexity: 'low' | 'medium' | 'high';
  }>;
  
  /** Route task to appropriate sub-agent */
  routeTask(delegation: TaskDelegation): Promise<ISubAgent>;
  
  /** Combine results from multiple sub-agents */
  combineResults(results: TaskResult[]): Promise<string>;
}

/**
 * Interface for sub-agent communication coordination
 */
export interface ISubAgentCoordinator {
  /** Register a sub-agent with the coordinator */
  registerSubAgent(subAgent: ISubAgent): void;
  
  /** Unregister a sub-agent */
  unregisterSubAgent(id: string): void;
  
  /** Send message between agents */
  routeMessage(message: SubAgentMessage): Promise<void>;
  
  /** Broadcast message to all sub-agents */
  broadcastMessage(message: Omit<SubAgentMessage, 'to'>): Promise<void>;
  
  /** Subscribe to messages from specific sub-agent */
  subscribeToAgent(agentId: string, callback: (message: SubAgentMessage) => void): void;
  
  /** Get communication metrics */
  getCommunicationMetrics(): {
    totalMessages: number;
    activeChannels: number;
    errorCount: number;
  };
}

/**
 * Interface for monitoring sub-agent performance and health
 */
export interface ISubAgentMonitor {
  /** Start monitoring a sub-agent */
  startMonitoring(subAgent: ISubAgent): void;
  
  /** Stop monitoring a sub-agent */
  stopMonitoring(id: string): void;
  
  /** Get performance metrics for sub-agent */
  getMetrics(id: string): {
    tasksCompleted: number;
    averageExecutionTime: number;
    successRate: number;
    resourceUsage: {
      memory: number;
      cpu: number;
    };
  } | undefined;
  
  /** Get health status of sub-agent */
  getHealthStatus(id: string): 'healthy' | 'warning' | 'critical' | 'unknown';
  
  /** Get aggregated metrics for all sub-agents */
  getAggregatedMetrics(): {
    totalTasks: number;
    totalExecutionTime: number;
    overallSuccessRate: number;
    activeAgents: number;
  };
}

/**
 * Interface for sub-agent lifecycle management
 */
export interface ISubAgentLifecycle {
  /** Create and initialize a sub-agent */
  createAgent(specialization: SubAgentSpecialization, options?: any): Promise<ISubAgent>;
  
  /** Prepare sub-agent for task execution */
  prepareAgent(agent: ISubAgent): Promise<void>;
  
  /** Execute task on sub-agent */
  executeTask(agent: ISubAgent, task: TaskDelegation): Promise<TaskResult>;
  
  /** Clean up after task completion */
  cleanupAgent(agent: ISubAgent): Promise<void>;
  
  /** Destroy sub-agent and free resources */
  destroyAgent(agent: ISubAgent): Promise<void>;
}

/**
 * Interface for sub-agent factory implementations
 */
export interface ISubAgentFactory {
  /** Create sub-agent with default configuration for specialization */
  createSpecializedAgent(specialization: SubAgentSpecialization): Promise<ISubAgent>;
  
  /** Create sub-agent with custom configuration */
  createCustomAgent(specialization: SubAgentSpecialization, options: any): Promise<ISubAgent>;
  
  /** Get default configuration for specialization */
  getSpecializationConfig(specialization: SubAgentSpecialization): any;
  
  /** Register custom specialization configuration */
  registerSpecialization(name: string, config: any): void;
  
  /** Get supported specializations */
  getSupportedSpecializations(): SubAgentSpecialization[];
}