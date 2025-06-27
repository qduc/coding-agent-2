import { parseLlamaToolCalls } from './llamaToolCallParser';

describe('parseLlamaToolCalls', () => {
  it('parses a single tool call', () => {
    const input = '[ls(path="/Users/qduc/src/temp/tetris")]';
    expect(parseLlamaToolCalls(input)).toEqual([
      { name: 'ls', args: { path: '/Users/qduc/src/temp/tetris' } }
    ]);
  });

  it('parses multiple tool calls', () => {
    const input = '[ls(path="/foo"), read(file="bar.txt", lines="1-10")]';
    expect(parseLlamaToolCalls(input)).toEqual([
      { name: 'ls', args: { path: '/foo' } },
      { name: 'read', args: { file: 'bar.txt', lines: '1-10' } }
    ]);
  });

  it('parses numbers as strings', () => {
    const input = '[foo(x=42, y="bar")]';
    expect(parseLlamaToolCalls(input)).toEqual([
      { name: 'foo', args: { x: '42', y: 'bar' } }
    ]);
  });

  it('returns empty array if no tool call', () => {
    expect(parseLlamaToolCalls('no tool call here')).toEqual([]);
  });
});
