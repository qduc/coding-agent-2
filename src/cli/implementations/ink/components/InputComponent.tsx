import React, { useEffect, useState, useCallback } from 'react';
import { Box } from 'ink';
import { useInputState } from '../hooks/useInputState';
import { useKeyboardHandler } from '../hooks/useKeyboardHandler';
import { InputBox } from './InputBox';
import { HelpText } from './HelpText';
import { CompletionDropdown } from './CompletionDropdown';
import { CompletionManager } from '../services/completion/CompletionManager';
import { ClipboardManager } from '../services/clipboard/ClipboardManager';
import { InputCallbacks, InputOptions, CompletionState } from '../types';
import { CompletionItem } from '../services/completion/CompletionProvider';

export interface InputComponentProps {
  callbacks: InputCallbacks;
  options?: InputOptions;
  completionManager: CompletionManager;
  clipboardManager: ClipboardManager;
}

export const InputComponent: React.FC<InputComponentProps> = ({
  callbacks,
  options = {},
  completionManager,
  clipboardManager,
}) => {
  const { state: inputState, actions: inputActions } = useInputState(options.initialInput);
  
  // Local completion state - no more dual system
  const [completionState, setCompletionState] = useState<CompletionState>({
    items: [],
    selectedIndex: 0,
    isVisible: false,
    type: null,
  });

  // Stable completion actions
  const completionActions = useCallback(() => ({
    selectNext: () => setCompletionState(prev => ({
      ...prev,
      selectedIndex: Math.min(prev.items.length - 1, prev.selectedIndex + 1),
    })),
    selectPrevious: () => setCompletionState(prev => ({
      ...prev,
      selectedIndex: Math.max(0, prev.selectedIndex - 1),
    })),
    selectFirst: () => setCompletionState(prev => ({
      ...prev,
      selectedIndex: 0,
    })),
    getSelectedItem: (): CompletionItem | null => {
      if (!completionState.isVisible || completionState.items.length === 0) return null;
      return completionState.items[completionState.selectedIndex] || null;
    },
    hide: () => setCompletionState({
      items: [],
      selectedIndex: 0,
      isVisible: false,
      type: null,
    }),
  }), [completionState]);

  // Update completions using only CompletionManager
  useEffect(() => {
    const updateCompletions = async () => {
      try {
        const items = await completionManager.getCompletions(
          inputState.value,
          inputState.cursorPosition
        );
        
        const activeProvider = completionManager.getActiveProvider(
          inputState.value,
          inputState.cursorPosition
        );
        
        setCompletionState({
          items,
          selectedIndex: 0,
          isVisible: items.length > 0,
          type: activeProvider?.getType() || null,
        });
      } catch (error) {
        // Error updating completions - fallback to empty state
        setCompletionState({
          items: [],
          selectedIndex: 0,
          isVisible: false,
          type: null,
        });
      }
    };

    updateCompletions();
  }, [inputState.value, inputState.cursorPosition, completionManager]);

  // Set up keyboard handling
  useKeyboardHandler({
    inputActions,
    completionActions: completionActions(),
    clipboardProvider: clipboardManager,
    callbacks,
    hasCompletions: completionState.isVisible,
    inputValue: inputState.value,
    cursorPosition: inputState.cursorPosition,
    disabled: options.disabled,
  });

  return (
    <Box flexDirection="column">
      <InputBox state={inputState} options={options} />
      <HelpText state={inputState} />
      <CompletionDropdown state={completionState} />
    </Box>
  );
};