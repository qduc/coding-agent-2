import { ClipboardProvider } from './ClipboardProvider';
import { MacOSClipboardProvider } from './MacOSClipboardProvider';
import { LinuxClipboardProvider } from './LinuxClipboardProvider';
import { WindowsClipboardProvider } from './WindowsClipboardProvider';

export class ClipboardManager implements ClipboardProvider {
  private provider: ClipboardProvider;

  constructor() {
    this.provider = this.createPlatformProvider();
  }

  async getContent(): Promise<string> {
    if (!this.provider.isAvailable()) {
      throw new Error('Clipboard not available on this platform');
    }
    return await this.provider.getContent();
  }

  async setContent(content: string): Promise<void> {
    if (!this.provider.isAvailable()) {
      throw new Error('Clipboard not available on this platform');
    }
    return await this.provider.setContent(content);
  }

  isAvailable(): boolean {
    return this.provider.isAvailable();
  }

  private createPlatformProvider(): ClipboardProvider {
    const providers = [
      new MacOSClipboardProvider(),
      new LinuxClipboardProvider(),
      new WindowsClipboardProvider(),
    ];

    const availableProvider = providers.find(provider => provider.isAvailable());
    
    if (!availableProvider) {
      // Return a no-op provider for unsupported platforms
      return {
        async getContent(): Promise<string> {
          throw new Error('Clipboard not supported on this platform');
        },
        async setContent(content: string): Promise<void> {
          throw new Error('Clipboard not supported on this platform');
        },
        isAvailable(): boolean {
          return false;
        }
      };
    }

    return availableProvider;
  }
}