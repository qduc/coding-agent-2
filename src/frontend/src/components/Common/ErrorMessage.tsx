import React from 'react';
import { cn } from '../../utils/cn';

export interface ErrorMessageProps {
  message?: string;
  errors?: string[];
  className?: string;
  variant?: 'primary' | 'secondary';
  id?: string;
}

export const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ message, className, variant = 'primary' }, ref) => {
    return (
      <div
        ref={ref}
        id={id}
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
        {errors && errors.map((error, index) => (
          <div key={index}>{error}</div>
        ))}
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
