import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type TextVariant = 'body' | 'caption' | 'small' | 'mono';

interface TextProps {
  as?: React.ElementType;
  variant?: TextVariant;
  className?: string;
  children: ReactNode;
}

interface HeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: ReactNode;
}

export const Text = ({
  as: Tag = 'p',
  variant = 'body',
  className,
  children
}: TextProps) => {
  const baseClasses = 'text-gray-900 dark:text-gray-100';

  const variantClasses = {
    body: 'text-base',
    caption: 'text-sm text-gray-600 dark:text-gray-400',
    small: 'text-xs text-gray-500 dark:text-gray-500',
    mono: 'font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded',
  };

  return (
    <Tag className={cn(
      baseClasses,
      variantClasses[variant],
      className
    )}>
      {children}
    </Tag>
  );
};

export const Heading = ({
  as,
  level,
  className,
  children
}: HeadingProps) => {
  const Tag = (as || `h${level}`) as keyof JSX.IntrinsicElements;

  const sizeClasses = {
    1: 'text-5xl font-bold',
    2: 'text-4xl font-bold',
    3: 'text-3xl font-bold',
    4: 'text-2xl font-bold',
    5: 'text-xl font-bold',
    6: 'text-lg font-bold',
  };

  return (
    <Tag className={cn(
      'text-gray-900 dark:text-gray-100',
      sizeClasses[level],
      className
    )}>
      {children}
    </Tag>
  );
};

export const Code = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
    {children}
  </code>
);
