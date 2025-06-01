import React from 'react';
import { cn } from '../../utils/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, variant = 'primary', size = 'md', error = false, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'block w-full rounded-md border bg-transparent transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          {
            'border-gray-300 focus:ring-primary-500 focus:border-primary-500': variant === 'primary' && !error,
            'border-gray-500 focus:ring-gray-500 focus:border-gray-500': variant === 'secondary' && !error,
            'border-transparent focus:ring-gray-500': variant === 'ghost' && !error,
            'border-red-500 focus:ring-red-500': error,
            'text-sm py-1 px-2': size === 'sm',
            'text-base py-2 px-3': size === 'md',
            'text-lg py-3 px-4': size === 'lg',
            'opacity-50 cursor-not-allowed': props.disabled,
          },
          className
        )}
        {...props}
      />
    );
  }
);

Select.displayName = 'Select';

export { Select };
