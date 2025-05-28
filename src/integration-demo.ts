/**
 * Integration demo for LLM and LS tool
 *
 * This demonstrates how the LLM can use the LS tool to list directories
 * and provide contextual responses based on the tool results.
 */

import { ToolOrchestrator } from './core/orchestrator';
import { LLMService } from './services/llm';
import { LSTool } from './tools/ls';
import { DEFAULT_TOOL_CONTEXT } from './tools/types';

async function runDemo() {
  try {
    console.log('🔧 Setting up integration demo...');

    // Initialize LLM service
    const llmService = new LLMService();
    const initialized = await llmService.initialize();

    if (!initialized) {
      console.error('❌ Failed to initialize LLM service. Make sure OPENAI_API_KEY is set.');
      return;
    }

    console.log('✅ LLM service initialized');

    // Create LS tool with project directory context
    const toolContext = {
      ...DEFAULT_TOOL_CONTEXT,
      workingDirectory: process.cwd()
    };
    const lsTool = new LSTool(toolContext);

    // Create orchestrator
    const orchestrator = new ToolOrchestrator(llmService, [lsTool]);

    console.log('✅ Tool orchestrator created with LS tool');
    console.log('🛠️ Registered tools:', orchestrator.getRegisteredTools().map((t: any) => t.name).join(', '));

    // Test with a request that should trigger tool usage
    console.log('\n🤖 Testing: "What files are in the src directory?"');

    const response = await orchestrator.processMessage(
      "What files are in the src directory?",
      undefined,
      true // verbose
    );

    console.log('\n📝 Final Response:');
    console.log(response);

    console.log('\n📊 Conversation Summary:');
    console.log(orchestrator.getConversationSummary());

    console.log('\n✅ Integration demo completed successfully!');

  } catch (error) {
    console.error('❌ Integration demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo();
}

export { runDemo };
