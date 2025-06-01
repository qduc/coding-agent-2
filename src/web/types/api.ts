/**
 * REST API types and interfaces
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  services: {
    llm: 'connected' | 'disconnected' | 'error';
    database?: 'connected' | 'disconnected' | 'error';
  };
}

export interface ConfigResponse {
  availableModels: string[];
  currentModel: string;
  features: {
    toolExecution: boolean;
    streaming: boolean;
    sessions: boolean;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  timestamp: Date;
  details?: any;
}
