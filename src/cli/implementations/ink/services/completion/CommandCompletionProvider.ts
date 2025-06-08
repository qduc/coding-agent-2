import { CompletionProvider, CompletionItem, CompletionType } from './CompletionProvider';

export class CommandCompletionProvider implements CompletionProvider {
  private availableCommands: Array<{ name: string; description: string }> = [
    { name: 'help', description: 'Show help information' },
    { name: 'exit', description: 'Exit the application' },
    { name: 'quit', description: 'Quit the application' },
    { name: 'q', description: 'Quick quit' },
    { name: 'clear', description: 'Clear the screen' },
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
    return input.startsWith('/') && cursorPosition > 0;
  }

  getType(): CompletionType {
    return 'command';
  }
}