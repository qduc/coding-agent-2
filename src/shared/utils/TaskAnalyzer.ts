/**
 * TaskAnalyzer - Simple keyword-based task classification
 */

import { TaskContext } from './SystemPromptBuilder';

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
   * Analyze user message to determine task type and complexity
   * Uses simple keyword matching instead of AI classification
   */
  async analyzeTask(
    message: string, 
    llmService?: any, // Keep parameter for compatibility
    projectContext?: string
  ): Promise<TaskAnalysisResult> {
    // Check cache first
    const cached = this.getCachedResult(message);
    if (cached) {
      return cached;
    }

    // Use keyword-based analysis
    const result = this.analyzeWithKeywords(message);
    this.cacheResult(message, result);
    return result;
  }

  /**
   * Keyword-based task analysis
   */
  private analyzeWithKeywords(message: string): TaskAnalysisResult {
    const lowerMessage = message.toLowerCase();
    const words = lowerMessage.split(/\s+/);

    // Task type scoring
    const typeScores = {
      debug: this.scoreWords(words, ['debug', 'error', 'fix', 'broken', 'issue', 'problem', 'bug', 'crash', 'fail', 'exception', 'incorrect']),
      implement: this.scoreWords(words, ['implement', 'create', 'add', 'build', 'develop', 'make', 'new', 'feature', 'support', 'introduce']),
      refactor: this.scoreWords(words, ['refactor', 'improve', 'optimize', 'clean', 'restructure', 'reorganize', 'simplify', 'better', 'modernize']),
      test: this.scoreWords(words, ['test', 'spec', 'coverage', 'unit', 'integration', 'mock', 'assert', 'verify', 'validation']),
      analyze: this.scoreWords(words, ['analyze', 'explain', 'understand', 'how', 'what', 'why', 'review', 'examine', 'assess', 'evaluate'])
    };

    // Find highest scoring type
    const maxScore = Math.max(...Object.values(typeScores));
    const type = maxScore > 0 ? 
      Object.keys(typeScores).find(key => typeScores[key as keyof typeof typeScores] === maxScore) as TaskContext['type'] || 'general' :
      'general';

    // Complexity analysis
    let complexity: TaskContext['complexity'] = 'moderate';

    // Expanded complexity indicators for better matching
    const complexityIndicators = {
      simple: ['quick', 'simple', 'small', 'minor', 'basic', 'easy', 'trivial', 'straightforward'],
      complex: ['complex', 'architecture', 'system', 'advanced', 'comprehensive', 'large', 'multiple', 'challenging', 'difficult', 'intricate']
    };

    // Length-based heuristic + keyword matching
    if (message.length < 50 || this.scoreWords(words, complexityIndicators.simple) > 0) {
      complexity = 'simple';
    } else if (message.length > 150 || this.scoreWords(words, complexityIndicators.complex) > 0) {
      complexity = 'complex';
    }

    return {
      type,
      complexity,
      reasoning: `Keyword analysis: ${type} task with ${complexity} complexity`,
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