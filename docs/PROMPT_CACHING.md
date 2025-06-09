# Anthropic Prompt Caching Integration

This document explains the Anthropic prompt caching integration in your coding assistant app.

## Overview

Prompt caching allows you to cache large blocks of content (like system prompts, tool definitions, and conversation history) to significantly reduce API costs and improve response times for subsequent requests.

## Benefits

- **Cost Reduction**: ~90% savings on cached token costs
- **Latency Improvement**: ~85% faster response times for cached content
- **Perfect for**: Tool-heavy conversations, code analysis, long conversation histories

## Architecture

### Core Components

1. **PromptCachingService** (`src/shared/services/PromptCachingService.ts`)
   - Handles cache breakpoint strategy
   - Applies cache control metadata
   - Manages cache efficiency metrics

2. **AnthropicProvider** (`src/shared/services/providers/AnthropicProvider.ts`)
   - Integrates caching service into API calls
   - Handles cache control in message conversion
   - Reports cache usage in responses

3. **Configuration** (`src/shared/core/config.ts`)
   - Caching enabled/disabled settings
   - Strategy selection (aggressive/conservative/custom)
   - TTL configuration (5m/1h)

## Configuration Options

```typescript
interface Config {
  // Enable/disable prompt caching
  enablePromptCaching?: boolean;

  // Caching strategy
  promptCachingStrategy?: 'aggressive' | 'conservative' | 'custom';

  // What to cache
  cacheSystemPrompts?: boolean;
  cacheToolDefinitions?: boolean;
  cacheConversationHistory?: boolean;

  // Cache TTL (time to live)
  cacheTTL?: '5m' | '1h';
}
```

### Default Configuration

```javascript
{
  enablePromptCaching: true,
  promptCachingStrategy: 'aggressive',
  cacheSystemPrompts: true,
  cacheToolDefinitions: true,
  cacheConversationHistory: true,
  cacheTTL: '1h'
}
```

## Caching Strategies

### Aggressive (Default)
- Caches system prompts, tool definitions, and conversation history
- Maximizes cost savings and performance
- Best for: Long conversations, repeated tool usage

### Conservative
- Caches only system prompts and last message
- Moderate cost savings with minimal complexity
- Best for: Shorter conversations, simple use cases

### Custom
- Manual cache control through API
- Full control over what gets cached
- Best for: Advanced users with specific requirements

## Cache Breakpoints

The service automatically identifies optimal cache breakpoints:

1. **System Messages** - Always cached when enabled
2. **Tool Definitions** - Cached at end of tool array
3. **Conversation History** - Cached at strategic message boundaries

## Usage Examples

### Basic Usage (Automatic)

The caching is automatically applied when using the AnthropicProvider:

```typescript
// Caching is applied automatically based on configuration
const response = await provider.sendMessageWithTools(messages, tools);

// Check cache usage in response
if (response.usage?.cacheUsage) {
  console.log('Cache reads:', response.usage.cacheUsage.cache_read_input_tokens);
  console.log('Cache writes:', response.usage.cacheUsage.cache_creation_input_tokens);
}
```

### Configuration Management

```typescript
import { ConfigManager } from './shared/core/config';

const configManager = new ConfigManager();

// Enable caching
configManager.updateConfig({ enablePromptCaching: true });

// Set strategy
configManager.updateConfig({ promptCachingStrategy: 'conservative' });

// Configure what to cache
configManager.updateConfig({
  cacheSystemPrompts: true,
  cacheToolDefinitions: false,
  cacheConversationHistory: true
});
```

### CLI Configuration Tool

Use the included CLI tool to manage caching settings:

```bash
# Show current status
npm run prompt-cache status

# Enable caching
npm run prompt-cache enable

# Set strategy
npm run prompt-cache strategy aggressive

# Set TTL
npm run prompt-cache ttl 1h

# Show supported models and info
npm run prompt-cache info
```

## Performance Monitoring

### Cache Efficiency Metrics

```typescript
const efficiency = cachingService.calculateCacheEfficiency(usage);

console.log('Hit ratio:', efficiency.hitRatio);
console.log('Cost savings:', efficiency.costSavings);
console.log('Latency improvement:', efficiency.latencyImprovement);
```

### Usage Tracking

Cache usage is automatically tracked in API responses:

```typescript
{
  usage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    cacheUsage: {
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 80
    }
  }
}
```

## Supported Models

Prompt caching is currently supported for these Anthropic models:

- claude-3-5-sonnet-20241022
- claude-3-5-haiku-20241022
- claude-3-opus-20240229
- claude-3-sonnet-20240229
- claude-3-haiku-20240307

## Best Practices

### When to Use Caching

✅ **Good candidates for caching:**
- Long system prompts with detailed instructions
- Large tool definition arrays
- Repeated code analysis contexts
- Multi-turn conversations with context

❌ **Poor candidates for caching:**
- Short, one-off requests
- Rapidly changing context
- Simple conversations without tools

### Optimization Tips

1. **System Prompts**: Keep stable system instructions that don't change frequently
2. **Tool Definitions**: Group related tools and cache the entire set
3. **Conversation History**: Cache early context that remains relevant
4. **TTL Selection**: Use 1h for development sessions, 5m for production

### Cost Optimization

- Monitor cache hit ratios to ensure effective caching
- Use aggressive strategy for tool-heavy workflows
- Use conservative strategy for simple chat interactions
- Adjust TTL based on session length patterns

## Error Handling

The caching service gracefully handles errors:

```typescript
// Caching failures don't break API calls
try {
  const result = cachingService.applyCacheControl(messages, tools, system);
  // Use cached version if available
} catch (error) {
  // Falls back to non-cached request
  console.warn('Caching failed, proceeding without cache:', error);
}
```

## Integration Points

### Agent Integration

The caching is automatically integrated into the main Agent class through the LLM service provider selection.

### Web UI Integration

Cache status and metrics can be displayed in the web interface by accessing the caching service through the provider.

### CLI Integration

The CLI tool provides easy management of caching settings without editing configuration files.

## Testing

Run the comprehensive test suite:

```bash
# Run caching service tests
npm test PromptCachingService

# Run Anthropic provider tests
npm test AnthropicProvider

# Run integration tests
npm test -- --grep "prompt caching"
```

## Troubleshooting

### Common Issues

1. **Caching not working**
   - Verify you're using a supported Anthropic model
   - Check that `enablePromptCaching` is true
   - Ensure API key has caching permissions

2. **Poor cache hit rates**
   - Adjust caching strategy to be more aggressive
   - Increase TTL if content doesn't change frequently
   - Review what content is being cached

3. **Unexpected costs**
   - Monitor cache creation vs read ratios
   - Adjust strategy if cache creation exceeds reads
   - Consider shorter TTL for rapidly changing content

### Debug Information

Enable debug logging to see caching decisions:

```typescript
configManager.updateConfig({ logLevel: 'debug' });
```

This will log:
- Cache breakpoint decisions
- What content is being cached
- Cache hit/miss information
- Performance metrics

## Future Enhancements

Potential improvements for the caching system:

1. **Adaptive Caching**: Automatically adjust strategy based on usage patterns
2. **Cache Analytics**: Detailed reporting on cache performance
3. **Smart Breakpoints**: ML-based optimal cache point detection
4. **Cross-Session Caching**: Persist cache across application restarts
5. **Custom Cache Keys**: User-defined cache invalidation strategies

---

This integration provides a solid foundation for leveraging Anthropic's prompt caching capabilities while maintaining the flexibility to adapt to different use cases and optimization strategies.
