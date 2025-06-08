import React from 'react';
import { Text } from 'ink';
import { BoxRenderer } from '../../../../shared/utils/boxRenderer';
import { InputState, InputOptions } from '../types';

export interface InputBoxProps {
  state: InputState;
  options?: InputOptions;
}

export const InputBox: React.FC<InputBoxProps> = ({ state, options = {} }) => {
  const {
    maxWidth = Math.min(80, (process.stdout.columns || 80) - 4),
    minHeight = state.isMultilineMode ? 5 : 3,
    placeholder = state.value === '' ?
      'Type your message here... (@ for files, / for commands, Ctrl+V to paste)' :
      undefined,
    showCursor = true,
  } = options;

  const getTitle = () => {
    if (state.pasteIndicator) {
      return '📋 Pasted! (Enter or Ctrl+Enter to send)';
    }

    if (state.isMultilineMode) {
      return '💬 Multi-line Message (Ctrl+Enter to send)';
    }

    return '💬 Your Message (Enter to send, Enter again for multi-line)';
  };

  const inputBox = BoxRenderer.createInputBox(
    getTitle(),
    state.value,
    state.cursorPosition,
    {
      maxWidth,
      minHeight,
      placeholder,
      showCursor,
    }
  );

  return <Text>{inputBox}</Text>;
};