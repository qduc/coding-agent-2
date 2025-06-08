/**
 * TaskAnalyzer - AI-powered task classification for intelligent prompting
 */

import { LLMService } from '../services/llm';
import { TaskContext } from './SystemPromptBuilder';
import { configManager } from '../core/config';

export interface TaskAnalysisResult {
  type: TaskContext['type'];
  complexity: TaskContext['complexity'];
  reasoning?: string;
  confidence?: number;
}

export class TaskAnalyzer {
  private static instance?: TaskAnalyzer;
  private cache = new Map<string, TaskAnalysisResult>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps = new Map<string, number>();

  /**
   * Get singleton instance
   */
  static getInstance(): TaskAnalyzer {
    if (!TaskAnalyzer.instance) {
      TaskAnalyzer.instance = new TaskAnalyzer();
    }
    return TaskAnalyzer.instance;
  }

  /**
   * Analyze user message to determine task type and complexity using AI
   */
  async analyzeTask(
    message: string, 
    llmService?: LLMService,
    projectContext?: string
  ): Promise<TaskAnalysisResult> {
    // Check cache first
    const cached = this.getCachedResult(message);
    if (cached) {
      return cached;
    }

    try {
      // Use AI analysis if LLM service is available
      if (llmService && llmService.isReady()) {
        const result = await this.analyzeWithAI(message, llmService, projectContext);
        this.cacheResult(message, result);
        return result;
      }

      // Fallback to enhanced heuristic analysis
      const result = this.analyzeWithHeuristics(message);
      this.cacheResult(message, result);
      return result;

    } catch (error) {
      console.warn('Task analysis failed, using fallback:', error);
      return this.analyzeWithHeuristics(message);
    }
  }

  /**
   * AI-powered task analysis
   */
  private async analyzeWithAI(
    message: string,
    llmService: LLMService,
    projectContext?: string
  ): Promise<TaskAnalysisResult> {
    const contextSection = projectContext ? 
      `\nProject Context: ${projectContext.slice(0, 500)}` : '';

    const analysisPrompt = `You are a task classification expert. Analyze this coding request and classify it precisely.

User Request: "${message}"${contextSection}

Respond with ONLY a JSON object in this exact format:
{
  "type": "debug|implement|refactor|test|analyze|general",
  "complexity": "simple|moderate|complex",
  "reasoning": "brief explanation",
  "confidence": 0.95
}

Classification Guidelines:
- debug: fixing errors, troubleshooting, investigating issues, resolving bugs
- implement: creating new features, adding functionality, building components
- refactor: improving existing code structure, optimization, cleanup, reorganization  
- test: writing tests, testing code, coverage analysis, test automation
- analyze: understanding code, explaining functionality, code review, documentation
- general: unclear intent, multiple task types, or conversational queries

Complexity Guidelines:
- simple: single file changes, small modifications, quick fixes, straightforward tasks
- moderate: multi-file changes, standard implementations, typical features, medium scope
- complex: architectural changes, system-wide modifications, advanced algorithms, large scope

Be precise and consider the user's actual intent, not just keywords.`;

    try {
      // Use fast model optimized for task analysis (4.1-mini, 2.5-flash, 3.5-haiku)
      const response = await this.sendWithFastModel(llmService, analysisPrompt);
      return this.parseAIResponse(response);
    } catch (error) {
      throw new Error(`AI analysis failed: ${error}`);
    }
  }

  /**
   * Send message using fast model optimized for task analysis
   */
  private async sendWithFastModel(llmService: LLMService, prompt: string): Promise<string> {
    const provider = llmService.getCurrentProvider();
    if (!provider) {
      throw new Error('No provider available');
    }

    const providerName = provider.getProviderName();
    const fastModel = this.getFastModelForProvider(providerName);
    
    // Use provider directly with fast model instead of changing global config
    if (providerName === 'openai') {
      const openaiProvider = provider as any;
      // Temporarily override model for this call
      const originalConfig = configManager.getConfig();
      const tempConfig = { ...originalConfig, model: fastModel };
      
      // Create messages for this specific call
      const response = await this.callProviderWithModel(openaiProvider, prompt, fastModel);
      return response;
    } else if (providerName === 'anthropic') {
      const anthropicProvider = provider as any;
      const response = await this.callProviderWithModel(anthropicProvider, prompt, fastModel);
      return response;
    } else if (providerName === 'gemini') {
      const geminiProvider = provider as any;
      const response = await this.callProviderWithModel(geminiProvider, prompt, fastModel);
      return response;
    }
    
    // Fallback to regular sendMessage if provider not recognized
    return await llmService.sendMessage([{
      role: 'user',
      content: prompt
    }]);
  }

