import { useInput, useApp } from 'ink';
import { useCallback } from 'react';
import { InputStateActions } from './useInputState';
import { logger } from '../../../../shared/utils/logger';
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
      const completedCommand = '/' + selectedItem.value;
      inputActions.setValue(completedCommand);
      inputActions.setCursorPosition(completedCommand.length);
      // Immediately submit the command after completion
      completionActions.hide();
      callbacks.onSubmit(completedCommand);
      inputActions.reset();
      return true;
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

    // Temporary logging for debugging Cmd+V
    if (inputChar === 'v') {
      logger.info('Detected V key. Key object:', key);
    }

    // Ignore all input when disabled, except interrupt commands
    if (disabled) {
      if (key.escape) {
        handleInterrupt();
      }
      return;
    }

    const keyEvent: KeyboardEvent = { inputChar, key };

    // Handle Shift+Enter: Insert newline
    if (key.return && key.shift) {
      inputActions.insertAtCursor('\n');
      return;
    }

    // Handle Enter with completions - use completion if available
    if (key.return && hasCompletions) {
      handleCompletionSelection();
      return; // Always return here to prevent submission
    }

    // Handle Enter: If line ends with '\', insert newline, else submit
    if (key.return) {
      if (inputValue.endsWith('\\')) {
        // Remove the trailing backslash and add a newline
        inputActions.setValue(inputValue.slice(0, -1) + '\n');
        inputActions.setCursorPosition(inputValue.length); // Move cursor to end
        return;
      }
      handleSubmit();
      return;
    }

    // Handle Escape: Close completions if open, else exit
    if (key.escape) {
      if (hasCompletions) {
        completionActions.hide();
        return;
      }
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

    // Handle up/down arrow for multi-line cursor movement when no completions
    if (key.upArrow && !hasCompletions) {
      // Move cursor up a line in multi-line input
      const lines = inputValue.split('\n');
      let charCount = 0;
      let currentLine = 0;
      let col = 0;
      for (let i = 0; i < lines.length; i++) {
        if (cursorPosition <= charCount + lines[i].length) {
          currentLine = i;
          col = cursorPosition - charCount;
          break;
        }
        charCount += lines[i].length + 1; // +1 for the newline
      }
      if (currentLine > 0) {
        const prevLineLen = lines[currentLine - 1].length;
        const newCol = Math.min(prevLineLen, col);
        let newPos = 0;
        for (let i = 0; i < currentLine - 1; i++) {
          newPos += lines[i].length + 1;
        }
        newPos += newCol;
        inputActions.setCursorPosition(newPos);
      }
      return;
    }
    if (key.downArrow && !hasCompletions) {
      // Move cursor down a line in multi-line input
      const lines = inputValue.split('\n');
      let charCount = 0;
      let currentLine = 0;
      let col = 0;
      for (let i = 0; i < lines.length; i++) {
        if (cursorPosition <= charCount + lines[i].length) {
          currentLine = i;
          col = cursorPosition - charCount;
          break;
        }
        charCount += lines[i].length + 1;
      }
      if (currentLine < lines.length - 1) {
        const nextLineLen = lines[currentLine + 1].length;
        const newCol = Math.min(nextLineLen, col);
        let newPos = 0;
        for (let i = 0; i < currentLine + 1; i++) {
          newPos += lines[i].length + 1;
        }
        newPos += newCol;
        inputActions.setCursorPosition(newPos);
      }
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

    // Handle regular character input (including paste bursts)
    if (!key.ctrl && !key.meta && inputChar && inputChar.length >= 1) {
      inputActions.insertAtCursor(inputChar);
    }
  });
}
