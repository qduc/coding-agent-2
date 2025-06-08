import React from 'react';
import { Text } from 'ink';
import chalk from 'chalk';
import { InputState } from '../types';

export interface HelpTextProps {
  state: InputState;
}

export const HelpText: React.FC<HelpTextProps> = ({ state }) => {
  const getMessage = () => {
    if (state.pasteIndicator) {
      return 'Enter to send • Esc to cancel';
    }
    
    if (state.isMultilineMode) {
      return 'Ctrl+Enter to send • Esc to cancel';
    }
    
    return '@ for files • / for commands • Enter to send';
  };

  return (
    <Text>
      {chalk.gray.dim(getMessage())}
    </Text>
  );
};