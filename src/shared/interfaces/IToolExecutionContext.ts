/**
 * Interface for tool execution context
 */
export interface IToolExecutionContext {
  /**
   * Current working directory for tools
   */
  workingDirectory: string;

  /**
   * Environment variables and settings
   */
  environment: Record<string, unknown>;

  /**
   * Access permissions for tools
   */
  permissions: {
    fileSystem: boolean;
    network: boolean;
    shell: boolean;
  };

  /**
   * Update execution context
   * @param context Partial context to merge
   */
  setContext(context: Partial<Omit<IToolExecutionContext, 'setContext' | 'getContext'>>): void;

  /**
   * Get current context
   */
  getContext(): Omit<IToolExecutionContext, 'setContext' | 'getContext'>;

  /**
   * Validate access for a specific tool operation
   * @param operation Operation type to validate
   * @throws Error if operation is not permitted
   */
  validateAccess(operation: 'fileSystem' | 'network' | 'shell'): void;
}
