/**
 * Tests for TodoTool
 */

import { TodoTool } from './todo';
import { ToolContext } from './types';

describe('TodoTool', () => {
  let tool: TodoTool;

  beforeEach(() => {
    const context: Partial<ToolContext> = {
      timeout: 5000,
      workingDirectory: '/test'
    };
    tool = new TodoTool(context);
  });

  describe('add action', () => {
    it('should add a new todo item', async () => {
      const result = await tool.execute({
        action: 'add',
        text: 'Test todo item',
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('Added todo item: Test todo item');
      expect(result.output.id).toBe('1');
      expect(result.output.priority).toBe('high');
      expect(result.output.total).toBe(1);
    });

    it('should default to medium priority', async () => {
      const result = await tool.execute({
        action: 'add',
        text: 'Test todo item'
      });

      expect(result.success).toBe(true);
      expect(result.output.priority).toBe('medium');
    });

    it('should reject empty text', async () => {
      const result = await tool.execute({
        action: 'add',
        text: '   '
      });

      expect(result.success).toBe(false);
      expect((result.error as any)?.message).toBe('Todo text cannot be empty');
    });

    it('should trim whitespace from text', async () => {
      await tool.execute({
        action: 'add',
        text: '  Test todo item  '
      });

      const listResult = await tool.execute({ action: 'list' });
      expect(listResult.output.todos[0].text).toBe('Test todo item');
    });
  });

  describe('list action', () => {
    it('should return empty list when no todos exist', async () => {
      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.output.message).toBe('No todo items found');
      expect(result.output.todos).toEqual([]);
      expect(result.output.summary).toEqual({ total: 0, completed: 0, pending: 0 });
    });

    it('should list todos sorted by completion status and priority', async () => {
      // Add todos with different priorities
      await tool.execute({ action: 'add', text: 'Low priority', priority: 'low' });
      await tool.execute({ action: 'add', text: 'High priority', priority: 'high' });
      await tool.execute({ action: 'add', text: 'Medium priority', priority: 'medium' });
      
      // Complete one todo
      await tool.execute({ action: 'complete', id: '1' });

      const result = await tool.execute({ action: 'list' });

      expect(result.success).toBe(true);
      expect(result.output.todos).toHaveLength(3);
      
      // Check sorting: incomplete first, then by priority (high -> medium -> low)
      const todos = result.output.todos;
      expect(todos[0].text).toBe('High priority');
      expect(todos[0].completed).toBe(false);
      expect(todos[1].text).toBe('Medium priority');
      expect(todos[1].completed).toBe(false);
      expect(todos[2].text).toBe('Low priority');
      expect(todos[2].completed).toBe(true);
      
      expect(result.output.summary).toEqual({ total: 3, completed: 1, pending: 2 });
    });

    it('should include status symbols', async () => {
      await tool.execute({ action: 'add', text: 'Test todo' });
      await tool.execute({ action: 'complete', id: '1' });
      await tool.execute({ action: 'add', text: 'Another todo' });

      const result = await tool.execute({ action: 'list' });
      const todos = result.output.todos;
      
      // Pending todo should have ○, completed should have ✓
      expect(todos.find((t: any) => t.text === 'Another todo')?.status).toBe('○');
      expect(todos.find((t: any) => t.text === 'Test todo')?.status).toBe('✓');
    });
  });

  describe('complete action', () => {
    beforeEach(async () => {
      await tool.execute({ action: 'add', text: 'Test todo' });
    });

    it('should complete a todo item', async () => {
      const result = await tool.execute({ action: 'complete', id: '1' });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('Completed todo item: Test todo');
      expect(result.output.id).toBe('1');
      expect(result.output.text).toBe('Test todo');
      expect(result.output.completedAt).toBeDefined();
    });

    it('should handle already completed todos gracefully', async () => {
      // Complete once
      await tool.execute({ action: 'complete', id: '1' });
      
      // Complete again
      const result = await tool.execute({ action: 'complete', id: '1' });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('was already completed');
      expect(result.output.alreadyCompleted).toBe(true);
    });

    it('should return error for non-existent todo', async () => {
      const result = await tool.execute({ action: 'complete', id: '999' });

      expect(result.success).toBe(false);
      expect((result.error as any)?.message).toContain('Todo item with ID 999 not found');
    });
  });

  describe('delete action', () => {
    beforeEach(async () => {
      await tool.execute({ action: 'add', text: 'Test todo' });
    });

    it('should delete a todo item', async () => {
      const result = await tool.execute({ action: 'delete', id: '1' });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('Deleted todo item: Test todo');
      expect(result.output.id).toBe('1');
      expect(result.output.text).toBe('Test todo');
      expect(result.output.wasCompleted).toBe(false);
    });

    it('should track completion status of deleted items', async () => {
      await tool.execute({ action: 'complete', id: '1' });
      const result = await tool.execute({ action: 'delete', id: '1' });

      expect(result.success).toBe(true);
      expect(result.output.wasCompleted).toBe(true);
    });

    it('should return error for non-existent todo', async () => {
      const result = await tool.execute({ action: 'delete', id: '999' });

      expect(result.success).toBe(false);
      expect((result.error as any)?.message).toContain('Todo item with ID 999 not found');
    });

    it('should remove item from list', async () => {
      await tool.execute({ action: 'delete', id: '1' });
      const listResult = await tool.execute({ action: 'list' });

      expect(listResult.output.todos).toHaveLength(0);
    });
  });

  describe('clear action', () => {
    it('should clear empty list', async () => {
      const result = await tool.execute({ action: 'clear' });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('Cleared all todo items (0 items removed)');
      expect(result.output.itemsRemoved).toBe(0);
    });

    it('should clear all todos', async () => {
      await tool.execute({ action: 'add', text: 'Todo 1' });
      await tool.execute({ action: 'add', text: 'Todo 2' });
      await tool.execute({ action: 'add', text: 'Todo 3' });

      const result = await tool.execute({ action: 'clear' });

      expect(result.success).toBe(true);
      expect(result.output.message).toContain('Cleared all todo items (3 items removed)');
      expect(result.output.itemsRemoved).toBe(3);
    });

    it('should reset ID counter after clear', async () => {
      await tool.execute({ action: 'add', text: 'Todo 1' });
      await tool.execute({ action: 'clear' });
      
      const result = await tool.execute({ action: 'add', text: 'New todo' });
      expect(result.output.id).toBe('1');
    });
  });

  describe('parameter validation', () => {
    it('should require action parameter', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect((result.error as any)?.code).toBe('VALIDATION_ERROR');
    });

    it('should require text for add action', async () => {
      const result = await tool.execute({ action: 'add' });

      expect(result.success).toBe(false);
      expect((result.error as any)?.code).toBe('INVALID_PARAMS');
    });

    it('should require id for complete action', async () => {
      const result = await tool.execute({ action: 'complete' });

      expect(result.success).toBe(false);
      expect((result.error as any)?.code).toBe('INVALID_PARAMS');
    });

    it('should require id for delete action', async () => {
      const result = await tool.execute({ action: 'delete' });

      expect(result.success).toBe(false);
      expect((result.error as any)?.code).toBe('INVALID_PARAMS');
    });

    it('should reject invalid actions', async () => {
      const result = await tool.execute({ action: 'invalid' as any });

      expect(result.success).toBe(false);
      expect((result.error as any)?.message).toContain('must be one of: add, list, complete, delete, clear');
    });

    it('should validate priority values', async () => {
      const result = await tool.execute({
        action: 'add',
        text: 'Test',
        priority: 'invalid' as any
      });

      expect(result.success).toBe(false);
      expect((result.error as any)?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ID generation', () => {
    it('should generate sequential IDs', async () => {
      const result1 = await tool.execute({ action: 'add', text: 'Todo 1' });
      const result2 = await tool.execute({ action: 'add', text: 'Todo 2' });
      const result3 = await tool.execute({ action: 'add', text: 'Todo 3' });

      expect(result1.output.id).toBe('1');
      expect(result2.output.id).toBe('2');
      expect(result3.output.id).toBe('3');
    });

    it('should continue sequence after deletions', async () => {
      await tool.execute({ action: 'add', text: 'Todo 1' });
      await tool.execute({ action: 'add', text: 'Todo 2' });
      await tool.execute({ action: 'delete', id: '1' });
      
      const result = await tool.execute({ action: 'add', text: 'Todo 3' });
      expect(result.output.id).toBe('3');
    });
  });
});