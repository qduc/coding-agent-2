import React from 'react';
import { cn } from '../../utils/cn';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'size'> {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <label className={cn('relative inline-flex items-center cursor-pointer', className)}>
        <input 
          type="checkbox" 
          ref={ref}
          className="sr-only peer" 
          {...props}
          onChange={e => {
            if (props.onChange) {
              props.onChange(e.target.checked);
            }
          }}
        />
        <div className={cn(
          "peer rounded-full after:content-[''] after:absolute after:rounded-full after:transition-all",
          {
            'w-9 h-5 after:top-[2px] after:left-[2px] after:h-4 after:w-4': size === 'sm',
            'w-11 h-6 after:top-[2px] after:left-[2px] after:h-5 after:w-5': size === 'md',
            'w-14 h-7 after:top-[2px] after:left-[2px] after:h-6 after:w-6': size === 'lg',
            'bg-gray-200 peer-checked:bg-primary-500 peer-focus:ring-primary-300': variant === 'primary',
            'bg-gray-200 peer-checked:bg-gray-500 peer-focus:ring-gray-300': variant === 'secondary',
          }
        )} />
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
