/**
 * Tests for ProjectDiscovery utility
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { ProjectDiscovery, ProjectDiscoveryResult } from './projectDiscovery';

describe('ProjectDiscovery', () => {
  let tempDir: string;
  let discovery: ProjectDiscovery;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-discovery-test-'));
    discovery = new ProjectDiscovery(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir && await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }
  });

  describe('Basic Discovery', () => {
    it('should create discovery instance', () => {
      expect(discovery).toBeDefined();
    });

    it('should discover empty project', async () => {
      const result = await discovery.discover();

      expect(result).toBeDefined();
      expect(result.executedAt).toBeInstanceOf(Date);
      expect(result.workingDirectory).toBe(tempDir);
      expect(result.summary).toContain('project analysis');
    });
  });

  describe('Node.js Project Discovery', () => {
    it('should detect Node.js project with package.json', async () => {
      // Create a package.json file
      await fs.writeJSON(path.join(tempDir, 'package.json'), {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '^4.18.0',
          typescript: '^5.0.0'
        }
      });

      // Create src directory and index.js
      await fs.ensureDir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("Hello World");');

      // Create README
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project');

      const result = await discovery.discover();

      expect(result.summary).toContain('Node.js/JavaScript project');
      expect(result.techStack).toContain('package.json');
      expect(result.entryPoints).toContain('./README.md');
      expect(result.entryPoints).toContain('./index.js');
    });
  });

  describe('Python Project Discovery', () => {
    it('should detect Python project with requirements.txt', async () => {
      // Create requirements.txt
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0\nrequests==2.28.0');

      // Create main.py
      await fs.writeFile(path.join(tempDir, 'main.py'), 'print("Hello Python")');

      const result = await discovery.discover();

      expect(result.summary).toContain('Python project');
      expect(result.techStack).toContain('requirements.txt');
      expect(result.entryPoints).toContain('./main.py');
    });
  });

  describe('Static Methods', () => {
    it('should format discovery result for system prompt', async () => {
      const mockResult: ProjectDiscoveryResult = {
        projectStructure: 'test-project/\n├── src/\n└── package.json',
        techStack: '=== ./package.json ===\n{"name": "test"}',
        entryPoints: ['./README.md', './index.js'],
        summary: 'test-project project analysis:\n📦 Node.js/JavaScript project',
        executedAt: new Date(),
        workingDirectory: tempDir
      };

      const formatted = ProjectDiscovery.formatForSystemPrompt(mockResult);

      expect(formatted).toContain('PROJECT CONTEXT:');
      expect(formatted).toContain('Node.js/JavaScript project');
      expect(formatted).toContain('Project Structure:');
      expect(formatted).toContain('Tech Stack:');
      expect(formatted).toContain('Entry Points:');
    });
  });

  describe('Fallback Methods', () => {
    // Mock the execSync function to simulate command not found
    let execSyncSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.resetModules();
      const childProcess = require('child_process');
      execSyncSpy = jest.spyOn(childProcess, 'execSync');
    });

    afterEach(() => {
      execSyncSpy.mockRestore();
    });

    it('should use tree representation fallback when tree command fails', async () => {
      // Mock tree command to fail but allow find commands to work
      execSyncSpy.mockImplementation((command: string) => {
        if (command.includes('tree')) {
          throw new Error('command not found: tree');
        }

        // Mock basic find results for directory structure
        if (command.includes('find') && command.includes('type d')) {
          return './\n./src\n./test';
        }

        // Mock file listing
        if (command.includes('find') && command.includes('type f')) {
          return './package.json\n./README.md';
        }

        return '';
      });

      const result = await discovery.discover();

      expect(result.projectStructure).toBeDefined();
      expect(result.projectStructure).not.toContain('Unable to determine');
      expect(execSyncSpy).toHaveBeenCalled();
    });

    it('should fallback to basic tech stack detection when find command fails', async () => {
      // Create a package.json file for direct detection
      await fs.writeJSON(path.join(tempDir, 'package.json'), {
        name: "test-fallback",
        version: "1.0.0"
      });

      // Mock find command to fail for tech stack detection
      execSyncSpy.mockImplementation((command: string) => {
        if (command.includes('package.json') && command.includes('find')) {
          throw new Error('find: not found');
        }

        // Allow other commands to work normally
        if (command.includes('tree')) {
          return 'test-project\n├── package.json\n└── README.md';
        }

        return '';
      });

      const result = await discovery.discover();

      expect(result.techStack).toContain('package.json');
      expect(result.summary).toContain('Node.js');
    });

    it('should handle every command failing gracefully', async () => {
      // Make all commands fail
      execSyncSpy.mockImplementation(() => {
        throw new Error('command execution failed');
      });

      const result = await discovery.discover();

      // Even if everything fails, we should get sensible defaults with silent handling
      expect(result.projectStructure).toBe('');
      expect(result.techStack).toBe('');
      expect(result.entryPoints).toEqual([]);
    });

    it('should detect tech stack using file checks when commands fail', async () => {
      // Create multiple stack files to test direct file checking
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0');
      await fs.writeFile(path.join(tempDir, 'tsconfig.json'), '{"compilerOptions":{}}');

      execSyncSpy.mockImplementation((command: string) => {
        throw new Error('command execution failed');
      });

      const result = await discovery.discover();

      expect(result.techStack).toContain('requirements.txt');
      expect(result.techStack).toContain('TypeScript');
    });
  });

  describe('Error Handling', () => {
    it('should handle directory without standard project files', async () => {
      // Just create some random files
      await fs.writeFile(path.join(tempDir, 'random.txt'), 'random content');

      const result = await discovery.discover();

      expect(result).toBeDefined();
      expect(result.techStack).toContain('');
    });
  });
});
