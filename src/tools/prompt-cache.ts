#!/usr/bin/env node

/**
 * Prompt Caching Configuration Tool
 *
 * Simple CLI tool to configure prompt caching settings
 */

import { ConfigManager } from '../shared/core/config';
import { PromptCachingService } from '../shared/services/PromptCachingService';

const configManager = new ConfigManager();

function printUsage() {
  console.log(`
Prompt Caching Configuration Tool

Usage:
  prompt-cache [command] [options]

Commands:
  status              Show current caching configuration
  enable              Enable prompt caching
  disable             Disable prompt caching
  strategy <name>     Set caching strategy (aggressive|conservative|custom)
  ttl <duration>      Set cache TTL (5m|1h)
  info                Show supported models and features

Examples:
  prompt-cache status
  prompt-cache enable
  prompt-cache strategy aggressive
  prompt-cache ttl 1h
`);
}

function showStatus() {
  const config = configManager.getConfig();
  const cachingService = new PromptCachingService(config);

  console.log('\n📊 Prompt Caching Status\n');
  console.log(`Enabled: ${config.enablePromptCaching ? '✅' : '❌'}`);
  console.log(`Provider: ${config.provider || 'openai'}`);
  console.log(`Model: ${config.model || 'default'}`);
  console.log(`Available: ${cachingService.isAvailable() ? '✅' : '❌'}`);
  console.log(`Model Supported: ${cachingService.isModelSupported() ? '✅' : '❌'}`);

  if (config.enablePromptCaching) {
    console.log('\n⚙️ Configuration:');
    console.log(`Strategy: ${config.promptCachingStrategy || 'aggressive'}`);
    console.log(`TTL: ${config.cacheTTL || '1h'}`);
    console.log(`Cache System Prompts: ${config.cacheSystemPrompts ? '✅' : '❌'}`);
    console.log(`Cache Tool Definitions: ${config.cacheToolDefinitions ? '✅' : '❌'}`);
    console.log(`Cache Conversation History: ${config.cacheConversationHistory ? '✅' : '❌'}`);
  }

  console.log('');
}

function showInfo() {
  const config = configManager.getConfig();
  const cachingService = new PromptCachingService(config);

  console.log('\n📋 Prompt Caching Information\n');

  console.log('🔧 Supported Providers:');
  console.log('  • Anthropic Claude models only');
  console.log('');

  console.log('🤖 Supported Models:');
  const supportedModels = cachingService.getSupportedModels();
  supportedModels.forEach(model => {
    console.log(`  • ${model}`);
  });
  console.log('');

  console.log('📈 Benefits:');
  console.log('  • Cost reduction: ~90% savings on cached tokens');
  console.log('  • Latency improvement: ~85% faster for cached content');
  console.log('  • Ideal for: Tool-heavy conversations, repeated context');
  console.log('');

  console.log('💡 Strategies:');
  console.log('  • aggressive: Cache system, tools, and conversation history');
  console.log('  • conservative: Cache system prompts and last message only');
  console.log('  • custom: Manual cache control');
  console.log('');
}

async function enable() {
  await configManager.saveConfig({ enablePromptCaching: true });
  console.log('✅ Prompt caching enabled');
  showStatus();
}

async function disable() {
  await configManager.saveConfig({ enablePromptCaching: false });
  console.log('❌ Prompt caching disabled');
}

async function setStrategy(strategy: string) {
  const validStrategies = ['aggressive', 'conservative', 'custom'];

  if (!validStrategies.includes(strategy)) {
    console.error(`❌ Invalid strategy. Must be one of: ${validStrategies.join(', ')}`);
    process.exit(1);
  }

  await configManager.saveConfig({ promptCachingStrategy: strategy as 'aggressive' | 'conservative' | 'custom' });
  console.log(`✅ Caching strategy set to: ${strategy}`);
  showStatus();
}

async function setTTL(ttl: string) {
  const validTTLs = ['5m', '1h'];

  if (!validTTLs.includes(ttl)) {
    console.error(`❌ Invalid TTL. Must be one of: ${validTTLs.join(', ')}`);
    process.exit(1);
  }

  await configManager.saveConfig({ cacheTTL: ttl as '5m' | '1h' });
  console.log(`✅ Cache TTL set to: ${ttl}`);
  showStatus();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showStatus();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'status':
      showStatus();
      break;

    case 'enable':
      await enable();
      break;

    case 'disable':
      await disable();
      break;

    case 'strategy':
      if (args.length < 2) {
        console.error('❌ Strategy name required');
        process.exit(1);
      }
      await setStrategy(args[1]);
      break;

    case 'ttl':
      if (args.length < 2) {
        console.error('❌ TTL value required');
        process.exit(1);
      }
      await setTTL(args[1]);
      break;

    case 'info':
      showInfo();
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}