/**
 * Comprehensive unit tests for WriteTool diff mode functionality
 * Tests both simple and segmented diff formats with complex scenarios
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

describe('WriteTool Diff Mode', () => {
  let writeTool: WriteTool;
  let testDir: string;
  let testFile: string;
  let context: ToolContext;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'write-diff-test-'));
    testFile = path.join(testDir, 'test.js');

    // Mock context
    context = {
      maxFileSize: 1024 * 1024,
      timeout: 30000,
      allowHidden: false,
      allowedExtensions: ['.js', '.ts', '.json', '.txt', '.md'],
      blockedPaths: [],
      workingDirectory: testDir
    };

    writeTool = new WriteTool(context);

    // Set test environment
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

  describe('Simple Diff Format', () => {
    beforeEach(async () => {
      // Create initial file content
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

    test('should apply simple single-line replacement', async () => {
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

    test('should apply multiple line deletions', async () => {
      const diff = `function calculate(a, b) {
-  return a + b;
-}
-
const config = {`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).not.toContain('return a + b;');
      expect(content).toContain('function calculate(a, b) {\nconst config = {');
    });

    test('should handle mixed additions and deletions', async () => {
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

    test('should handle context-only diffs (no changes)', async () => {
      const diff = `function greet(name) {
  console.log("Hello, " + name);
  return "greeting complete";`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('no additions or deletions found');
    });

    test('should preserve indentation in additions', async () => {
      const diff = `function greet(name) {
  console.log("Hello, " + name);
+    if (name === "admin") {
+      console.log("Admin access granted");
+    }
  return "greeting complete";`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('    if (name === "admin") {');
      expect(content).toContain('      console.log("Admin access granted");');
    });

    test('should handle empty line additions and deletions', async () => {
      const diff = `  return "greeting complete";
}

+
function calculate(a, b) {`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      const lines = content.split('\n');
      const greetEndIndex = lines.findIndex(line => line === '}');
      expect(lines[greetEndIndex + 1]).toBe('');
      expect(lines[greetEndIndex + 2]).toBe('');
    });
  });

  describe('Segmented Diff Format', () => {
    beforeEach(async () => {
      // Create larger file for segmented testing
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
}

export default function App() {
  return (
    <div>
      <Header />
      <LoginForm />
      <Footer />
    </div>
  );
}`;
      await fs.writeFile(testFile, initialContent, 'utf8');
    });

    test('should apply segmented diff with ... separator', async () => {
      const diff = `import React from 'react';
-import { useState } from 'react';
+import { useState, useEffect } from 'react';
+import axios from 'axios';

function Header() {
...
function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
+  const [loading, setLoading] = useState(false);
  
  return (`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('import { useState, useEffect } from \'react\';');
      expect(content).toContain('import axios from \'axios\';');
      expect(content).toContain('const [loading, setLoading] = useState(false);');
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

    test('should handle multiple segments with complex changes', async () => {
      const diff = `import React from 'react';
import { useState } from 'react';
+import PropTypes from 'prop-types';

function Header() {
...
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
+  const [error, setError] = useState('');
  
  return (
    <form>
-      <input value={username} onChange={e => setUsername(e.target.value)} />
-      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
+      {error && <div className="error">{error}</div>}
+      <input 
+        value={username} 
+        onChange={e => setUsername(e.target.value)}
+        placeholder="Username"
+      />
+      <input 
+        type="password" 
+        value={password} 
+        onChange={e => setPassword(e.target.value)}
+        placeholder="Password"
+      />
      <button type="submit">Login</button>
...
export default function App() {
  return (
    <div>
+      <div className="container">
      <Header />
      <LoginForm />
      <Footer />
+      </div>
    </div>
  );`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('import PropTypes from \'prop-types\';');
      expect(content).toContain('const [error, setError] = useState(\'\');');
      expect(content).toContain('{error && <div className="error">{error}</div>}');
      expect(content).toContain('placeholder="Username"');
      expect(content).toContain('<div className="container">');
    });

    test('should handle segments with only additions', async () => {
      const diff = `import React from 'react';
import { useState } from 'react';
+
+const API_URL = 'https://api.example.com';
+const TIMEOUT = 5000;

function Header() {
...
function LoginForm() {
+  // Enhanced login form with validation
  const [username, setUsername] = useState('');`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('const API_URL = \'https://api.example.com\';');
      expect(content).toContain('const TIMEOUT = 5000;');
      expect(content).toContain('// Enhanced login form with validation');
    });

    test('should handle segments with only deletions', async () => {
      const diff = `function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
-  
  return (
...
    <form>
      <input value={username} onChange={e => setUsername(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
-      <button type="submit">Login</button>
    </form>`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).not.toContain('<button type="submit">Login</button>');
      // Should not have extra blank line
      expect(content).not.toMatch(/useState\(''\);\s+\s+return \(/);
    });
  });

  describe('Complex Edge Cases', () => {
    test('should handle file with Windows line endings', async () => {
      const windowsContent = "function test() {\r\n  console.log('hello');\r\n  return true;\r\n}";
      await fs.writeFile(testFile, windowsContent, 'utf8');

      const diff = `function test() {
-  console.log('hello');
+  console.log('hello world');
  return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log(\'hello world\');');
    });

    test('should handle mixed indentation (tabs vs spaces)', async () => {
      const mixedContent = `function test() {
\tconsole.log('tab indented');
  console.log('space indented');
\t  console.log('mixed indented');
}`;
      await fs.writeFile(testFile, mixedContent, 'utf8');

      const diff = `function test() {
\tconsole.log('tab indented');
-  console.log('space indented');
+  console.log('space indented - updated');
\t  console.log('mixed indented');`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('console.log(\'space indented - updated\');');
    });

    test('should handle very long lines', async () => {
      const longLine = 'const veryLongVariableName = "this is a very long string that goes on and on and on and might be used to test how the diff handles very long lines of code that exceed normal line length limits";';
      const longContent = `function test() {
  ${longLine}
  return true;
}`;
      await fs.writeFile(testFile, longContent, 'utf8');

      const diff = `function test() {
-  ${longLine}
+  const shortVar = "updated";
  return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('const shortVar = "updated";');
      expect(content).not.toContain('veryLongVariableName');
    });

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

    test('should handle nested object/array structures', async () => {
      const complexContent = `const config = {
  database: {
    host: 'localhost',
    port: 5432,
    credentials: {
      username: 'admin',
      password: 'secret'
    }
  },
  features: ['auth', 'logging', 'cache'],
  settings: {
    debug: false,
    maxConnections: 100
  }
};`;
      await fs.writeFile(testFile, complexContent, 'utf8');

      const diff = `const config = {
  database: {
    host: 'localhost',
-    port: 5432,
+    port: 3306,
+    type: 'mysql',
    credentials: {
      username: 'admin',
-      password: 'secret'
+      password: process.env.DB_PASSWORD
    }
  },
-  features: ['auth', 'logging', 'cache'],
+  features: ['auth', 'logging', 'cache', 'monitoring'],
  settings: {`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toContain('port: 3306,');
      expect(content).toContain('type: \'mysql\',');
      expect(content).toContain('password: process.env.DB_PASSWORD');
      expect(content).toContain('\'monitoring\'');
    });

    test('should handle empty file edge case', async () => {
      await fs.writeFile(testFile, '', 'utf8');

      const diff = `+function hello() {
+  console.log('Hello World');
+}`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('requires at least one context line');
    });

    test('should handle single-line file', async () => {
      await fs.writeFile(testFile, 'console.log("single line");', 'utf8');

      const diff = `-console.log("single line");
+console.log("updated single line");`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('requires at least one context line');
    });

    test('should handle single-line file with context', async () => {
      await fs.writeFile(testFile, 'console.log("single line");', 'utf8');

      const diff = `console.log("single line");
+console.log("added line");`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('console.log("single line");\nconsole.log("added line");');
    });
  });

  describe('Error Handling and Validation', () => {
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

    test('should reject diff with no context for location matching', async () => {
      const diff = `+console.log('new line');
+console.log('another new line');`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('requires at least one context line');
    });

    test('should reject diff with ambiguous context', async () => {
      // Create file with duplicate content
      const duplicateContent = `function test() {
  console.log('test');
  return true;
}

function test() {
  console.log('test');
  return true;
}`;
      await fs.writeFile(testFile, duplicateContent, 'utf8');

      const diff = `function test() {
-  console.log('test');
+  console.log('updated');
  return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('Multiple matching contexts found');
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

    test('should reject segmented diff with overlapping segments', async () => {
      const content = `line1
line2
line3
line4
line5`;
      await fs.writeFile(testFile, content, 'utf8');

      const diff = `line1
-line2
+updated2
line3
...
line2
-line3
+updated3
line4`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('overlap');
    });

    test('should reject binary file diff', async () => {
      // Create a binary-like file with null bytes
      const binaryContent = 'text\0\0\0binary\0\0content';
      await fs.writeFile(testFile, binaryContent, 'utf8');

      const diff = `text
-binary
+updated
content`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('Cannot apply diff to binary content');
    });

    test('should handle diff that results in content too large', async () => {
      // Mock a very small max file size
      const smallContext = { ...context, maxFileSize: 100 };
      const smallTool = new WriteTool(smallContext);

      const diff = `function test() {
  console.log('test');
+  console.log('${'x'.repeat(200)}'); // Add a very long line
  return true;`;

      const result = await smallTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('exceeds maximum allowed size');
    });

    test('should provide helpful error messages for malformed segments', async () => {
      const diff = `function test() {
+  console.log('added');
...
+  console.log('orphaned addition');`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(false);
      expect((result.error as ToolError)?.message).toContain('no context lines');
    });
  });

  describe('Context Matching Algorithms', () => {
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

    test('should match context with normalized whitespace', async () => {
      const diff = `function test() {
-console.log(  'hello'  );
+console.log('hello world');
return true;`;

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
    });

    test('should handle partial matching for very long lines', async () => {
      const longContent = `function test() {
  const veryLongLine = "this is a very long line with lots of text that might have small differences but should still match in context";
  return true;
}`;
      await fs.writeFile(testFile, longContent, 'utf8');

      const diff = `function test() {
-  const veryLongLine = "this is a very long line with lots of text that might have small differences but should still match in context";
+  const shortLine = "updated";
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

  describe('CSS Multi-Section Diff Test', () => {
    test('should handle CSS diff with interspersed additions across multiple sections', async () => {
      // Create initial CSS file content
      const initialCssContent = `body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    background-color: #1a1a1a;
    color: #eee;
    font-family: monospace;
}

h1 {
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
}

.game-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.game-area {
    background-color: #222;
    background-image:
        repeating-linear-gradient(#333 0 1px, transparent 1px 20px),
        repeating-linear-gradient(90deg, #333 0 1px, transparent 1px 20px);
}

canvas {
    border: 2px solid #666;
    background-color: #000;
}

.next-piece-box,
.score-box {
    background-color: #333;
    border: 1px solid #666;
}

#nextPieceCanvas {
    background-color: #000;
    border: 1px solid #666;
}`;

      const cssFile = path.join(testDir, 'styles.css');
      await fs.writeFile(cssFile, initialCssContent, 'utf8');

      // Apply the CSS diff with interspersed additions
      const cssDiff = `body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    margin: 0;
    background-color: #1a1a1a;
    color: #eee;
    font-family: monospace;
}

+body.light-mode {
+    background-color: #f0f0f0;
+    color: #333;
+}
+
+body.light-mode .game-area {
+    background-color: #ddd;
+    background-image:
+        repeating-linear-gradient(#ccc 0 1px, transparent 1px 20px),
+        repeating-linear-gradient(90deg, #ccc 0 1px, transparent 1px 20px);
+}
+
+body.light-mode canvas {
+    border: 2px solid #333;
+    background-color: #fff;
+}
+
+body.light-mode .next-piece-box,
+body.light-mode .score-box {
+    background-color: #e0e0e0;
+    border: 1px solid #999;
+}
+
+body.light-mode #nextPieceCanvas {
+    background-color: #fff;
+    border: 1px solid #999;
+}

h1 {
    margin-bottom: 20px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
}

+body.light-mode h1 {
+    text-shadow: 2px 2px 4px rgba(255,255,255,0.7);
+}

.game-container {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
}`;

      const result = await writeTool.execute({ path: cssFile, diff: cssDiff });
      expect(result.success).toBe(true);

      const updatedContent = await fs.readFile(cssFile, 'utf8');
      
      // Verify all light-mode styles were added
      expect(updatedContent).toContain('body.light-mode {');
      expect(updatedContent).toContain('background-color: #f0f0f0;');
      expect(updatedContent).toContain('color: #333;');
      expect(updatedContent).toContain('body.light-mode .game-area {');
      expect(updatedContent).toContain('body.light-mode canvas {');
      expect(updatedContent).toContain('body.light-mode .next-piece-box,');
      expect(updatedContent).toContain('body.light-mode .score-box {');
      expect(updatedContent).toContain('body.light-mode #nextPieceCanvas {');
      expect(updatedContent).toContain('body.light-mode h1 {');
      expect(updatedContent).toContain('text-shadow: 2px 2px 4px rgba(255,255,255,0.7);');
      
      // Verify original content is preserved
      expect(updatedContent).toContain('font-family: monospace;');
      expect(updatedContent).toContain('margin-bottom: 20px;');
      expect(updatedContent).toContain('position: relative;');
      
      // Verify structure and order
      const bodyIndex = updatedContent.indexOf('body {');
      const lightModeIndex = updatedContent.indexOf('body.light-mode {');
      const h1Index = updatedContent.indexOf('h1 {');
      const lightModeH1Index = updatedContent.indexOf('body.light-mode h1 {');
      const gameContainerIndex = updatedContent.indexOf('.game-container {');
      
      expect(bodyIndex).toBeLessThan(lightModeIndex);
      expect(lightModeIndex).toBeLessThan(h1Index);
      expect(h1Index).toBeLessThan(lightModeH1Index);
      expect(lightModeH1Index).toBeLessThan(gameContainerIndex);
    });
  });

  describe('Performance and Stress Tests', () => {
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

    test('should handle many small segments efficiently', async () => {
      const content = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');
      await fs.writeFile(testFile, content, 'utf8');

      // Create segmented diff with many small changes
      const segments = Array.from({ length: 10 }, (_, i) => {
        const lineNum = i * 10;
        return `line${lineNum}
-line${lineNum + 1}
+updated${lineNum + 1}
line${lineNum + 2}`;
      });

      const diff = segments.join('\n...\n');

      const result = await writeTool.execute({ path: testFile, diff });
      expect(result.success).toBe(true);
    });
  });
});