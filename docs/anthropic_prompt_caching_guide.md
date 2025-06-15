# Anthropic Prompt Caching: Complete User Guide

Prompt caching is a game-changing feature that lets you cache parts of your prompts to dramatically reduce costs and latency. Think of it as storing frequently-used content in fast memory so you don't have to reprocess it every time.

## When Prompt Caching Shines

Perfect for scenarios where you're repeatedly referencing the same content:
- **Long system prompts** you use across multiple requests
- **Large documents** you want to analyze from different angles
- **Extended conversations** with consistent context
- **Code repositories** for iterative analysis
- **Detailed instruction sets** with 20+ examples
- **Knowledge bases** like books, papers, or documentation

## How It Works

When you mark content with `cache_control`, Anthropic stores that exact content for about 5+ minutes. Subsequent requests that include identical cached content get:
- **90% cost reduction** on cached tokens
- **Significantly faster** response times
- **Same quality** responses (caching doesn't affect output)

## Supported Models & Token Minimums

| Model | Minimum Cacheable Tokens | Cache Write Cost | Cache Hit Cost | Base Input Cost |
|-------|-------------------------|------------------|----------------|-----------------|
| Claude 3.7 Sonnet | 1,024 | $3.75/MTok | $0.30/MTok | $3/MTok |
| Claude 3.5 Sonnet | 1,024 | $3.75/MTok | $0.30/MTok | $3/MTok |
| Claude 3.5 Haiku | 2,048 | $1/MTok | $0.08/MTok | $0.80/MTok |
| Claude 3 Haiku | 2,048 | $0.30/MTok | $0.03/MTok | $0.25/MTok |
| Claude 3 Opus | 1,024 | $18.75/MTok | $1.50/MTok | $15/MTok |

**Key insight:** Cache writes cost 25% more initially, but cache hits are 90% cheaper than regular tokens.

## Basic Implementation

### Simple Document Caching

```javascript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: 'your-api-key',
});

// Large document you want to reference multiple times
const technicalSpec = `
[Your large document content here - must be 1024+ tokens for Sonnet models]
This could be:
- API documentation
- Legal contracts  
- Technical specifications
- Books or research papers
- Code repositories
`.repeat(100); // Ensure we hit minimum token count

// First request - creates the cache
const response1 = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: technicalSpec,
          cache_control: { type: 'ephemeral' } // This creates the cache
        },
        {
          type: 'text',
          text: 'What are the main API endpoints described?'
        }
      ]
    }
  ]
});

// Subsequent requests - reuse the cache (90% cheaper!)
const response2 = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: technicalSpec, // Identical content = cache hit
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: 'What authentication methods are supported?'
        }
      ]
    }
  ]
});
```

### System Prompt Caching

```javascript
const expertSystemPrompt = `
You are a senior software engineer with 15+ years of experience specializing in:
- JavaScript/TypeScript and modern frameworks
- Cloud architecture and microservices
- Performance optimization and scalability
- Security best practices and code review

When reviewing code, you:
- Focus on maintainability and readability
- Suggest modern language features appropriately
- Consider error handling and edge cases
- Think about performance implications
- Provide specific, actionable feedback with examples
- Always include proper error handling in suggestions

Your responses should be thorough but concise, with production-ready code examples.
`.repeat(20); // Ensure sufficient length

// Cache the system prompt
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  system: [
    {
      type: 'text',
      text: expertSystemPrompt,
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [
    {
      role: 'user',
      content: 'Review this function: async function fetchUser(id) { const res = await fetch(`/api/users/${id}`); return res.json(); }'
    }
  ]
});
```

## Advanced Patterns

### Multiple Cache Breakpoints (Up to 4)

You can cache different sections separately, allowing for sophisticated reuse patterns:

```javascript
const systemInstructions = "You are an expert code reviewer...".repeat(50);
const codebaseContext = "// Complete codebase context and architecture...".repeat(100);
const reviewExamples = "Here are 25 examples of excellent code reviews...".repeat(60);

const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  system: [
    {
      type: 'text',
      text: systemInstructions,
      cache_control: { type: 'ephemeral' } // Breakpoint 1: System instructions
    }
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: codebaseContext,
          cache_control: { type: 'ephemeral' } // Breakpoint 2: Codebase context
        },
        {
          type: 'text',
          text: reviewExamples,
          cache_control: { type: 'ephemeral' } // Breakpoint 3: Examples
        },
        {
          type: 'text',
          text: 'Please review this new component: [actual code to review]'
        }
      ]
    }
  ]
});
```

### Conversation History Caching

Build a conversation class that caches the growing message history:

```javascript
class CachedConversation {
  constructor() {
    this.messages = [];
    this.anthropic = new Anthropic({ apiKey: 'your-api-key' });
  }

  async addMessage(userMessage) {
    // Add the new user message
    this.messages.push({
      role: 'user',
      content: userMessage
    });

    // Prepare messages with caching for all but the last message
    const messagesForRequest = this.messages.map((msg, index) => {
      // Cache all messages except the current one
      if (index < this.messages.length - 1) {
        return {
          ...msg,
          content: Array.isArray(msg.content) 
            ? msg.content.map(block => ({
                ...block,
                cache_control: { type: 'ephemeral' }
              }))
            : [{
                type: 'text',
                text: msg.content,
                cache_control: { type: 'ephemeral' }
              }]
        };
      }
      return msg;
    });

    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: messagesForRequest
    });

    // Add Claude's response to the conversation
    this.messages.push({
      role: 'assistant',
      content: response.content[0].text
    });

    return response;
  }

  getCacheStats(response) {
    return {
      cacheCreated: response.usage.cache_creation_input_tokens || 0,
      cacheHits: response.usage.cache_read_input_tokens || 0,
      regularTokens: response.usage.input_tokens || 0
    };
  }
}

// Usage
const conversation = new CachedConversation();
const response1 = await conversation.addMessage("Explain async/await in JavaScript");
const response2 = await conversation.addMessage("Show me error handling patterns");
const response3 = await conversation.addMessage("How does this compare to Promises?");

console.log('Cache performance:', conversation.getCacheStats(response3));
```

### Document Analysis with Multiple Queries

Perfect for analyzing large documents from different perspectives:

```javascript
class DocumentAnalyzer {
  constructor(document) {
    this.document = document;
    this.anthropic = new Anthropic({ apiKey: 'your-api-key' });
  }

  async analyze(question) {
    return await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.document,
              cache_control: { type: 'ephemeral' } // Cache the document
            },
            {
              type: 'text',
              text: `Based on the document above, please answer: ${question}`
            }
          ]
        }
      ]
    });
  }
}

// Usage - first analysis creates cache, subsequent ones use it
const analyzer = new DocumentAnalyzer(largeResearchPaper);

const themes = await analyzer.analyze("What are the main themes?");
const methodology = await analyzer.analyze("Describe the research methodology");
const conclusions = await analyzer.analyze("What are the key conclusions?");
const limitations = await analyzer.analyze("What limitations does the study acknowledge?");
```

## Performance Monitoring

Track your cache performance and cost savings:

```javascript
function analyzeCachePerformance(response) {
  const usage = response.usage;
  const stats = {
    cacheCreated: usage.cache_creation_input_tokens || 0,
    cacheHits: usage.cache_read_input_tokens || 0,
    regularTokens: usage.input_tokens || 0
  };

  // Calculate cost savings (using Sonnet pricing)
  const regularPrice = 3 / 1000000; // $3 per million tokens
  const cacheHitPrice = 0.30 / 1000000; // $0.30 per million tokens
  
  const savings = stats.cacheHits * (regularPrice - cacheHitPrice);
  const cacheHitRate = stats.cacheHits / (stats.cacheHits + stats.regularTokens) * 100;

  return {
    ...stats,
    savings: `$${savings.toFixed(6)}`,
    cacheHitRate: `${cacheHitRate.toFixed(1)}%`,
    totalInputTokens: stats.cacheHits + stats.regularTokens + stats.cacheCreated
  };
}

// Use it
const response = await anthropic.messages.create({/* your request */});
console.log('Performance:', analyzeCachePerformance(response));
```

## Best Practices & Optimization

### Structure Your Prompts for Caching

**Cache order matters:** `tools` → `system` → `messages`

```javascript
// ✅ Good: Static content first, dynamic content last
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  tools: [/* tool definitions */], // Cached first
  system: [
    {
      type: 'text',
      text: staticSystemPrompt,
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: largeDocument,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: 'Dynamic question that changes each time'
        }
      ]
    }
  ]
});
```

### Strategic Cache Breakpoints

Use multiple breakpoints to cache different types of reusable content:

```javascript
// Example: AI coding assistant with multiple cached components
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2000,
  system: [
    {
      type: 'text',
      text: codingAssistantInstructions, // Always reused
      cache_control: { type: 'ephemeral' }
    }
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: projectCodebase, // Reused per project
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: codingStandards, // Reused per team/project
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: 'Help me implement authentication for this API endpoint'
        }
      ]
    }
  ]
});
```

## Common Pitfalls & Troubleshooting

### Cache Invalidation Issues

**Content must be 100% identical:**
```javascript
// ❌ These won't cache together (extra space)
const content1 = "Hello world";
const content2 = "Hello world "; // Extra space breaks caching

// ❌ These won't cache together (different formatting)
const json1 = JSON.stringify({name: "test"});
const json2 = JSON.stringify({name: "test"}, null, 2); // Pretty printed
```

**Tool choice and images invalidate cache:**
```javascript
// ❌ Changing tool_choice breaks the cache
const request1 = { /* ... */, tool_choice: "auto" };
const request2 = { /* ... */, tool_choice: "any" }; // Cache miss

// ❌ Adding/removing images anywhere breaks the cache
const request1 = { messages: [{ content: [{ type: 'text', text: 'hello' }] }] };
const request2 = { messages: [{ content: [
  { type: 'text', text: 'hello' },
  { type: 'image', source: {/*...*/} } // Cache miss
]}] };
```

### Minimum Token Requirements

```javascript
// ❌ Too short for Sonnet models (needs 1024+ tokens)
const shortPrompt = "You are a helpful assistant."; // Won't cache

// ✅ Meets minimum requirements
const longPrompt = "You are a helpful assistant...".repeat(100); // Will cache
```

### Concurrent Requests

```javascript
// ❌ Parallel requests won't benefit from caching
const [response1, response2] = await Promise.all([
  makeRequestWithCaching(),
  makeRequestWithCaching() // This won't use cache from first request
]);

// ✅ Sequential requests benefit from caching
const response1 = await makeRequestWithCaching(); // Creates cache
const response2 = await makeRequestWithCaching(); // Uses cache
```

## Real-World Use Cases

### 1. Customer Support Bot

```javascript
const supportKnowledgeBase = `[Comprehensive FAQ and support documentation]`;
const conversationHistory = [/* previous messages */];

// Each customer interaction reuses the knowledge base
const response = await anthropic.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1000,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: supportKnowledgeBase,
          cache_control: { type: 'ephemeral' }
        },
        ...conversationHistory.map(msg => ({
          type: 'text',
          text: msg,
          cache_control: { type: 'ephemeral' }
        })),
        {
          type: 'text',
          text: 'Customer: How do I reset my password?'
        }
      ]
    }
  ]
});
```

### 2. Code Review Assistant

```javascript
const codeReviewBot = {
  systemPrompt: `Expert code reviewer instructions...`,
  codebase: `// Current project codebase context`,
  standards: `// Team coding standards and examples`,

  async reviewCode(codeToReview) {
    return await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: this.systemPrompt,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: this.codebase,
              cache_control: { type: 'ephemeral' }
            },
            {
              type: 'text',
              text: this.standards,
              cache_control: { type: 'ephemeral' }
            },
            {
              type: 'text',
              text: `Please review this code:\n\n${codeToReview}`
            }
          ]
        }
      ]
    });
  }
};
```

### 3. Research Assistant

```javascript
class ResearchAssistant {
  constructor(researchPapers) {
    this.papers = researchPapers; // Array of paper contents
    this.anthropic = new Anthropic({ apiKey: 'your-api-key' });
  }

