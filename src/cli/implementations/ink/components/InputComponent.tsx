import React, { useEffect } from 'react';
import { Box } from 'ink';
import { useInputState } from '../hooks/useInputState';
import { useCompletions } from '../hooks/useCompletions';
import { useKeyboardHandler } from '../hooks/useKeyboardHandler';
import { InputBox } from './InputBox';
import { HelpText } from './HelpText';
import { CompletionDropdown } from './CompletionDropdown';
import { CompletionManager } from '../services/completion/CompletionManager';
import { ClipboardManager } from '../services/clipboard/ClipboardManager';
import { InputCallbacks, InputOptions } from '../types';

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
  const { state: completionState, actions: completionActions } = useCompletions([]);

  // Update completions when input changes
  useEffect(() => {
    const updateCompletions = async () => {
      try {
        const items = await completionManager.getCompletions(
          inputState.value,
          inputState.cursorPosition
        );

        completionActions.refresh(inputState.value, inputState.cursorPosition);
      } catch (error) {
        console.error('Error updating completions:', error);
        completionActions.hide();
      }
    };

    updateCompletions();
  }, [inputState.value, inputState.cursorPosition, completionManager, completionActions]);

  // Set up keyboard handling
  useKeyboardHandler({
    inputActions,
    completionActions,
    clipboardProvider: clipboardManager,
    callbacks,
    hasCompletions: completionState.isVisible,
    inputValue: inputState.value,
    cursorPosition: inputState.cursorPosition,
  });

  return (
    <Box flexDirection="column">
      <InputBox state={inputState} options={options} />
      <HelpText state={inputState} />
      <CompletionDropdown state={completionState} />
    </Box>
  );
};