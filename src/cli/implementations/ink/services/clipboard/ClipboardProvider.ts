export interface ClipboardProvider {
  /**
   * Get clipboard content
   */
  getContent(): Promise<string>;

  /**
   * Set clipboard content
   */
  setContent(content: string): Promise<void>;

  /**
   * Check if clipboard provider is available on current platform
   */
  isAvailable(): boolean;
}