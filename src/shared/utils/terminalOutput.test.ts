import { 
  calculateTerminalLines, 
  generateClearSequence, 
  calculateStreamingClearSequence 
} from './terminalOutput';

describe('Terminal Output Utilities', () => {
  describe('calculateTerminalLines', () => {
    it('should return 0 for empty content with no prefix', () => {
      const result = calculateTerminalLines('', { terminalWidth: 80 });
      expect(result).toBe(0);
    });

    it('should return 1 for empty content with prefix', () => {
      const result = calculateTerminalLines('', { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(1);
    });

    it('should handle single line that fits exactly in terminal width', () => {
      const content = 'A'.repeat(70); // 70 chars + 10 char prefix = 80 total
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(1);
    });

    it('should handle single line that requires wrapping', () => {
      const content = 'A'.repeat(80); // 80 chars + 10 char prefix = 90 total (wraps to 2 lines)
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(2);
    });

    it('should handle multiple logical lines without wrapping', () => {
      const content = 'Short line 1\nShort line 2\nShort line 3';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(3); // First line has prefix, others don't
    });

    it('should handle multiple logical lines with wrapping', () => {
      const longLine = 'A'.repeat(150); // Will wrap to 2 lines (150/80 = 1.875 → 2)
      const content = `${longLine}\nShort line\n${longLine}`;
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      // Line 1: 150 + 10 (prefix) = 160 chars → 2 terminal lines
      // Line 2: "Short line" → 1 terminal line  
      // Line 3: 150 chars → 2 terminal lines
      expect(result).toBe(5);
    });

    it('should handle empty lines in content', () => {
      const content = 'Line 1\n\nLine 3';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(3); // Each line (including empty) takes 1 terminal line
    });

    it('should handle realistic chatbot response', () => {
      const content = 'I am a coding assistant designed to help developers with tasks related to code understanding, debugging, and project management. I can read and analyze code, explain its functionality, help debug issues, and suggest improvements.';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      // Content length: 229 chars + 10 prefix = 239 chars
      // 239 / 80 = 2.9875 → 3 terminal lines
      expect(result).toBe(3);
    });

    it('should handle edge case of exactly terminal width boundary', () => {
      const content = 'A'.repeat(70); // With 10-char prefix = exactly 80
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      expect(result).toBe(1);
    });

    it('should handle very narrow terminal', () => {
      const content = 'Hello world';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 5, 
        prefix: 'Bot: ' 
      });
      // "Bot: Hello world" = 16 chars, 16/5 = 3.2 → 4 lines
      expect(result).toBe(4);
    });
  });

  describe('generateClearSequence', () => {
    it('should return empty string for 0 lines', () => {
      const result = generateClearSequence(0);
      expect(result).toBe('');
    });

    it('should return empty string for negative lines', () => {
      const result = generateClearSequence(-1);
      expect(result).toBe('');
    });

    it('should generate correct sequence for 1 line', () => {
      const result = generateClearSequence(1);
      expect(result).toBe('\r\x1b[2K');
    });

    it('should generate correct sequence for multiple lines', () => {
      const result = generateClearSequence(3);
      expect(result).toBe('\r\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K');
    });

    it('should generate correct sequence for large number of lines', () => {
      const result = generateClearSequence(10);
      const expected = '\r\x1b[2K' + '\x1b[1A\x1b[2K'.repeat(9);
      expect(result).toBe(expected);
    });
  });

  describe('calculateStreamingClearSequence', () => {
    it('should generate complete clear sequence for simple content', () => {
      const content = 'Hello world';
      const result = calculateStreamingClearSequence(content, 80, '🤖 Agent: ');
      
      // Should be 1 line, so sequence should clear 1 line
      expect(result).toBe('\r\x1b[2K');
    });

    it('should generate complete clear sequence for wrapping content', () => {
      const content = 'A'.repeat(150); // Will wrap to 2 lines with prefix
      const result = calculateStreamingClearSequence(content, 80, '🤖 Agent: ');
      
      // Should be 2 lines, so sequence should clear 2 lines
      expect(result).toBe('\r\x1b[2K\x1b[1A\x1b[2K');
    });

    it('should handle multi-line content', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const result = calculateStreamingClearSequence(content, 80, '🤖 Agent: ');
      
      // Should be 3 lines, so sequence should clear 3 lines
      expect(result).toBe('\r\x1b[2K\x1b[1A\x1b[2K\x1b[1A\x1b[2K');
    });

    it('should handle empty content', () => {
      const result = calculateStreamingClearSequence('', 80, '🤖 Agent: ');
      
      // Empty content with prefix still takes 1 line
      expect(result).toBe('\r\x1b[2K');
    });

    it('should handle realistic duplication scenario', () => {
      // This is the actual content from the user's bug report
      const content = 'I am a coding assistant designed to help developers with tasks related to code understanding, debugging, and project management. I can read and analyze code, explain its functionality, help debug issues, and suggest improvements. If you have any questions about your project or need assistance with coding tasks, feel free to ask!';
      const result = calculateStreamingClearSequence(content, 80, '🤖 Agent: ');
      
      // Calculate expected lines: 353 chars + 10 prefix = 363 chars
      // 363 / 80 = 4.5375 → 5 terminal lines
      const expectedLines = 5;
      const expectedSequence = '\r\x1b[2K' + '\x1b[1A\x1b[2K'.repeat(expectedLines - 1);
      expect(result).toBe(expectedSequence);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle Unicode characters in prefix', () => {
      const content = 'Hello';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 20, 
        prefix: '🤖🔥🚀 Agent: ' 
      });
      // Note: This test assumes each emoji takes 1 character width
      // In real terminals, emojis might take 2 character widths
      expect(result).toBe(1);
    });

    it('should handle very long single word that exceeds terminal width', () => {
      const content = 'A'.repeat(200);
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: 'Bot: ' 
      });
      // 200 + 5 = 205 chars, 205/80 = 2.5625 → 3 lines
      expect(result).toBe(3);
    });

    it('should handle content with only newlines', () => {
      const content = '\n\n\n';
      const result = calculateTerminalLines(content, { 
        terminalWidth: 80, 
        prefix: '🤖 Agent: ' 
      });
      // Should be 4 lines: prefix+"", "", "", ""
      expect(result).toBe(4);
    });

    it('should be consistent between calculateTerminalLines and calculateStreamingClearSequence', () => {
      const content = 'Test content that spans multiple lines\nSecond line here\nThird line';
      const terminalWidth = 80;
      const prefix = '🤖 Agent: ';
      
      const lineCount = calculateTerminalLines(content, { terminalWidth, prefix });
      const clearSequence = calculateStreamingClearSequence(content, terminalWidth, prefix);
      
      // The clear sequence should clear exactly the number of lines calculated
      const expectedSequence = generateClearSequence(lineCount);
      expect(clearSequence).toBe(expectedSequence);
    });
  });
});
