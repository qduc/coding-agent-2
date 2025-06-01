// Context types placeholder
export interface WebRequestContext {
  sessionId?: string;
  userId?: string;
  requestId: string;
  timestamp: Date;
}

export interface WebResponseContext {
  requestId: string;
  duration: number;
  status: number;
}
