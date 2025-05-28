/**
 * Example usage and testing of the BaseTool system
 *
 * This file demonstrates how to use the BaseTool infrastructure
 * and can be used for manual testing during development.
 */

import { EchoTool } from './tools/echo';
import chalk from 'chalk';

async function testBaseTool() {
  console.log(chalk.yellow('🧪 Testing BaseTool Infrastructure'));
  console.log(chalk.gray('─'.repeat(50)));

  const echoTool = new EchoTool();

  // Test 1: Basic functionality
  console.log(chalk.cyan('Test 1: Basic Echo'));
  try {
    const result1 = await echoTool.execute({ message: 'Hello, World!' });
    console.log('✅ Success:', result1.data);
    console.log('📊 Metadata:', JSON.stringify(result1.metadata, null, 2));
  } catch (error) {
    console.log('❌ Error:', error);
  }

  console.log();

  // Test 2: With formatting
  console.log(chalk.cyan('Test 2: Echo with Formatting'));
  try {
    const result2 = await echoTool.execute({
      message: 'coding agent',
      uppercase: true,
      repeat: 3
    });
    console.log('✅ Success:', result2.data);
    console.log('📊 Metadata:', JSON.stringify(result2.metadata, null, 2));
  } catch (error) {
    console.log('❌ Error:', error);
  }

  console.log();

  // Test 3: Validation error
  console.log(chalk.cyan('Test 3: Validation Error'));
  try {
    const result3 = await echoTool.execute({
      message: '', // Invalid: empty string
      repeat: 15   // Invalid: too many repetitions
    });
    console.log('✅ Success:', result3.data);
  } catch (error) {
    console.log('❌ Expected validation error:', error instanceof Error ? error.message : String(error));
  }

  console.log();

  // Test 4: Function call schema
  console.log(chalk.cyan('Test 4: Function Call Schema'));
  const schema = echoTool.getFunctionCallSchema();
  console.log('📋 Schema:', JSON.stringify(schema, null, 2));

  console.log();

  // Test 5: Tool info
  console.log(chalk.cyan('Test 5: Tool Information'));
  const info = echoTool.getInfo();
  console.log('ℹ️  Info:', JSON.stringify(info, null, 2));
}

// Run tests if this file is executed directly
if (require.main === module) {
  testBaseTool().catch(console.error);
}

export { testBaseTool };
