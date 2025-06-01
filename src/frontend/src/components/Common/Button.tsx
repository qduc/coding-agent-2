import React from 'react';
import { cn } from '../../utils/cn';
import { LoadingSpinner } from './LoadingSpinner';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

type PolymorphicButtonProps<E extends React.ElementType> = {
  as?: E;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
};

type ButtonProps<E extends React.ElementType> = PolymorphicButtonProps<E> &
  Omit<React.ComponentPropsWithoutRef<E>, keyof PolymorphicButtonProps<E>>;

const defaultElement = 'button';

export const Button = React.forwardRef(
  <E extends React.ElementType = typeof defaultElement>(
    props: ButtonProps<E>, // Destructure props inside the function body
    ref: React.ForwardedRef<React.ElementRef<E>>
  ) => {
    const {
      as,
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className,
      disabled,
      ...restProps // Collect remaining props
    } = props;

    const Component = as || defaultElement;
    const variantClasses = {
      primary: 'bg-primary text-white hover:bg-primary-dark focus:ring-primary',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary',
      danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive',
      ghost: 'hover:bg-accent hover:text-accent-foreground focus:ring-accent',
      link: 'text-primary underline-offset-4 hover:underline focus:ring-primary',
    };

    const sizeClasses = {
      sm: 'h-9 px-3 text-sm',
      md: 'h-10 px-4 py-2 text-base',
      lg: 'h-11 px-8 text-lg',
    };

    const iconSizeClasses = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    return (
      <Component
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...restProps} // Spread restProps here
      >
        {loading ? (
          <LoadingSpinner size={size} className={iconPosition === 'left' ? 'mr-2' : 'ml-2'} />
        ) : icon && iconPosition === 'left' ? (
          <span className={cn('mr-2', iconSizeClasses[size])}>{icon}</span>
        ) : null}
        {children}
        {!loading && icon && iconPosition === 'right' && (
          <span className={cn('ml-2', iconSizeClasses[size])}>{icon}</span>
        )}
      </Component>
    );
  }
) as <E extends React.ElementType = typeof defaultElement>(
  props: ButtonProps<E> & { ref?: React.ForwardedRef<React.ElementRef<E>> }
) => React.ReactElement;

Button.displayName = 'Button';
