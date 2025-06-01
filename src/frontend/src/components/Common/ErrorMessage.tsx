import React from 'react';
import { cn } from '../../utils/cn';

export interface ErrorMessageProps {
  message: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ message, className, variant = 'primary' }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'text-sm font-medium',
          {
            'text-red-500': variant === 'primary',
            'text-yellow-500': variant === 'secondary',
          },
          className
        )}
      >
        {message}
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
