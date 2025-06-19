import { spawn } from 'child_process';
import path from 'path';

describe('Approval integration (manual)', () => {
  it('shows approval prompt for file write when enabled', (done) => {
    // This test is for manual/CI verification: it spawns the CLI with approval required
    const cliPath = path.resolve(__dirname, '../../dist/cli/index.js');
    const env = { ...process.env, CODING_AGENT_REQUIRE_APPROVAL: '1' };
    const child = spawn('node', [cliPath, 'write to testfile.txt'], { env });
    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Approve') && output.includes('Deny')) {
        child.kill();
        done();
      }
    });
    child.stderr.on('data', (data) => {
      // Ignore
    });
    child.on('error', done);
    child.on('exit', () => {
      // done() is called above
    });
  });
});
