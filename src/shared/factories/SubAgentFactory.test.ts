/**
 * SubAgentFactory tests
 */

import { SubAgentFactory, DEFAULT_SPECIALIZATION_CONFIGS } from './SubAgentFactory';
import { SubAgentSpecialization } from '../types/subAgent';

// Mock dependencies
jest.mock('../core/subAgent');
jest.mock('../communication/SubAgentMessaging');

describe('SubAgentFactory', () => {
  let factory: SubAgentFactory;

  beforeEach(() => {
    factory = SubAgentFactory.getInstance();
  });

  afterEach(async () => {
    await factory.shutdownAllAgents();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SubAgentFactory.getInstance();
      const instance2 = SubAgentFactory.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getSpecializationConfig', () => {
    it('should return default config for known specializations', () => {
      const codeConfig = factory.getSpecializationConfig('code');
      const testConfig = factory.getSpecializationConfig('test');
      
      expect(codeConfig).toBeDefined();
      expect(codeConfig.allowedTools).toContain('read');
      expect(codeConfig.allowedTools).toContain('write');
      
      expect(testConfig).toBeDefined();
      expect(testConfig.allowedTools).toContain('bash');
    });

    it('should throw error for unknown specialization', () => {
      expect(() => {
        factory.getSpecializationConfig('unknown' as SubAgentSpecialization);
      }).toThrow('No configuration found for specialization: unknown');
    });
  });

  describe('registerSpecialization', () => {
    it('should register custom specialization', () => {
      const customConfig = {
        allowedTools: ['read', 'write'],
        modelConfig: {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          profile: 'fast' as const,
          temperature: 0.1
        }
      };

      factory.registerSpecialization('custom', customConfig);
      
      const retrievedConfig = factory.getSpecializationConfig('custom' as SubAgentSpecialization);
      expect(retrievedConfig).toEqual(customConfig);
    });
  });

  describe('getSupportedSpecializations', () => {
    it('should return all supported specializations', () => {
      const specializations = factory.getSupportedSpecializations();
      
      expect(specializations).toContain('code');
      expect(specializations).toContain('test');
      expect(specializations).toContain('debug');
      expect(specializations).toContain('docs');
      expect(specializations).toContain('search');
      expect(specializations).toContain('validation');
      expect(specializations).toContain('general');
    });
  });

  describe('getFactoryStats', () => {
    it('should return factory statistics', () => {
      const stats = factory.getFactoryStats();
      
      expect(stats).toHaveProperty('totalAgentsCreated');
      expect(stats).toHaveProperty('activeAgents');
      expect(stats).toHaveProperty('agentsBySpecialization');
      expect(stats).toHaveProperty('communicationStats');
      
      expect(typeof stats.totalAgentsCreated).toBe('number');
      expect(typeof stats.activeAgents).toBe('number');
      expect(typeof stats.agentsBySpecialization).toBe('object');
    });
  });

  describe('DEFAULT_SPECIALIZATION_CONFIGS', () => {
    it('should have configs for all specializations', () => {
      const specializations: SubAgentSpecialization[] = [
        'code', 'test', 'debug', 'docs', 'search', 'validation', 'general'
      ];

      for (const spec of specializations) {
        expect(DEFAULT_SPECIALIZATION_CONFIGS[spec]).toBeDefined();
        expect(DEFAULT_SPECIALIZATION_CONFIGS[spec].allowedTools).toBeDefined();
        expect(Array.isArray(DEFAULT_SPECIALIZATION_CONFIGS[spec].allowedTools)).toBe(true);
        expect(DEFAULT_SPECIALIZATION_CONFIGS[spec].modelConfig).toBeDefined();
      }
    });

    it('should have appropriate tools for each specialization', () => {
      // Code specialization should have code-related tools
      expect(DEFAULT_SPECIALIZATION_CONFIGS.code.allowedTools).toContain('read');
      expect(DEFAULT_SPECIALIZATION_CONFIGS.code.allowedTools).toContain('write');
      expect(DEFAULT_SPECIALIZATION_CONFIGS.code.allowedTools).toContain('glob');

      // Test specialization should have testing tools
      expect(DEFAULT_SPECIALIZATION_CONFIGS.test.allowedTools).toContain('bash');
      
      // Debug specialization should have debugging tools
      expect(DEFAULT_SPECIALIZATION_CONFIGS.debug.allowedTools).toContain('ripgrep');
      
      // Search specialization should have search tools
      expect(DEFAULT_SPECIALIZATION_CONFIGS.search.allowedTools).toContain('glob');
      expect(DEFAULT_SPECIALIZATION_CONFIGS.search.allowedTools).toContain('ripgrep');
      
      // Validation should have system tools
      expect(DEFAULT_SPECIALIZATION_CONFIGS.validation.allowedTools).toContain('bash');
    });
  });
});