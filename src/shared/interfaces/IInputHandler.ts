/**
 * Interface for handling user input in both CLI and interactive modes
 */
export interface IInputHandler {
  /**
   * Read raw input from the user
   * @param prompt Optional prompt to display
   * @returns Promise resolving to the user's input
   */
  readInput(prompt?: string): Promise<string>;

  /**
   * Read and parse a command with arguments
   * @returns Promise resolving to parsed command and arguments
   */
  readCommand(): Promise<{command: string; args: string[]}>;

  /**
   * Start interactive chat mode
   * @param onInput Callback for handling each input
   * @param onEnd Callback when interactive mode ends
   */
  handleInteractiveMode(
    onInput: (input: string) => Promise<void>,
    onEnd: () => void
  ): Promise<void>;
}
