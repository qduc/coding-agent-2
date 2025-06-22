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
    maxWidth = (process.stdout.columns || 80) - 2,
    minHeight = state.isMultilineMode ? 4 : 2,
    placeholder = state.value === '' ?
      '(@ for files, / for commands)' :
      undefined,
    showCursor = !options.disabled,
    disabled = false,
  } = options;

  const getTitle = () => {
    if (state.pasteIndicator) {
      return '📋 Pasted!';
    }

    if (state.isMultilineMode) {
      return '💬 Multi-line (Shift+Enter for newline, Enter to send)';
    }

    return options.prompt || '💬 Message';
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