  async synthesizeFindings(question) {
    // Cache all research papers
    const paperBlocks = this.papers.map(paper => ({
      type: 'text',
      text: paper,
      cache_control: { type: 'ephemeral' }
    }));

    return await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...paperBlocks,
            {
              type: 'text',
              text: `Based on all the research papers above, please answer: ${question}`
            }
          ]
        }
      ]
    });
  }
}
```

## Cost Optimization Strategies

### Calculate ROI of Caching

```javascript
function calculateCachingROI(usage, model = 'sonnet') {
  const pricing = {
    sonnet: { base: 3, write: 3.75, hit: 0.30 },
    haiku: { base: 0.80, write: 1, hit: 0.08 },
    opus: { base: 15, write: 18.75, hit: 1.50 }
  };

  const prices = pricing[model];
  const { cache_creation_input_tokens = 0, cache_read_input_tokens = 0, input_tokens = 0 } = usage;

  const cachingCost = (cache_creation_input_tokens * prices.write + 
                      cache_read_input_tokens * prices.hit + 
                      input_tokens * prices.base) / 1000000;

  const noCachingCost = ((cache_creation_input_tokens + cache_read_input_tokens + input_tokens) * prices.base) / 1000000;

  return {
    cachingCost: `$${cachingCost.toFixed(6)}`,
    noCachingCost: `$${noCachingCost.toFixed(6)}`,
    savings: `$${(noCachingCost - cachingCost).toFixed(6)}`,
    savingsPercent: `${((noCachingCost - cachingCost) / noCachingCost * 100).toFixed(1)}%`
  };
}
```

### Optimize Cache Hit Rates

1. **Standardize your content formatting**
2. **Use consistent variable names and structures**
3. **Cache the largest, most reusable content first**
4. **Monitor cache performance and adjust breakpoints**

## Quick Reference

### Cache Control Syntax
```javascript
{
  type: 'text',
  text: 'Your content here',
  cache_control: { type: 'ephemeral' }
}
```

### What Can Be Cached
- ✅ System messages
- ✅ User messages
- ✅ Assistant messages
- ✅ Tool definitions
- ✅ Tool results
- ✅ Images and documents

### Cache Limits
- **Maximum breakpoints:** 4 per request
- **Minimum tokens:** 1024 (Sonnet/Opus) or 2048 (Haiku)
- **Cache lifetime:** 5+ minutes
- **Cache availability:** After first response begins

### Cost Benefits
- **Cache writes:** 25% more expensive than base tokens
- **Cache hits:** 90% cheaper than base tokens
- **Break-even point:** Usually after 2-3 cache hits

---

Prompt caching transforms how you work with Claude, especially for applications involving large contexts, repeated analysis, or extended conversations. Start with simple document caching, monitor your performance, and gradually optimize your cache strategy based on your specific use patterns.