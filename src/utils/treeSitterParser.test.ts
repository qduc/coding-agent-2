import { TreeSitterParser } from './treeSitterParser';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

describe('TreeSitterParser', () => {
  let parser: TreeSitterParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new TreeSitterParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('should initialize successfully', async () => {
    await parser.initialize();
    expect(parser).toBeDefined();
  });

  it('should analyze TypeScript code correctly', async () => {
    const code = `
export interface User {
  id: number;
  name: string;
}

export class UserService {
  async getUser(id: number): Promise<User | null> {
    return null;
  }

  createUser(userData: Omit<User, 'id'>): User {
    return { id: Date.now(), ...userData };
  }
}

export function validateUser(user: User): boolean {
  return user.id > 0 && user.name.length > 0;
}
`;

    const filePath = path.join(tempDir, 'test.ts');
    await fs.writeFile(filePath, code);

    const analysis = await parser.analyzeFile(filePath);

    expect(analysis.filePath).toBe(filePath);
    expect(analysis.language).toBe('typescript');
    expect(analysis.symbols.length).toBeGreaterThan(0);
    expect(analysis.exports.length).toBeGreaterThan(0);
    expect(analysis.errors).toHaveLength(0);

    // Check for specific symbols
    const userInterface = analysis.symbols.find(s => s.name === 'User' && s.type === 'interface');
    expect(userInterface).toBeDefined();

    const userServiceClass = analysis.symbols.find(s => s.name === 'UserService' && s.type === 'class');
    expect(userServiceClass).toBeDefined();

    const validateUserFunction = analysis.symbols.find(s => s.name === 'validateUser' && s.type === 'function');
    expect(validateUserFunction).toBeDefined();
    expect(validateUserFunction?.isAsync).toBe(false);
  });

  it('should handle JavaScript code', async () => {
    const code = `
function hello(name) {
  return "Hello, " + name;
}

const greet = (person) => {
  console.log(hello(person));
};

module.exports = { hello, greet };
`;

    const filePath = path.join(tempDir, 'test.js');
    await fs.writeFile(filePath, code);

    const analysis = await parser.analyzeFile(filePath);

    expect(analysis.language).toBe('javascript');
    expect(analysis.symbols.length).toBeGreaterThan(0);

    const helloFunction = analysis.symbols.find(s => s.name === 'hello');
    expect(helloFunction).toBeDefined();
    expect(helloFunction?.type).toBe('function');
  });

  it('should handle unsupported file types gracefully', async () => {
    const filePath = path.join(tempDir, 'test.unknown');
    await fs.writeFile(filePath, 'some content');

    const analysis = await parser.analyzeFile(filePath);

    expect(analysis.language).toBe('unknown');
    expect(analysis.symbols).toHaveLength(0);
    expect(analysis.errors).toContain('Unsupported or unknown language');
  });

  it('should handle file read errors gracefully', async () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.ts');

    const analysis = await parser.analyzeFile(nonExistentFile);

    expect(analysis.language).toBe('typescript');
    expect(analysis.symbols).toHaveLength(0);
    expect(analysis.errors.length).toBeGreaterThan(0);
  });
});
