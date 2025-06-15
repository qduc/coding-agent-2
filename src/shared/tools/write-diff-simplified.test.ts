/**
 * Simplified unit tests for WriteTool diff mode functionality
 * Focuses on core diff features that should definitely work
 */

import fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { WriteTool } from '../../src/shared/tools/write';
import { ToolContext, ToolError } from '../../src/shared/tools/types';

// Mock the toolContextManager for isolated testing
jest.mock('../../src/shared/utils/ToolContextManager', () => ({
  toolContextManager: {
    recordFileWrite: jest.fn(),
    validateWriteOperation: jest.fn(() => ({
      isValid: true,
      warnings: [],
      suggestions: []
    }))
  }
}));

describe('WriteTool Diff Mode - Core Functionality', () => {
  let writeTool: WriteTool;
  let testDir: string;
  let testFile: string;
  let context: ToolContext;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-diff-test-'));
    testFile = path.join(testDir, 'test.js');

    context = {
      maxFileSize: 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.js', '.ts', '.json', '.txt', '.md'],
      blockedPaths: [],
      workingDirectory: testDir
    };

    writeTool = new WriteTool(context);
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    try {
      await fs.remove(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
    process.env.NODE_ENV = undefined;
  });

  describe('Simple Diff Operations', () => {
    beforeEach(async () => {
      const initialContent = `function greet(name) {
  console.log("Hello, " + name);
  return "greeting complete";
}

function calculate(a, b) {
  return a + b;
}

const config = {
  debug: false,
  timeout: 5000
};`;
      await fs.writeFile(testFile, initialContent, 'utf8');
    });

    test('should apply single-line replacement', async () => {
      const diff = `function greet(name) {
-  console.log("Hello, " + name);
+  console.log("Hi there, " + name + "!");
  return "greeting complete";`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log("Hi there, " + name + "!");');
      expect(content).not.toContain('console.log("Hello, " + name);');
    });

    test('should apply multiple line additions', async () => {
      const diff = `function greet(name) {
  console.log("Hello, " + name);
+  console.log("Debug: greeting user");
+  console.log("Timestamp: " + new Date());
  return "greeting complete";`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log("Debug: greeting user");');
      expect(content).toContain('console.log("Timestamp: " + new Date());');
    });

    test('should apply line deletions', async () => {
      const diff = `function calculate(a, b) {
-  return a + b;
}`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).not.toContain('return a + b;');
      expect(content).toContain('function calculate(a, b) {\n}');
    });

    test('should apply mixed additions and deletions', async () => {
      const diff = `const config = {
-  debug: false,
+  debug: true,
+  verbose: true,
  timeout: 5000`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('debug: true,');
      expect(content).toContain('verbose: true,');
      expect(content).not.toContain('debug: false,');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const content = `function test() {
  console.log('test');
  return true;
}`;
      await fs.writeFile(testFile, content, 'utf8');
    });

    test('should reject empty diff', async () => {
      const result = await writeTool.execute({ path: testFile, diff: '' });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('Empty diff provided');
    });

    test('should reject diff without changes', async () => {
      const diff = `function test() {
  console.log('test');
  return true;
}`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('no additions or deletions found');
    });

    test('should reject diff with no context', async () => {
      const diff = `+console.log('new line');
+console.log('another new line');`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('requires at least one context line');
    });

    test('should reject diff with non-matching context', async () => {
      const diff = `function nonexistent() {
-  console.log('test');
+  console.log('updated');
  return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('No matching context found');
    });

    test('should reject diff on non-existent file', async () => {
      const nonExistentFile = path.join(testDir, 'nonexistent.js');
      const diff = `function test() {
-  console.log('test');
+  console.log('updated');
}`;

      const result = await writeTool.execute({ path: nonExistentFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('File does not exist');
    });
  });

  describe('Context Matching', () => {
    beforeEach(async () => {
      const content = `  function test() {
    console.log('hello');
        return true;
  }`;
      await fs.writeFile(testFile, content, 'utf8');
    });

    test('should match context with different indentation', async () => {
      const diff = `function test() {
-console.log('hello');
+console.log('hello world');
return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log(\'hello world\');');
    });

    test('should match context with extra whitespace', async () => {
      const diff = `function test() {
-    console.log('hello');
+    console.log('hello world');
        return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
    });
  });

  describe('Line Count Tracking', () => {
    beforeEach(async () => {
      const content = `line1
line2
line3
line4`;
      await fs.writeFile(testFile, content, 'utf8');
    });

    test('should correctly count lines added', async () => {
      const diff = `line1
line2
+added1
+added2
+added3
line3`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
      expect((result.output as any)?.linesChanged).toBe(3);
    });

    test('should correctly count lines removed', async () => {
      const diff = `line1
-line2
-line3
line4`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
      expect((result.output as any)?.linesChanged).toBe(2);
    });

    test('should correctly count mixed changes', async () => {
      const diff = `line1
-line2
+replacement1
+replacement2
line3
-line4
+replacement3`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
      expect((result.output as any)?.linesChanged).toBe(5); // 2 removed + 3 added
    });
  });

  describe('Segmented Diff Format', () => {
    beforeEach(async () => {
      const initialContent = `import React from 'react';
import { useState } from 'react';

function Header() {
  return <h1>My App</h1>;
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  return (
    <form>
      <input value={username} onChange={e => setUsername(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}

function Footer() {
  return <footer>© 2024</footer>;
}`;
      await fs.writeFile(testFile, initialContent, 'utf8');
    });

    test('should apply segmented diff with @@ separator', async () => {
      const diff = `function Header() {
-  return <h1>My App</h1>;
+  return <h1>My Awesome App</h1>;
}
@@
function Footer() {
-  return <footer>© 2024</footer>;
+  return <footer>© 2024 My Company</footer>;
}`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('<h1>My Awesome App</h1>');
      expect(content).toContain('<footer>© 2024 My Company</footer>');
    });
  });

  describe('Complex Cases', () => {
    test('should handle unicode and special characters', async () => {
      const unicodeContent = `function test() {
  console.log('Hello 世界');
  const emoji = '🚀✨';
  return 'café';
}`;
      await fs.writeFile(testFile, unicodeContent, 'utf8');

      const diff = `function test() {
  console.log('Hello 世界');
-  const emoji = '🚀✨';
+  const emoji = '🌟💻';
+  const symbols = 'α β γ δ';
  return 'café';`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('const emoji = \'🌟💻\';');
      expect(content).toContain('const symbols = \'α β γ δ\';');
    });

    test('should handle large files efficiently', async () => {
      // Create a large file
      const largeContent = Array.from({ length: 1000 }, (_, i) => 
        `function func${i}() {\n  console.log('Function ${i}');\n  return ${i};\n}`
      ).join('\n\n');
      
      await fs.writeFile(testFile, largeContent, 'utf8');

      const diff = `function func500() {
-  console.log('Function 500');
+  console.log('Function 500 - Updated');
  return 500;`;

      const startTime = Date.now();
      const result = await writeTool.execute({ path: testFile, diff });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});