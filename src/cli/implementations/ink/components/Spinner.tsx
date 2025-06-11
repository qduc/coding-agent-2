import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

export interface SpinnerProps {
  /** Whether the spinner is active/visible */
  active?: boolean;
  /** Custom spinner frames - defaults to dots animation */
  frames?: string[];
  /** Animation speed in milliseconds */
  speed?: number;
  /** Text to show alongside the spinner */
  text?: string;
  /** Color of the spinner */
  color?: string;
}

// Different spinner types
export const spinnerFrames = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  dots2: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
  dots3: ['⠁', '⠂', '⠄', '⡀', '⢀', '⠠', '⠐', '⠈'],
  simpleBar: ['|', '/', '-', '\\'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  pulseDots: ['.  ', '.. ', '...', ' ..', '  .', '   '],
  wave: ['▁', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃'],
  thinking: ['🤔', '💭', '🧠', '⚡']
};

export const Spinner: React.FC<SpinnerProps> = ({
  active = true,
  frames = spinnerFrames.dots,
  speed = 80,
  text,
  color = 'cyan'
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [active, frames.length, speed]);

  if (!active) return null;

  return (
    <Text color={color}>
      {frames[currentFrame]}
      {text && ` ${text}`}
    </Text>
  );
};

// Convenience spinner components for common use cases
export const ProcessingSpinner: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <Spinner
    active={active}
    frames={spinnerFrames.dots}
    text="Processing"
    color="cyan"
    speed={80}
  />
);

export const ThinkingSpinner: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <Spinner
    active={active}
    frames={spinnerFrames.thinking}
    text="Thinking"
    color="yellow"
    speed={500}
  />
);

export const TypingSpinner: React.FC<{ active?: boolean }> = ({ active = true }) => (
  <Spinner
    active={active}
    frames={spinnerFrames.pulseDots}
    text=""
    color="gray"
    speed={200}
  />
);
