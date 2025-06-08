import { useState, useEffect, useCallback } from 'react';
import { CompletionState } from '../types';
import { CompletionItem, CompletionProvider } from '../services/completion/CompletionProvider';

export interface CompletionActions {
  selectNext: () => void;
  selectPrevious: () => void;
  selectFirst: () => void;
  getSelectedItem: () => CompletionItem | null;
  hide: () => void;
  refresh: (input: string, cursorPosition: number) => Promise<void>;
}

export interface UseCompletionsReturn {
  state: CompletionState;
  actions: CompletionActions;
}

export function useCompletions(providers: CompletionProvider[]): UseCompletionsReturn {
  const [state, setState] = useState<CompletionState>({
    items: [],
    selectedIndex: 0,
    isVisible: false,
    type: null,
  });

  const selectNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.min(prev.items.length - 1, prev.selectedIndex + 1),
    }));
  }, []);

  const selectPrevious = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.max(0, prev.selectedIndex - 1),
    }));
  }, []);

  const selectFirst = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedIndex: 0,
    }));
  }, []);

  const getSelectedItem = useCallback((): CompletionItem | null => {
    if (!state.isVisible || state.items.length === 0) return null;
    return state.items[state.selectedIndex] || null;
  }, [state.isVisible, state.items, state.selectedIndex]);

  const hide = useCallback(() => {
    setState(prev => ({
      ...prev,
      isVisible: false,
      items: [],
      selectedIndex: 0,
      type: null,
    }));
  }, []);

  const refresh = useCallback(async (input: string, cursorPosition: number) => {
    // Find the first provider that can handle this input
    const activeProvider = providers.find(provider => 
      provider.canHandle(input, cursorPosition)
    );

    if (!activeProvider) {
      hide();
      return;
    }

    try {
      // Extract the partial input based on the provider's logic
      const partial = extractPartialInput(input, cursorPosition, activeProvider);
      const items = await activeProvider.getCompletions(partial);

      setState({
        items,
        selectedIndex: 0,
        isVisible: items.length > 0,
        type: activeProvider.getType(),
      });
    } catch (error) {
      console.error('Error getting completions:', error);
      hide();
    }
  }, [providers, hide]);

  const actions: CompletionActions = {
    selectNext,
    selectPrevious,
    selectFirst,
    getSelectedItem,
    hide,
    refresh,
  };

  return { state, actions };
}

/**
 * Extract the partial input for completion based on provider type
 */
function extractPartialInput(
  input: string, 
  cursorPosition: number, 
  provider: CompletionProvider
): string {
  const type = provider.getType();
  
  if (type === 'file') {
    // For file completion, look for @ symbol
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex < cursorPosition) {
      const afterAt = input.substring(lastAtIndex + 1, cursorPosition);
      const spaceIndex = afterAt.indexOf(' ');
      return spaceIndex === -1 ? afterAt : afterAt.substring(0, spaceIndex);
    }
  } else if (type === 'command') {
    // For command completion, look for / at start
    if (input.startsWith('/') && cursorPosition > 0) {
      return input.substring(1, cursorPosition);
    }
  }

  return '';
}