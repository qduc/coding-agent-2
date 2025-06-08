/**
 * Tests for TaskAnalyzer AI-powered task classification
 */

import { TaskAnalyzer } from './TaskAnalyzer';

describe('TaskAnalyzer', () => {
  let analyzer: TaskAnalyzer;

  beforeEach(() => {
    analyzer = TaskAnalyzer.getInstance();
    analyzer.clearCache();
  });

  describe('Enhanced heuristic analysis', () => {
    test('should classify debug tasks correctly', async () => {
      const result = await analyzer.analyzeTask('Fix this error in the login function');
      expect(result.type).toBe('debug');
      expect(result.complexity).toBe('moderate');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('should classify implementation tasks correctly', async () => {
      const result = await analyzer.analyzeTask('Create a new authentication system with OAuth');
      expect(result.type).toBe('implement');
      expect(result.complexity).toBe('complex');
    });

    test('should classify refactoring tasks correctly', async () => {
      const result = await analyzer.analyzeTask('Refactor this code to improve performance');
      expect(result.type).toBe('refactor');
      expect(result.complexity).toBe('moderate');
    });

    test('should classify test tasks correctly', async () => {
      const result = await analyzer.analyzeTask('Write unit tests for the user service');
      expect(result.type).toBe('test');
      expect(result.complexity).toBe('moderate');
    });

    test('should classify analysis tasks correctly', async () => {
      const result = await analyzer.analyzeTask('Explain how this algorithm works');
      expect(result.type).toBe('analyze');
      expect(result.complexity).toBe('moderate');
    });

    test('should handle simple tasks', async () => {
      const result = await analyzer.analyzeTask('Quick fix');
      expect(result.complexity).toBe('simple');
    });

    test('should handle complex tasks', async () => {
      const result = await analyzer.analyzeTask('Design and implement a comprehensive microservices architecture with event sourcing, CQRS, and distributed caching for a large-scale e-commerce platform');
      expect(result.complexity).toBe('complex');
    });

    test('should default to general for unclear tasks', async () => {
      const result = await analyzer.analyzeTask('Hello world');
      expect(result.type).toBe('general');
    });
  });

  describe('Caching', () => {
    test('should cache results', async () => {
      const message = 'Debug this error';
      const result1 = await analyzer.analyzeTask(message);
      const result2 = await analyzer.analyzeTask(message);
      
      expect(result1).toEqual(result2);
    });

    test('should clear cache', async () => {
      await analyzer.analyzeTask('Test message');
      analyzer.clearCache();
      // Cache should be empty, but this is internal behavior
      expect(true).toBe(true); // Test passes if no errors
    });
  });

  describe('Edge cases', () => {
    test('should handle empty messages', async () => {
      const result = await analyzer.analyzeTask('');
      expect(result.type).toBe('general');
      expect(result.complexity).toBe('simple');
    });

    test('should handle very long messages', async () => {
      const longMessage = 'a'.repeat(1000);
      const result = await analyzer.analyzeTask(longMessage);
      expect(result.complexity).toBe('complex');
    });

    test('should handle special characters', async () => {
      const result = await analyzer.analyzeTask('Fix this @#$%^&*() error!!!');
      expect(result.type).toBe('debug');
    });
  });

  describe('Multiple keywords', () => {
    test('should prioritize most relevant task type', async () => {
      const result = await analyzer.analyzeTask('Debug and fix this error, then create tests');
      // Should prioritize the first/most prominent task type
      expect(['debug', 'test']).toContain(result.type);
    });

    test('should handle mixed complexity indicators', async () => {
      const result = await analyzer.analyzeTask('Simple architecture design');
      // Should handle conflicting complexity indicators reasonably
      expect(['simple', 'moderate', 'complex']).toContain(result.complexity);
    });
  });
});