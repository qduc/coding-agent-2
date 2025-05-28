import { LSTool } from '../tools/ls';
import { ToolResult } from '../tools/types';

describe('LSTool', () => {
  const lsTool = new LSTool();

  it('should list files in a directory', async () => {
    const result = await lsTool.execute({ path: __dirname });
    expect(result.success).toBe(true);
    expect(Array.isArray(result.output)).toBe(true);
  });

  it('should filter files by pattern', async () => {
    const result = await lsTool.execute({ path: __dirname, pattern: '*.ts' });
    expect(result.success).toBe(true);
    expect(result.output.every((file: string) => file.endsWith('.ts'))).toBe(true);
  });

  it('should handle invalid paths', async () => {
    await expect(lsTool.execute({ path: '/invalid/path' })).rejects.toThrow();
  });
});
