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

  // Calculate scrolling window based on selected index
  const startIndex = Math.max(0, Math.min(state.selectedIndex - Math.floor(maxItems / 2), state.items.length - maxItems));
  const endIndex = Math.min(startIndex + maxItems, state.items.length);
  const visibleItems = state.items.slice(startIndex, endIndex);
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
          const actualIndex = startIndex + index;
          const isSelected = actualIndex === state.selectedIndex;
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