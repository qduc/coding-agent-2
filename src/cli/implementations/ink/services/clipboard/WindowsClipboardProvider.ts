import { execSync } from 'child_process';
import { ClipboardProvider } from './ClipboardProvider';

export class WindowsClipboardProvider implements ClipboardProvider {
  async getContent(): Promise<string> {
    try {
      const content = execSync('powershell.exe -Command "Get-Clipboard"', { 
        encoding: 'utf8' 
      });
      return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    } catch (error) {
      throw new Error(`Failed to get clipboard content: ${error}`);
    }
  }

  async setContent(content: string): Promise<void> {
    try {
      execSync('powershell.exe -Command "Set-Clipboard"', { 
        input: content, 
        encoding: 'utf8' 
      });
    } catch (error) {
      throw new Error(`Failed to set clipboard content: ${error}`);
    }
  }

  isAvailable(): boolean {
    return process.platform === 'win32';
  }
}