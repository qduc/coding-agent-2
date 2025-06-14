import { useInput, useApp } from 'ink';
import { useCallback } from 'react';
import { InputStateActions } from './useInputState';
import { CompletionActions } from './useCompletions';
import { ClipboardProvider } from '../services/clipboard/ClipboardProvider';
import { KeyboardEvent, InputCallbacks } from '../types';

export interface UseKeyboardHandlerOptions {
  inputActions: InputStateActions;
  completionActions: CompletionActions;
  clipboardProvider: ClipboardProvider;
  callbacks: InputCallbacks;
  hasCompletions: boolean;
  inputValue: string;
  cursorPosition: number;
  disabled?: boolean;
}

export function useKeyboardHandler({
  inputActions,
  completionActions,
  clipboardProvider,
  callbacks,
  hasCompletions,
  inputValue,
  cursorPosition,
  disabled = false,
}: UseKeyboardHandlerOptions): void {
  const { exit } = useApp();

  const handlePaste = useCallback(async () => {
    try {
      const content = await clipboardProvider.getContent();
      if (content) {
        inputActions.insertAtCursor(content);
        inputActions.showPasteIndicator();
      }
    } catch (error) {
      // Failed to paste - could be logged to file or handled differently
    }
  }, [inputActions, clipboardProvider]);

  const handleCompletionSelection = useCallback((useFirst: boolean = false) => {
    const selectedItem = useFirst ? 
      (completionActions.selectFirst(), completionActions.getSelectedItem()) :
      completionActions.getSelectedItem();

    if (!selectedItem) return false;

    if (selectedItem.type === 'file') {
      const lastAtIndex = inputValue.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const beforeAt = inputValue.substring(0, lastAtIndex + 1);
        const afterAt = inputValue.substring(lastAtIndex + 1);
        const spaceIndex = afterAt.indexOf(' ');
        const afterPartial = spaceIndex === -1 ? '' : afterAt.substring(spaceIndex);

        // Add space after file path for continued typing
        const newValue = beforeAt + selectedItem.value + ' ' + afterPartial;
        inputActions.setValue(newValue);
        inputActions.setCursorPosition(beforeAt.length + selectedItem.value.length + 1);
      }
    } else if (selectedItem.type === 'command') {
      inputActions.setValue('/' + selectedItem.value);
      inputActions.setCursorPosition(selectedItem.value.length + 1);
    }

    completionActions.hide();
    return true;
  }, [inputValue, inputActions, completionActions]);

  const handleSubmit = useCallback(() => {
    callbacks.onSubmit(inputValue);
    inputActions.reset();
    completionActions.hide();
  }, [inputValue, callbacks, inputActions, completionActions]);

  const handleExit = useCallback(() => {
    callbacks.onExit();
    exit();
  }, [callbacks, exit]);

  const handleInterrupt = useCallback(() => {
    if (callbacks.onInterrupt) {
      callbacks.onInterrupt();
    }
  }, [callbacks]);

  useInput((inputChar: string, key: any) => {
    // Always exit on Ctrl+C, no matter what's happening
    if (key.ctrl && inputChar === 'c') {
      handleExit();
      return;
    }

    // Ignore all input when disabled, except interrupt commands
    if (disabled) {
      if (key.escape) {
        handleInterrupt();
      }
      return;
    }

    const keyEvent: KeyboardEvent = { inputChar, key };

    // Handle Ctrl+Enter: Submit message
    if (key.return && key.ctrl) {
      handleSubmit();
      return;
    }

    // Handle Enter with completions - use completion if available
    if (key.return && hasCompletions) {
      handleCompletionSelection();
      return; // Always return here to prevent submission
    }

    // Handle Enter: Submit or add newline
    if (key.return) {
      if (inputValue.trim()) {
        handleSubmit();
        return;
      }

      // Add newline for multi-line input
      inputActions.insertAtCursor('\n');
      return;
    }

    // Handle Escape: Exit (when not processing)
    if (key.escape) {
      handleExit();
      return;
    }

    // Handle Ctrl+V: Paste (Windows/Linux) or Cmd+V: Paste (macOS)
    if ((key.ctrl && inputChar === 'v') || (key.meta && inputChar === 'v')) {
      handlePaste();
      return;
    }

    // Handle Tab: Complete first item
    if (key.tab && hasCompletions) {
      handleCompletionSelection(true);
      return;
    }

    // Handle completion navigation
    if (key.upArrow && hasCompletions) {
      completionActions.selectPrevious();
      return;
    }

    if (key.downArrow && hasCompletions) {
      completionActions.selectNext();
      return;
    }

    // Handle cursor movement
    if (key.leftArrow) {
      inputActions.moveCursor(-1);
      return;
    }

    if (key.rightArrow) {
      inputActions.moveCursor(1);
      return;
    }

    // Handle backspace/delete
    if (key.backspace || key.delete) {
      inputActions.deleteAtCursor();
      return;
    }

    // Handle regular character input
    if (!key.ctrl && !key.meta && inputChar && inputChar.length === 1) {
      inputActions.insertAtCursor(inputChar);
    }
  });
}
