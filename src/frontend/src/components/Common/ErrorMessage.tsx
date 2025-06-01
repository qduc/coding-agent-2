import React from 'react';
import { cn } from '../../utils/cn';

export interface ErrorMessageProps {
  message?: string;
  // Changed to accept an array of objects with a 'message' property
  errors?: { message: string }[];
  className?: string;
  variant?: 'primary' | 'secondary';
  id?: string;
}

export const ErrorMessage = React.forwardRef<HTMLDivElement, ErrorMessageProps>(
  ({ message, errors, className, variant = 'primary', id }, ref) => {
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
          // Accessing error.message as per the updated type
          <div key={index}>{error.message}</div>
        ))}
      </div>
    );
  }
);

ErrorMessage.displayName = 'ErrorMessage';
