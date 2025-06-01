export interface ConfigState {
    llmProvider: 'openai' | 'anthropic' | 'gemini';
    llmConfig: {
        openai: { apiKey: string; model: string };
        anthropic: { apiKey: string; model: string };
        gemini: { apiKey: string; model: string };
    };
    tools: any[];
    featureFlags: {
        experimentalFeatures: boolean;
        codeLens: boolean;
        autoComplete: boolean;
    };
    appearance: {
        theme: string;
        fontSize: number;
        fontFamily: string;
    };
}

export type ConfigAction =
    | { type: 'SET_LLM_PROVIDER'; payload: 'openai' | 'anthropic' | 'gemini' }
    | { type: 'UPDATE_LLM_CONFIG'; payload: { provider: string; config: any } }
    | { type: 'TOGGLE_FEATURE_FLAG'; payload: keyof ConfigState['featureFlags'] }
    | { type: 'UPDATE_APPEARANCE'; payload: Partial<ConfigState['appearance']> }
    | { type: 'ADD_TOOL'; payload: any }
    | { type: 'REMOVE_TOOL'; payload: string };
