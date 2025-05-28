import { EchoTool } from './echo';

describe('EchoTool', () => {
  it('should echo the message as is by default', async () => {
    const tool = new EchoTool();
    const result = await tool.invoke({ message: 'hello' });
    expect(result.success).toBe(true);
    expect(result.data).toContain('hello');
  });

  it('should echo the message in uppercase', async () => {
    const tool = new EchoTool();
    const result = await tool.invoke({ message: 'hello', uppercase: true });
    expect(result.data).toContain('HELLO');
  });

  it('should repeat the message', async () => {
    const tool = new EchoTool();
    const result = await tool.invoke({ message: 'hi', repeat: 3 });
    expect(result.data).toBe('hi hi hi');
  });

  it('should fail if message is empty', async () => {
    const tool = new EchoTool();
    // @ts-expect-error
    await expect(tool.invoke({ message: '' })).rejects.toThrow();
  });
});
