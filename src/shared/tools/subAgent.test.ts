/**
 * SubAgentTool tests
 */

import { SubAgentTool } from './subAgent';
import { SubAgentFactory } from '../factories/SubAgentFactory';
import { ISubAgent } from '../interfaces/ISubAgent';

// Mock dependencies
jest.mock('../factories/SubAgentFactory');
jest.mock('../utils/logger');

describe('SubAgentTool', () => {
  let tool: SubAgentTool;
  let mockFactory: jest.Mocked<SubAgentFactory>;
  let mockSubAgent: jest.Mocked<ISubAgent>;

  beforeEach(() => {
    mockSubAgent = {
      id: 'test-sub-agent-1',
      specialization: 'code',
      status: {
        id: 'test-sub-agent-1',
        state: 'idle',
        specialization: 'code',
        lastActivity: Date.now()
      },
      initialize: jest.fn().mockResolvedValue(true),
      isReady: jest.fn().mockReturnValue(true),
      processTask: jest.fn().mockResolvedValue({
        taskId: 'test-task',
        success: true,
        result: 'Task completed successfully',
        metadata: {
          toolsUsed: ['read', 'write'],
          executionTime: 1000
        }
      }),
      getAvailableTools: jest.fn().mockReturnValue([]),
      getStatus: jest.fn().mockReturnValue({
        id: 'test-sub-agent-1',
        state: 'idle',
        specialization: 'code',
        lastActivity: Date.now()
      }),
      shutdown: jest.fn().mockResolvedValue(undefined)
    } as any;

    mockFactory = {
      createSpecializedAgent: jest.fn().mockResolvedValue(mockSubAgent),
      getInstance: jest.fn().mockReturnThis()
    } as any;

    (SubAgentFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    tool = new SubAgentTool();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(tool.name).toBe('sub_agent');
      expect(tool.description).toContain('specialized sub-agents');
    });

    it('should have valid schema', () => {
      expect(tool.schema.type).toBe('object');
      expect(tool.schema.properties.task_description).toBeDefined();
      expect(tool.schema.properties.specialization).toBeDefined();
      expect(tool.schema.required).toContain('task_description');
    });
  });

  describe('executeImpl', () => {
    const validParams = {
      task_description: 'Create a simple function that adds two numbers',
      specialization: 'code',
      priority: 'medium'
    };

    it('should successfully delegate task to sub-agent', async () => {
      const result = await tool.execute(validParams);

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output.specialization).toBe('code');
      expect(result.output.result).toBe('Task completed successfully');
      expect(mockFactory.createSpecializedAgent).toHaveBeenCalledWith('code');
      expect(mockSubAgent.processTask).toHaveBeenCalled();
    });

    it('should auto-detect specialization when enabled', async () => {
      const params = {
        task_description: 'Write unit tests for the calculator function',
        auto_detect_specialization: true
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      // Should detect 'test' specialization from task description
      expect(mockFactory.createSpecializedAgent).toHaveBeenCalledWith('test');
    });

    it('should handle sub-agent task failure', async () => {
      mockSubAgent.processTask.mockResolvedValue({
        taskId: 'test-task',
        success: false,
        error: {
          message: 'Task execution failed',
          code: 'EXECUTION_ERROR'
        }
      });

      const result = await tool.execute(validParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect((result.error as any).code).toBe('SUB_AGENT_TASK_FAILED');
    });


    it('should reuse existing sub-agent when available', async () => {
      // First execution
      await tool.execute(validParams);

      // Second execution - should reuse the same sub-agent
      await tool.execute(validParams);

      // Factory should only be called once
      expect(mockFactory.createSpecializedAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('detectSpecialization', () => {
    const testCases = [
      { task: 'Write unit tests for my function', expected: 'test' },
      { task: 'Debug this error in my code', expected: 'debug' },
      { task: 'Create documentation for the API', expected: 'docs' },
      { task: 'Find all usages of this function', expected: 'search' },
      { task: 'Run lint checks on the codebase', expected: 'validation' },
      { task: 'Implement a new feature', expected: 'code' },
      { task: 'This is a complex multi-step task', expected: 'general' }
    ];

    testCases.forEach(({ task, expected }) => {
      it(`should detect ${expected} specialization for: "${task}"`, async () => {
        const params = {
          task_description: task,
          auto_detect_specialization: true
        };

        await tool.execute(params);

        expect(mockFactory.createSpecializedAgent).toHaveBeenCalledWith(expected);
      });
    });
  });

  describe('getActiveSubAgentsStatus', () => {
    it('should return status of active sub-agents', async () => {
      // Create some sub-agents
      await tool.execute({
        task_description: 'Test task 1',
        specialization: 'code'
      });

      const status = tool.getActiveSubAgentsStatus();

      expect(Array.isArray(status)).toBe(true);
      expect(status.length).toBeGreaterThan(0);
      expect(status[0]).toHaveProperty('id');
      expect(status[0]).toHaveProperty('specialization');
      expect(status[0]).toHaveProperty('status');
      expect(status[0]).toHaveProperty('lastActivity');
    });
  });

  describe('getStats', () => {
    it('should return tool statistics', () => {
      const stats = tool.getStats();

      expect(stats).toHaveProperty('activeSubAgents');
      expect(stats).toHaveProperty('totalDelegations');
      expect(stats).toHaveProperty('subAgentsBySpecialization');

      expect(typeof stats.activeSubAgents).toBe('number');
      expect(typeof stats.totalDelegations).toBe('number');
      expect(typeof stats.subAgentsBySpecialization).toBe('object');
    });
  });

  describe('shutdownAllSubAgents', () => {
    it('should shutdown all active sub-agents', async () => {
      // Create a sub-agent
      await tool.execute({
        task_description: 'Test task',
        specialization: 'code'
      });

      await tool.shutdownAllSubAgents();

      expect(mockSubAgent.shutdown).toHaveBeenCalled();
    });
  });
});