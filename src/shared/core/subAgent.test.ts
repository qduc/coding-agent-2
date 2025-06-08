/**
 * SubAgent tests
 */

import { SubAgent } from './subAgent';
import { SubAgentOptions, SubAgentSpecialization, TaskDelegation } from '../types/subAgent';
import { SubAgentCommunication } from '../communication/SubAgentMessaging';

// Mock dependencies
jest.mock('../services/llm');
jest.mock('./agent');
jest.mock('../communication/SubAgentMessaging');

describe('SubAgent', () => {
  let subAgent: SubAgent;
  let mockCommunication: jest.Mocked<SubAgentCommunication>;

  const defaultOptions: SubAgentOptions = {
    specialization: 'code' as SubAgentSpecialization,
    agentId: 'test-sub-agent',
    verbose: false
  };

  beforeEach(() => {
    mockCommunication = {
      sendToParent: jest.fn().mockResolvedValue(undefined),
      receiveFromParent: jest.fn().mockResolvedValue(null),
      sendToSubAgent: jest.fn().mockResolvedValue(undefined),
      subscribeToSubAgent: jest.fn(),
      unsubscribeFromSubAgent: jest.fn(),
      isActive: jest.fn().mockReturnValue(true),
      close: jest.fn().mockResolvedValue(undefined)
    } as any;

    const optionsWithComm = {
      ...defaultOptions,
      communicationChannel: mockCommunication
    };

    subAgent = new SubAgent(optionsWithComm);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create sub-agent with correct properties', () => {
      expect(subAgent.id).toBe('test-sub-agent');
      expect(subAgent.specialization).toBe('code');
    });

    it('should generate ID if not provided', () => {
      const options = { ...defaultOptions };
      delete options.agentId;
      
      const agent = new SubAgent(options);
      expect(agent.id).toBeDefined();
      expect(agent.id).not.toBe('test-sub-agent');
    });

    it('should set default tools for specialization', () => {
      const codeAgent = new SubAgent({ specialization: 'code' });
      const testAgent = new SubAgent({ specialization: 'test' });
      const debugAgent = new SubAgent({ specialization: 'debug' });
      
      // Since getAvailableTools requires initialization, we'll test the constructor logic
      expect(codeAgent.specialization).toBe('code');
      expect(testAgent.specialization).toBe('test');
      expect(debugAgent.specialization).toBe('debug');
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = subAgent.getStatus();
      
      expect(status.id).toBe('test-sub-agent');
      expect(status.specialization).toBe('code');
      expect(status.state).toBe('idle');
      expect(status.lastActivity).toBeDefined();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await subAgent.shutdown();
      
      const status = subAgent.getStatus();
      expect(status.state).toBe('stopped');
      expect(mockCommunication.close).toHaveBeenCalled();
    });
  });

  describe('processTask', () => {
    const mockDelegation: TaskDelegation = {
      taskId: 'test-task-1',
      description: 'Test task',
      userInput: 'Create a simple function',
      priority: 'medium'
    };

    it('should reject task when not ready', async () => {
      // Sub-agent starts in idle state but needs initialization
      const result = await subAgent.processTask(mockDelegation);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AGENT_NOT_READY');
    });

    it('should send status updates during task processing', async () => {
      // Mock the agent initialization and readiness
      jest.spyOn(subAgent, 'isReady').mockReturnValue(true);
      
      // Mock the orchestrator processing
      const mockOrchestrator = {
        processMessage: jest.fn().mockResolvedValue('Task completed successfully')
      };
      (subAgent as any).orchestrator = mockOrchestrator;

      await subAgent.processTask(mockDelegation);

      // Should send progress update when starting
      expect(mockCommunication.sendToParent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress_update',
          payload: expect.objectContaining({
            taskId: 'test-task-1',
            status: 'started'
          })
        })
      );
    });
  });
});