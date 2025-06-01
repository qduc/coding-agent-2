import React from 'react';
import { cn } from '../../utils/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          'rounded border-gray-300 focus:ring-2 focus:ring-offset-2',
          {
            'text-primary-500 focus:ring-primary-300': variant === 'primary',
            'text-gray-500 focus:ring-gray-300': variant === 'secondary',
            'h-4 w-4': size === 'sm',
            'h-5 w-5': size === 'md',
            'h-6 w-6': size === 'lg',
          },
          className
        )}
        {...props}
        onChange={e => {
          if (props.onChange) {
            props.onChange(e.target.checked);
          }
        }}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
