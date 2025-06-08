import React from 'react';
import { Box, Text } from 'ink';
import { CompletionState } from '../types';

export interface CompletionDropdownProps {
  state: CompletionState;
  maxItems?: number;
}

export const CompletionDropdown: React.FC<CompletionDropdownProps> = ({
  state,
  maxItems = 8
}) => {
  if (!state.isVisible || state.items.length === 0) {
    return null;
  }

  const visibleItems = state.items.slice(0, maxItems);
  const hasMoreItems = state.items.length > maxItems;

  const getTitle = () => {
    switch (state.type) {
      case 'file':
        return '📁 File Completions:';
      case 'command':
        return '⚡ Command Completions:';
      default:
        return '💡 Completions:';
    }
  };

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="cyan" bold>
        {getTitle()}
      </Text>
      <Box flexDirection="column" marginLeft={2}>
        {visibleItems.map((item, index) => {
          const isSelected = index === state.selectedIndex;
          return (
            <Text
              key={index}
              color={isSelected ? "black" : "blue"}
              backgroundColor={isSelected ? "cyan" : undefined}
            >
              {isSelected ? '▶ ' : '  '}{item.value}
              {item.description && (
                <Text color={isSelected ? "black" : "gray"}>
                  {' - ' + item.description}
                </Text>
              )}
            </Text>
          );
        })}
        {hasMoreItems && (
          <Text color="gray">
            {'  ... and ' + (state.items.length - maxItems) + ' more (↑/↓ to navigate)'}
          </Text>
        )}
      </Box>
    </Box>
  );
};