import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { WebConfiguration, ApiResponse, ApiError } from '../types/api';
import { Logger } from '../../shared/utils/logger';
import { useWebSocket } from './WebSocketContext';

interface ConfigContextType {
  config: WebConfiguration | null;
  loading: boolean;
  error: ApiError | null;
  updateConfig: (newConfig: Partial<WebConfiguration>) => Promise<void>;
  updateProviderConfig: (providerConfig: Partial<WebConfiguration['llm']>) => Promise<void>;
  updateToolConfig: (toolConfig: Partial<WebConfiguration['tools']>) => Promise<void>;
  resetConfig: () => Promise<void>;
  validateConfig: (config: Partial<WebConfiguration>) => Promise<boolean>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<WebConfiguration | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const { socket } = useWebSocket();
  const logger = Logger.getInstance();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      const data: ApiResponse<WebConfiguration> = await response.json();
      
      if (data.success && data.data) {
        setConfig(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch config');
      }
    } catch (err) {
      logger.error('Config fetch error', { error: err });
      setError({
        code: 'CONFIG_FETCH_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date()
      });
    } finally {
      setLoading(false);
    }
  }, [logger]);

  const updateConfig = useCallback(async (newConfig: Partial<WebConfiguration>) => {
    try {
      setLoading(true);
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      
      const data: ApiResponse<WebConfiguration> = await response.json();
      
      if (data.success && data.data) {
        setConfig(data.data);
      } else {
        throw new Error(data.error?.message || 'Failed to update config');
      }
    } catch (err) {
      logger.error('Config update error', { error: err });
      setError({
        code: 'CONFIG_UPDATE_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date()
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [logger]);

  // Similar implementations for updateProviderConfig, updateToolConfig, etc...

  useEffect(() => {
    fetchConfig();

    // Setup WebSocket listeners for config updates
    const handleConfigUpdate = (updatedConfig: WebConfiguration) => {
      setConfig(updatedConfig);
    };

    socket?.on('config_updated', handleConfigUpdate);

    return () => {
      socket?.off('config_updated', handleConfigUpdate);
    };
  }, [fetchConfig, socket]);

  return (
    <ConfigContext.Provider value={{
      config,
      loading,
      error,
      updateConfig,
      updateProviderConfig,
      updateToolConfig,
      resetConfig,
      validateConfig
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
