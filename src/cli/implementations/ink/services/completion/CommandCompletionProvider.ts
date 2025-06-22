import { CompletionProvider, CompletionItem, CompletionType } from './CompletionProvider';

export class CommandCompletionProvider implements CompletionProvider {
  private availableCommands: Array<{ name: string; description: string }> = [
    { name: 'help', description: 'Show help information' },
    { name: 'quit', description: 'Quit the application' },
    { name: 'clear', description: 'Clear chat history and refresh project context' },
    { name: 'refresh', description: 'Refresh project context without clearing history' },
    { name: 'history', description: 'Show command history' },
    { name: 'status', description: 'Show application status' },
    { name: 'config', description: 'Show configuration' },
  ];

  async getCompletions(partial: string): Promise<CompletionItem[]> {
    if (partial === '') {
      return this.availableCommands.map(cmd => ({
        value: cmd.name,
        type: 'command' as CompletionType,
        description: cmd.description,
      }));
    }

    const filtered = this.availableCommands.filter(cmd =>
      cmd.name.toLowerCase().startsWith(partial.toLowerCase())
    );

    return filtered.map(cmd => ({
      value: cmd.name,
      type: 'command' as CompletionType,
      description: cmd.description,
    }));
  }

  canHandle(input: string, cursorPosition: number): boolean {
    if (!input.startsWith('/') || cursorPosition === 0) {
      return false;
    }

    // Don't show completions if input is already a complete command
    const command = input.substring(1).toLowerCase();
    const isCompleteCommand = this.availableCommands.some(cmd =>
      cmd.name.toLowerCase() === command
    );

    return !isCompleteCommand;
  }

  getType(): CompletionType {
    return 'command';
  }
}