import React from 'react';
import { cn } from '../../utils/cn';

export interface RadioGroupProps<T extends string = string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps<any>>(
  ({ options, value, onChange, variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center">
            <input
              type="radio"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className={cn(
                'mr-2 border-gray-300 focus:ring-2 focus:ring-offset-2',
                {
                  'text-primary-500 focus:ring-primary-300': variant === 'primary',
                  'text-gray-500 focus:ring-gray-300': variant === 'secondary',
                  'h-4 w-4': size === 'sm',
                  'h-5 w-5': size === 'md',
                  'h-6 w-6': size === 'lg',
                }
              )}
            />
            <span className={cn({
              'text-sm': size === 'sm',
              'text-base': size === 'md',
              'text-lg': size === 'lg',
            })}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    );
  }
);

RadioGroup.displayName = 'RadioGroup';
