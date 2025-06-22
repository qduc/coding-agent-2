/**
 * Todo List Tool for the coding agent
 *
 * Provides in-memory todo list management to help with planning and tracking
 * complex coding tasks. Guides agents toward structured, step-by-step approaches
 * for better task completion and user transparency.
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult } from './types';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  created: Date;
  updated: Date;
}

export class TodoTool extends BaseTool {
  readonly name = 'todo';
  readonly description = `Manage an in-memory todo list for planning and tracking coding tasks.

**Planning Workflow Guidance:**
This tool encourages structured problem-solving by breaking complex tasks into manageable steps. Use it to:

1. **Plan Before Implementation**: When facing multi-step tasks (refactoring, feature additions, bug fixes), create todos first to map out the approach
2. **Track Progress**: Mark items complete as you work to maintain momentum and provide user visibility
3. **Maintain Context**: Use todos to remember next steps across conversation turns
4. **Decompose Complexity**: Break large tasks into smaller, actionable items

**When to Use:**
- Multi-step coding tasks (3+ distinct actions)
- Complex refactoring or architectural changes
- Feature implementations requiring multiple files
- Debugging workflows with multiple potential causes
- When user asks "how should I approach this?"

**Best Practices:**
- Start with high-level todos, then add details as you work
- Use specific, actionable descriptions ("Fix login validation" not "Fix bugs")
- Update status frequently to show progress
- Add new todos as you discover sub-tasks

Operations: add, list, complete, delete, clear`;

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'complete', 'delete', 'clear', 'init'],
        description: 'The action to perform on the todo list'
      },
      text: {
        type: 'string',
        description: 'Todo item text (string or array of strings for batch add/init; required for add/init actions)'
      },
      id: {
        type: 'string',
        description: 'Todo item ID (string or array of strings for batch complete/delete; required for complete/delete actions)'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Priority level (optional for add/init, defaults to medium)'
      }
    },
    required: ['action'],
    additionalProperties: false
  };

  private todos: Map<string, TodoItem> = new Map();
  private nextId = 1;

  protected async executeImpl(params: {
    action: 'add' | 'list' | 'complete' | 'delete' | 'clear' | 'init';
    text?: string | string[];
    id?: string | string[];
    priority?: 'low' | 'medium' | 'high';
  }, abortSignal?: AbortSignal): Promise<ToolResult> {
    const extractErrorMsg = (err: any) => typeof err === 'string' ? err : err?.message;
    switch (params.action) {
      case 'add': {
        if (Array.isArray(params.text)) {
          const results = params.text.map(text => this.addTodo(text, params.priority || 'medium'));
          const successes = results.filter(r => r.success);
          const errors = results.filter(r => !r.success);
          return this.createSuccessResult({
            message: `Added ${successes.length} of ${results.length} todo items`,
            added: successes.map(r => r.output?.id),
            errors: errors.map(r => extractErrorMsg(r.error)),
            total: this.todos.size
          });
        } else {
          return this.addTodo(params.text!, params.priority || 'medium');
        }
      }
      case 'list':
        return this.listTodos();
      case 'complete': {
        if (Array.isArray(params.id)) {
          const results = params.id.map(id => this.completeTodo(id));
          const successes = results.filter(r => r.success);
          const errors = results.filter(r => !r.success);
          return this.createSuccessResult({
            message: `Completed ${successes.length} of ${results.length} todo items`,
            completed: successes.map(r => r.output?.id),
            errors: errors.map(r => extractErrorMsg(r.error))
          });
        } else {
          return this.completeTodo(params.id!);
        }
      }
      case 'delete': {
        if (Array.isArray(params.id)) {
          const results = params.id.map(id => this.deleteTodo(id));
          const successes = results.filter(r => r.success);
          const errors = results.filter(r => !r.success);
          return this.createSuccessResult({
            message: `Deleted ${successes.length} of ${results.length} todo items`,
            deleted: successes.map(r => r.output?.id),
            errors: errors.map(r => extractErrorMsg(r.error))
          });
        } else {
          return this.deleteTodo(params.id!);
        }
      }
      case 'clear':
        return this.clearTodos();
      case 'init': {
        if (!params.text || !Array.isArray(params.text) || params.text.length === 0) {
          return this.createErrorResult(
            'Provide an array of todo item texts for init action',
            'INVALID_PARAMS',
            ['text must be a non-empty array of strings']
          );
        }
        return this.initTodos(params.text, params.priority || 'medium');
      }
      default:
        return this.createErrorResult(
          `Unknown action: ${params.action}`,
          'INVALID_PARAMS',
          ['Use one of: add, list, complete, delete, clear']
        );
    }
  }

  private addTodo(text: string, priority: 'low' | 'medium' | 'high'): ToolResult {
    if (!text?.trim()) {
      return this.createErrorResult(
        'Todo text cannot be empty',
        'INVALID_PARAMS',
        ['Provide a descriptive todo item text']
      );
    }

    const id = this.nextId.toString();
    this.nextId++;

    const todo: TodoItem = {
      id,
      text: text.trim(),
      completed: false,
      priority,
      created: new Date(),
      updated: new Date()
    };

    this.todos.set(id, todo);

    return this.createSuccessResult({
      message: `Added todo item: ${text}`,
      id,
      priority,
      total: this.todos.size
    });
  }

  private listTodos(): ToolResult {
    const todoList = Array.from(this.todos.values())
      .sort((a, b) => {
        // Sort by: incomplete first, then by priority (high->low), then by creation date
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }

        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }

        return a.created.getTime() - b.created.getTime();
      });

    if (todoList.length === 0) {
      return this.createSuccessResult({
        message: 'No todo items found',
        todos: [],
        summary: { total: 0, completed: 0, pending: 0 }
      });
    }

    const completed = todoList.filter(t => t.completed).length;
    const pending = todoList.length - completed;

    const formattedTodos = todoList.map(todo => ({
      id: todo.id,
      text: todo.text,
      completed: todo.completed,
      priority: todo.priority,
      status: todo.completed ? '✓' : '○'
    }));

    return this.createSuccessResult({
      message: `Found ${todoList.length} todo items (${pending} pending, ${completed} completed)`,
      todos: formattedTodos,
      summary: { total: todoList.length, completed, pending }
    });
  }

  private completeTodo(id: string): ToolResult {
    const todo = this.todos.get(id);
    if (!todo) {
      return this.createErrorResult(
        `Todo item with ID ${id} not found`,
        'INVALID_PARAMS',
        ['Check the todo ID with the list action', 'Use a valid todo ID']
      );
    }

    if (todo.completed) {
      return this.createSuccessResult({
        message: `Todo item "${todo.text}" was already completed`,
        id,
        alreadyCompleted: true
      });
    }

    todo.completed = true;
    todo.updated = new Date();
    this.todos.set(id, todo);

    return this.createSuccessResult({
      message: `Completed todo item: ${todo.text}`,
      id,
      text: todo.text,
      completedAt: todo.updated
    });
  }

  private deleteTodo(id: string): ToolResult {
    const todo = this.todos.get(id);
    if (!todo) {
      return this.createErrorResult(
        `Todo item with ID ${id} not found`,
        'INVALID_PARAMS',
        ['Check the todo ID with the list action', 'Use a valid todo ID']
      );
    }

    this.todos.delete(id);

    return this.createSuccessResult({
      message: `Deleted todo item: ${todo.text}`,
      id,
      text: todo.text,
      wasCompleted: todo.completed
    });
  }

  private clearTodos(): ToolResult {
    const count = this.todos.size;
    this.todos.clear();
    this.nextId = 1;

    return this.createSuccessResult({
      message: `Cleared all todo items (${count} items removed)`,
      itemsRemoved: count
    });
  }

  /**
   * Clears the todo list and adds a batch of new todos.
   * @param texts Array of todo item texts
   * @param priority Priority for all new todos
   */
  private initTodos(texts: string[], priority: 'low' | 'medium' | 'high'): ToolResult {
    this.todos.clear();
    this.nextId = 1;
    const results = texts.map(text => this.addTodo(text, priority));
    const successes = results.filter(r => r.success);
    const errors = results.filter(r => !r.success);
    return this.createSuccessResult({
      message: `Initialized todo list with ${successes.length} of ${results.length} items`,
      added: successes.map(r => r.output?.id),
      errors: errors.map(r => (typeof r.error === 'string' ? r.error : r.error?.message)),
      total: this.todos.size
    });
  }
}