import { execSync } from 'child_process';
import { ClipboardProvider } from './ClipboardProvider';

export class LinuxClipboardProvider implements ClipboardProvider {
  async getContent(): Promise<string> {
    try {
      let content = '';
      
      // Try xclip first
      try {
        content = execSync('xclip -selection clipboard -o', { encoding: 'utf8' });
      } catch {
        try {
          // Try xsel
          content = execSync('xsel --clipboard --output', { encoding: 'utf8' });
        } catch {
          // Try wl-paste for Wayland
          content = execSync('wl-paste', { encoding: 'utf8' });
        }
      }
      
      return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    } catch (error) {
      throw new Error(`Failed to get clipboard content: ${error}`);
    }
  }

  async setContent(content: string): Promise<void> {
    try {
      // Try xclip first
      try {
        execSync('xclip -selection clipboard', { 
          input: content, 
          encoding: 'utf8' 
        });
      } catch {
        try {
          // Try xsel
          execSync('xsel --clipboard --input', { 
            input: content, 
            encoding: 'utf8' 
          });
        } catch {
          // Try wl-copy for Wayland
          execSync('wl-copy', { 
            input: content, 
            encoding: 'utf8' 
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to set clipboard content: ${error}`);
    }
  }

  isAvailable(): boolean {
    return process.platform === 'linux';
  }
}