  /**
   * Call provider with specific model
   */
  private async callProviderWithModel(provider: any, prompt: string, model: string): Promise<string> {
    // Temporarily store and override model in config
    const originalConfig = configManager.getConfig();
    const savedModel = originalConfig.model;
    
    try {
      // Set fast model temporarily (in memory only, don't save to file)
      (configManager as any).config = { ...originalConfig, model };
      
      // Call provider sendMessage
      const response = await provider.sendMessage([{
        role: 'user',
        content: prompt
      }]);
      
      return response;
    } finally {
      // Restore original model
      (configManager as any).config = { ...originalConfig, model: savedModel };
    }
  }

  /**
   * Get fast model name for each provider
   */
  private getFastModelForProvider(providerName: string): string {
    switch (providerName) {
      case 'openai':
        return 'gpt-4.1-mini'; // Fast OpenAI model
      case 'gemini':
        return 'gemini-2.5-flash-preview-05-20'; // Fast Gemini model
      case 'anthropic':
        return 'claude-3-5-haiku-20241022'; // Fast Claude model
      default:
        // Fallback to current model if provider unknown
        return configManager.getConfig().model || 'gpt-4.1-mini';
    }
  }

  /**
   * Parse AI response to extract task analysis
   */
  private parseAIResponse(response: string): TaskAnalysisResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        type: this.validateTaskType(parsed.type),
        complexity: this.validateComplexity(parsed.complexity),
        reasoning: parsed.reasoning || '',
        confidence: Math.min(Math.max(parsed.confidence || 0.8, 0.0), 1.0)
      };
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error}`);
    }
  }

  /**
   * Enhanced heuristic analysis (fallback)
   */
  private analyzeWithHeuristics(message: string): TaskAnalysisResult {
    const lowerMessage = message.toLowerCase();
    const words = lowerMessage.split(/\s+/);
    
    // Task type scoring
    const typeScores = {
      debug: this.scoreWords(words, ['debug', 'error', 'fix', 'broken', 'issue', 'problem', 'bug', 'crash', 'fail']),
      implement: this.scoreWords(words, ['implement', 'create', 'add', 'build', 'develop', 'make', 'new', 'feature']),
      refactor: this.scoreWords(words, ['refactor', 'improve', 'optimize', 'clean', 'restructure', 'reorganize']),
      test: this.scoreWords(words, ['test', 'spec', 'coverage', 'unit', 'integration', 'mock', 'assert']),
      analyze: this.scoreWords(words, ['analyze', 'explain', 'understand', 'how', 'what', 'why', 'review', 'examine'])
    };

    // Find highest scoring type
    const maxScore = Math.max(...Object.values(typeScores));
    const type = maxScore > 0 ? 
      Object.keys(typeScores).find(key => typeScores[key as keyof typeof typeScores] === maxScore) as TaskContext['type'] || 'general' :
      'general';

    // Complexity analysis
    let complexity: TaskContext['complexity'] = 'moderate';
    const complexityIndicators = {
      simple: ['quick', 'simple', 'small', 'minor', 'basic'],
      complex: ['complex', 'architecture', 'system', 'advanced', 'comprehensive', 'large', 'multiple']
    };

    if (message.length < 30 || this.scoreWords(words, complexityIndicators.simple) > 0) {
      complexity = 'simple';
    } else if (message.length > 150 || this.scoreWords(words, complexityIndicators.complex) > 0) {
      complexity = 'complex';
    }

    return {
      type,
      complexity,
      reasoning: `Heuristic analysis: ${type} task with ${complexity} complexity`,
      confidence: maxScore > 0 ? 0.7 : 0.5
    };
  }

  /**
   * Score words based on keyword presence
   */
  private scoreWords(words: string[], keywords: string[]): number {
    return keywords.reduce((score, keyword) => {
      return score + (words.includes(keyword) ? 1 : 0);
    }, 0);
  }

  /**
   * Validate task type
   */
  private validateTaskType(type: string): TaskContext['type'] {
    const validTypes = ['debug', 'implement', 'refactor', 'test', 'analyze', 'general'];
    return validTypes.includes(type) ? type as TaskContext['type'] : 'general';
  }

  /**
   * Validate complexity
   */
  private validateComplexity(complexity: string): TaskContext['complexity'] {
    const validComplexities = ['simple', 'moderate', 'complex'];
    return validComplexities.includes(complexity) ? complexity as TaskContext['complexity'] : 'moderate';
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(message: string): TaskAnalysisResult | null {
    const key = this.getCacheKey(message);
    const timestamp = this.cacheTimestamps.get(key);
    
    if (timestamp && Date.now() - timestamp < this.cacheTimeout) {
      return this.cache.get(key) || null;
    }
    
    // Clean up expired cache entry
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return null;
  }

  /**
   * Cache analysis result
   */
  private cacheResult(message: string, result: TaskAnalysisResult): void {
    const key = this.getCacheKey(message);
    this.cache.set(key, result);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Generate cache key from message
   */
  private getCacheKey(message: string): string {
    return message.toLowerCase().trim().slice(0, 200); // Limit key size
  }

  /**
   * Clear cache (for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}