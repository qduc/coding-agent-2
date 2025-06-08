export type CompletionType = 'file' | 'command';

export interface CompletionItem {
  value: string;
  type: CompletionType;
  description?: string;
}

export interface CompletionProvider {
  /**
   * Get completions for a partial input
   */
  getCompletions(partial: string): Promise<CompletionItem[]>;

  /**
   * Check if this provider should handle the given input
   */
  canHandle(input: string, cursorPosition: number): boolean;

  /**
   * Get the completion type this provider handles
   */
  getType(): CompletionType;
}