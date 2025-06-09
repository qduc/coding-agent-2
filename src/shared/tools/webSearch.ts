/**
 * Web Search Tool using Brave Search API
 *
 * Provides web search functionality with the ability to search the internet
 * for current information and return relevant results.
 */

import { BaseTool } from './base';
import { ToolSchema, ToolResult, ToolError, ToolContext } from './types';
import { configManager } from '../core/config';

interface SearchResult {
  title: string;
  url: string;
  description?: string;
  extra_snippets?: string[];
}

interface BraveSearchResponse {
  web?: {
    results: SearchResult[];
  };
  query: {
    original: string;
    show_strict_warning: boolean;
  };
}

interface WebSearchParams {
  query: string;
  count?: number;
  offset?: number;
  search_lang?: string;
  country?: string;
  safesearch?: 'strict' | 'moderate' | 'off';
  freshness?: 'pd' | 'pw' | 'pm' | 'py';
}

export class WebSearchTool extends BaseTool {
  readonly name = 'web_search';
  readonly description = 'Search the web for current information using Brave Search API. Returns a list of relevant web results with titles, URLs, and descriptions.';

  readonly schema: ToolSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query to execute',
        minLength: 1
      },
      count: {
        type: 'number',
        description: 'Number of search results to return (default: 10, max: 20)',
        minimum: 1,
        maximum: 20,
        default: 10
      },
      offset: {
        type: 'number',
        description: 'Number of results to skip for pagination (default: 0)',
        minimum: 0,
        default: 0
      },
      search_lang: {
        type: 'string',
        description: 'Search language code (e.g., "en", "es", "fr")',
        default: 'en'
      },
      country: {
        type: 'string',
        description: 'Country code for regional results (e.g., "US", "GB", "CA")',
        default: 'US'
      },
      safesearch: {
        type: 'string',
        enum: ['strict', 'moderate', 'off'],
        description: 'Safe search setting',
        default: 'moderate'
      },
      freshness: {
        type: 'string',
        enum: ['pd', 'pw', 'pm', 'py'],
        description: 'Freshness of results: pd=past day, pw=past week, pm=past month, py=past year'
      }
    },
    required: ['query'],
    additionalProperties: false
  };

  constructor(context?: Partial<ToolContext>) {
    super({
      timeout: 15000, // 15 seconds for web requests
      ...context
    });
  }

  protected async executeImpl(params: WebSearchParams): Promise<ToolResult> {
    const { query, count = 10, offset = 0, search_lang = 'en', country = 'US', safesearch = 'moderate', freshness } = params;

    // Check if Brave Search API key is configured
    const apiKey = this.getBraveSearchApiKey();
    if (!apiKey) {
      return this.createErrorResult(
        'Brave Search API key not configured. Set BRAVE_SEARCH_API_KEY environment variable.',
        'INVALID_PARAMS',
        [
          'Get an API key from https://api-dashboard.search.brave.com/register',
          'Set the BRAVE_SEARCH_API_KEY environment variable',
          'Restart the application after setting the API key'
        ]
      );
    }

    try {
      // Build search URL with parameters
      const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('count', count.toString());
      searchUrl.searchParams.set('offset', offset.toString());
      searchUrl.searchParams.set('search_lang', search_lang);
      searchUrl.searchParams.set('country', country);
      searchUrl.searchParams.set('safesearch', safesearch);
      
      if (freshness) {
        searchUrl.searchParams.set('freshness', freshness);
      }

      // Make the API request
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        if (response.status === 401) {
          return this.createErrorResult(
            'Invalid Brave Search API key. Please check your credentials.',
            'INVALID_PARAMS',
            [
              'Verify your API key is correct',
              'Check if your subscription is active at https://api-dashboard.search.brave.com/',
              'Make sure you have sufficient quota remaining'
            ]
          );
        }
        
        if (response.status === 429) {
          return this.createErrorResult(
            'Rate limit exceeded. Please try again later.',
            'OPERATION_TIMEOUT',
            [
              'Wait a moment before making another search',
              'Consider upgrading your Brave Search API plan for higher rate limits',
              'Reduce the frequency of search requests'
            ]
          );
        }

        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: BraveSearchResponse = await response.json();

      // Extract search results
      const results = data.web?.results || [];
      
      if (results.length === 0) {
        return this.createSuccessResult({
          query: query,
          results: [],
          total_results: 0,
          offset: offset,
          message: 'No search results found for this query.',
          search_params: {
            count,
            search_lang,
            country,
            safesearch,
            freshness
          }
        });
      }

      // Format results for better readability
      const formattedResults = results.map((result, index) => ({
        rank: offset + index + 1,
        title: result.title,
        url: result.url,
        description: result.description || '',
        extra_snippets: result.extra_snippets || []
      }));

      return this.createSuccessResult({
        query: query,
        results: formattedResults,
        total_results: formattedResults.length,
        offset: offset,
        search_params: {
          count,
          search_lang,
          country,
          safesearch,
          freshness
        }
      });

    } catch (error) {
      if (error instanceof ToolError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Handle network errors
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        return this.createErrorResult(
          'Network error while connecting to Brave Search API. Please check your internet connection.',
          'OPERATION_TIMEOUT',
          [
            'Check your internet connection',
            'Try again in a few moments',
            'Verify that api.search.brave.com is accessible'
          ]
        );
      }

      return this.createErrorResult(
        `Search failed: ${errorMessage}`,
        'EXECUTION_ERROR',
        [
          'Try a different search query',
          'Check if the Brave Search API is operational',
          'Try again in a few moments'
        ]
      );
    }
  }

  /**
   * Get Brave Search API key from environment variables or config
   */
  private getBraveSearchApiKey(): string | undefined {
    // First try environment variable
    const envKey = process.env.BRAVE_SEARCH_API_KEY;
    if (envKey) {
      return envKey;
    }

    // Then try config manager (if it supports Brave Search in the future)
    const config = configManager.getConfig();
    return config.braveSearchApiKey;
  }
}