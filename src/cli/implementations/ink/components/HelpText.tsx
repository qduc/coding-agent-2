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
      return '📋 Content pasted successfully! • Enter to send • Esc to cancel';
    }
    
    if (state.isMultilineMode) {
      return '💡 Tip: Use @ for files, / for commands • Ctrl+V to paste • Ctrl+Enter to send • Esc to cancel';
    }
    
    return '💡 Tip: Use @ for files, / for commands • Ctrl+V to paste • Enter to send (Enter again for multi-line) • Esc to cancel';
  };

  return (
    <Text>
      {chalk.gray.dim(getMessage())}
    </Text>
  );
};