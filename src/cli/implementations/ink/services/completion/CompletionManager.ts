import { CompletionProvider, CompletionItem } from './CompletionProvider';

export class CompletionManager {
  private providers: CompletionProvider[] = [];

  addProvider(provider: CompletionProvider): void {
    this.providers.push(provider);
  }

  removeProvider(provider: CompletionProvider): void {
    const index = this.providers.indexOf(provider);
    if (index !== -1) {
      this.providers.splice(index, 1);
    }
  }

  async getCompletions(input: string, cursorPosition: number): Promise<CompletionItem[]> {
    // Find the first provider that can handle this input
    const activeProvider = this.providers.find(provider => 
      provider.canHandle(input, cursorPosition)
    );

    if (!activeProvider) {
      return [];
    }

    try {
      const partial = this.extractPartialInput(input, cursorPosition, activeProvider);
      return await activeProvider.getCompletions(partial);
    } catch (error) {
      console.error('Error getting completions:', error);
      return [];
    }
  }

  getActiveProvider(input: string, cursorPosition: number): CompletionProvider | null {
    return this.providers.find(provider => 
      provider.canHandle(input, cursorPosition)
    ) || null;
  }

  private extractPartialInput(
    input: string, 
    cursorPosition: number, 
    provider: CompletionProvider
  ): string {
    const type = provider.getType();
    
    if (type === 'file') {
      const lastAtIndex = input.lastIndexOf('@');
      if (lastAtIndex !== -1 && lastAtIndex < cursorPosition) {
        const afterAt = input.substring(lastAtIndex + 1, cursorPosition);
        const spaceIndex = afterAt.indexOf(' ');
        return spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
      }
    } else if (type === 'command') {
      if (input.startsWith('/') && cursorPosition > 0) {
        return input.substring(1, cursorPosition);
      }
    }

    return '';
  }
}