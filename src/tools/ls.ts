import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError } from './types';
import globby from 'globby';
import { validatePath } from './validation';

export class LSTool extends BaseTool {
  name = 'ls';
  description = 'List directory contents with optional filtering';

  schema: ToolSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list' },
      pattern: { type: 'string', description: 'Glob pattern to filter files', default: '*' },
      recursive: { type: 'boolean', description: 'Enable recursive directory traversal', default: false },
      maxDepth: { type: 'number', description: 'Maximum depth for recursive traversal', default: 3 },
      includeHidden: { type: 'boolean', description: 'Include hidden files/directories', default: false },
    },
    required: ['path'],
  };

  async executeImpl(params: any): Promise<ToolResult> {
    const { path, pattern = '*', recursive = false, maxDepth = 3, includeHidden = false } = params;

    try {
      validatePath(path);

      const files = await globby.globby(pattern, {
        cwd: path,
        onlyFiles: false,
        deep: recursive ? maxDepth : 0,
        dot: includeHidden,
      });

      return { success: true, output: files };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: new ToolError(message, 'DIRECTORY_ERROR') };
    }
  }
}
