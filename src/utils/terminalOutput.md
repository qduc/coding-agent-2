# Terminal Output Utilities

This module provides utilities for handling complex terminal output scenarios, specifically for streaming content that needs to be replaced with formatted versions.

## Problem Solved

When streaming content to a terminal in real-time and then wanting to replace it with formatted content (e.g., replacing raw text with markdown-rendered text), you need to:

1. **Calculate exact terminal lines used** - Account for terminal line wrapping, not just logical newlines
2. **Generate proper clearing sequences** - Move cursor and clear exactly the right number of terminal lines
3. **Handle edge cases** - Empty content, very long lines, multiple newlines, Unicode characters

## Key Functions

### `calculateTerminalLines(content, options)`

Calculates the actual number of terminal lines used by content, accounting for:
- Terminal width and line wrapping
- Optional prefix on the first line (e.g., "🤖 Agent: ")
- Empty lines and multiple newlines

```typescript
const lines = calculateTerminalLines("Hello world", {
  terminalWidth: 80,
  prefix: "🤖 Agent: "
});
// Returns: 1 (fits in one terminal line)

const lines = calculateTerminalLines("A very long line that exceeds terminal width...", {
  terminalWidth: 40,
  prefix: "Bot: "
});
// Returns: 2 or more (depending on total length after wrapping)
```

### `generateClearSequence(linesToClear)`

Generates ANSI escape sequences to clear a specific number of terminal lines:

```typescript
const sequence = generateClearSequence(3);
// Returns: "\r\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K"
// This clears current line, moves up and clears 2 more lines
```

### `calculateStreamingClearSequence(content, terminalWidth, prefix)`

Convenience function that combines the above - calculates lines and generates clearing sequence:

```typescript
const clearSequence = calculateStreamingClearSequence(
  "Streamed content that was displayed",
  process.stdout.columns || 80,
  "🤖 Agent: "
);
process.stdout.write(clearSequence);
// This clears exactly the terminal lines used by the streamed content
```

## Usage in CLI

The main usage is in `src/cli/index.ts` for the streaming response replacement:

```typescript
// During streaming - content is written in real-time
process.stdout.write(chunk);
accumulatedResponse += chunk;

// After streaming - replace with formatted version
const clearSequence = calculateStreamingClearSequence(
  accumulatedResponse, 
  process.stdout.columns || 80, 
  '🤖 Agent: '
);
process.stdout.write(clearSequence);
console.log('🤖 Agent:', renderResponse(accumulatedResponse));
```

## Testing

Comprehensive test suite covers:
- Basic line counting scenarios
- Terminal width wrapping
- Multiple logical lines
- Edge cases (empty content, very long lines, Unicode)
- Integration between all functions
- Real-world duplication scenarios

Run tests: `npm test src/utils/terminalOutput.test.ts`

## Edge Cases Handled

1. **Empty content** - Returns appropriate line count with/without prefix
2. **Terminal wrapping** - Accurately calculates wrapped lines
3. **Unicode characters** - Properly handles emoji and special characters in prefix
4. **Very narrow terminals** - Works with any terminal width
5. **Multiple newlines** - Each logical line is counted separately
6. **Exact boundary conditions** - Content that exactly fits terminal width

## Performance

All functions are O(n) where n is the content length. Very efficient for typical terminal output scenarios.