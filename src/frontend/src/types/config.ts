export interface ConfigState {
    apiKey: string | null;
    model: string;
    temperature: number;
    maxTokens: number;
}

export type ConfigAction =
    | { type: 'SET_API_KEY'; payload: string | null }
    | { type: 'SET_MODEL'; payload: string }
    | { type: 'SET_TEMPERATURE'; payload: number }
    | { type: 'SET_MAX_TOKENS'; payload: number };
