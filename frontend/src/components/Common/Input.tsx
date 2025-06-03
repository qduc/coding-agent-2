import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'primary', size = 'md', error = false, prefix, suffix, ...props }, ref) => {
    const hasPrefix = !!prefix;
    const hasSuffix = !!suffix;

    return (
      <div className={cn('relative flex items-center w-full', className)}>
        {prefix && (
          <div className="absolute left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {prefix}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'block w-full rounded-md border bg-transparent transition-all duration-200 ease-in-out',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            {
              'border-gray-300 focus:ring-primary-500 focus:border-primary-500': variant === 'primary' && !error,
              'border-gray-500 focus:ring-gray-500 focus:border-gray-500': variant === 'secondary' && !error,
              'border-transparent focus:ring-gray-500': variant === 'ghost' && !error,
              'border-red-500 focus:ring-red-500': error,
              'text-sm py-1': size === 'sm',
              'text-base py-2': size === 'md',
              'text-lg py-3': size === 'lg',
              'pl-10': hasPrefix,
              'pr-10': hasSuffix,
              'px-3': !hasPrefix && !hasSuffix,
              'opacity-50 cursor-not-allowed': props.disabled,
            },
          )}
          {...props}
        />
        {suffix && (
          <div className="absolute right-0 pr-3 flex items-center pointer-events-none text-gray-400">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
