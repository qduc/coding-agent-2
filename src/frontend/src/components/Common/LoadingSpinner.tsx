import React from 'react';
import { cn } from '../../utils/cn';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'md', className, fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  };

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50">
        <div className={cn(
          'animate-spin rounded-full border-t-transparent border-primary',
          sizeClasses[size],
          className
        )} />
      </div>
    );
  }

  return (
    <div className={cn(
      'animate-spin rounded-full border-t-transparent border-current',
      sizeClasses[size],
      className
    )} />
  );
}