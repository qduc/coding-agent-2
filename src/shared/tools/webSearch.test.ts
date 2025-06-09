/**
 * Tests for WebSearch tool
 */

import { WebSearchTool } from './webSearch';
import { ToolContext } from './types';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock config manager
jest.mock('../core/config', () => ({
  configManager: {
    getConfig: jest.fn().mockReturnValue({}),
  }
}));

describe('WebSearchTool', () => {
  let tool: WebSearchTool;
  const mockContext: Partial<ToolContext> = {
    workingDirectory: '/test',
    timeout: 10000
  };

  beforeEach(() => {
    tool = new WebSearchTool(mockContext);
    jest.clearAllMocks();
    
    // Clear environment variables
    delete process.env.BRAVE_SEARCH_API_KEY;
  });

  describe('initialization', () => {
    it('should have correct name and description', () => {
      expect(tool.name).toBe('web_search');
      expect(tool.description).toContain('Search the web');
      expect(tool.description).toContain('Brave Search API');
    });

    it('should have proper schema', () => {
      const schema = tool.schema;
      expect(schema.type).toBe('object');
      expect(schema.properties.query).toBeDefined();
      expect(schema.properties.query.type).toBe('string');
      expect(schema.required).toContain('query');
    });

    it('should accept optional parameters in schema', () => {
      const schema = tool.schema;
      expect(schema.properties.count).toBeDefined();
      expect(schema.properties.offset).toBeDefined();
      expect(schema.properties.search_lang).toBeDefined();
      expect(schema.properties.country).toBeDefined();
      expect(schema.properties.safesearch).toBeDefined();
      expect(schema.properties.freshness).toBeDefined();
    });
  });

  describe('parameter validation', () => {
    beforeEach(() => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';
    });

    it('should require query parameter', async () => {
      const result = await tool.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
          query: { original: 'test query', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({
        query: 'test query',
        count: 5,
        offset: 0,
        search_lang: 'en',
        country: 'US',
        safesearch: 'moderate'
      });

      expect(result.success).toBe(true);
    });

    it('should validate count parameter limits', async () => {
      const result = await tool.execute({
        query: 'test',
        count: 25 // Exceeds maximum of 20
      });
      expect(result.success).toBe(false);
    });

    it('should validate safesearch enum values', async () => {
      const result = await tool.execute({
        query: 'test',
        safesearch: 'invalid' as any
      });
      expect(result.success).toBe(false);
    });
  });

  describe('API key handling', () => {
    it('should fail when no API key is configured', async () => {
      const result = await tool.execute({ query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (typeof result.error === 'object') {
        expect(result.error.message).toContain('API key not configured');
        expect(result.error.suggestions).toContain('Get an API key from https://api-dashboard.search.brave.com/register');
      }
    });

    it('should use environment variable API key', async () => {
      process.env.BRAVE_SEARCH_API_KEY = 'env-test-key';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
          query: { original: 'test', show_strict_warning: false }
        })
      } as Response);

      await tool.execute({ query: 'test' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.search.brave.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Subscription-Token': 'env-test-key'
          })
        })
      );
    });
  });

  describe('API communication', () => {
    beforeEach(() => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';
    });

    it('should make correct API request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
          query: { original: 'test query', show_strict_warning: false }
        })
      } as Response);

      await tool.execute({
        query: 'test query',
        count: 10,
        search_lang: 'en',
        country: 'US',
        safesearch: 'moderate'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.search.brave.com/res/v1/web/search'),
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': 'test-api-key'
          }
        })
      );

      const callUrl = (mockFetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('q=test+query');
      expect(callUrl).toContain('count=10');
      expect(callUrl).toContain('search_lang=en');
      expect(callUrl).toContain('country=US');
      expect(callUrl).toContain('safesearch=moderate');
    });

    it('should include freshness parameter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
          query: { original: 'test', show_strict_warning: false }
        })
      } as Response);

      await tool.execute({
        query: 'test',
        freshness: 'pw'
      });

      const callUrl = (mockFetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('freshness=pw');
    });

    it('should handle successful response with results', async () => {
      const mockResults = [
        {
          title: 'Test Result 1',
          url: 'https://example.com/1',
          description: 'First test result',
          extra_snippets: ['snippet 1']
        },
        {
          title: 'Test Result 2',
          url: 'https://example.com/2',
          description: 'Second test result'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: mockResults },
          query: { original: 'test', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({ query: 'test', count: 2 });
      
      expect(result.success).toBe(true);
      expect(result.output.results).toHaveLength(2);
      expect(result.output.results[0]).toEqual({
        rank: 1,
        title: 'Test Result 1',
        url: 'https://example.com/1',
        description: 'First test result',
        extra_snippets: ['snippet 1']
      });
      expect(result.output.results[1]).toEqual({
        rank: 2,
        title: 'Test Result 2',
        url: 'https://example.com/2',
        description: 'Second test result',
        extra_snippets: []
      });
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: [] },
          query: { original: 'nonexistent', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({ query: 'nonexistent' });
      
      expect(result.success).toBe(true);
      expect(result.output.results).toHaveLength(0);
      expect(result.output.total_results).toBe(0);
      expect(result.output.message).toContain('No search results found');
    });

    it('should handle pagination with offset', async () => {
      const mockResults = [
        {
          title: 'Result 11',
          url: 'https://example.com/11',
          description: 'Eleventh result'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: mockResults },
          query: { original: 'test', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({ query: 'test', offset: 10 });
      
      expect(result.success).toBe(true);
      expect(result.output.results[0].rank).toBe(11); // offset + 1
      expect(result.output.offset).toBe(10);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';
    });

    it('should handle 401 unauthorized error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (typeof result.error === 'object') {
        expect(result.error.message).toContain('Invalid Brave Search API key');
        expect(result.error.suggestions).toContain('Verify your API key is correct');
      }
    });

    it('should handle 429 rate limit error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      } as Response);

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (typeof result.error === 'object') {
        expect(result.error.message).toContain('Rate limit exceeded');
        expect(result.error.suggestions).toContain('Wait a moment before making another search');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (typeof result.error === 'object') {
        expect(result.error.message).toContain('Network error');
        expect(result.error.suggestions).toContain('Check your internet connection');
      }
    });

    it('should handle other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      } as Response);

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      if (typeof result.error === 'object') {
        expect(result.error.message).toContain('HTTP 500');
      }
    });

    it('should handle JSON parsing errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => { throw new Error('Invalid JSON'); }
      } as unknown as Response);

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('response formatting', () => {
    beforeEach(() => {
      process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';
    });

    it('should include search metadata in response', async () => {
      const mockResults = [
        {
          title: 'Test Result',
          url: 'https://example.com',
          description: 'Test description'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: mockResults },
          query: { original: 'test query', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({
        query: 'test query',
        count: 5,
        search_lang: 'es',
        country: 'ES',
        safesearch: 'strict',
        freshness: 'pd'
      });
      
      expect(result.success).toBe(true);
      expect(result.output.query).toBe('test query');
      expect(result.output.search_params).toBeDefined();
      expect(result.output.search_params.count).toBe(5);
      expect(result.output.search_params.search_lang).toBe('es');
      expect(result.output.search_params.country).toBe('ES');
      expect(result.output.search_params.safesearch).toBe('strict');
      expect(result.output.search_params.freshness).toBe('pd');
    });

    it('should handle missing optional fields in API response', async () => {
      const mockResults = [
        {
          title: 'Test Result',
          url: 'https://example.com'
          // Missing description and extra_snippets
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          web: { results: mockResults },
          query: { original: 'test', show_strict_warning: false }
        })
      } as Response);

      const result = await tool.execute({ query: 'test' });
      
      expect(result.success).toBe(true);
      expect(result.output.results[0]).toEqual({
        rank: 1,
        title: 'Test Result',
        url: 'https://example.com',
        description: '',
        extra_snippets: []
      });
    });
  });
});