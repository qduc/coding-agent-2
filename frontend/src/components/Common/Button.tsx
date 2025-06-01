import React from 'react';
import { cn } from '../../utils/cn';
import { LoadingSpinner } from './LoadingSpinner';
import { Link as RouterLink } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

// Common props for all button types
interface ButtonCommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

// Button-specific props
interface ButtonProps extends ButtonCommonProps, 
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonCommonProps> {
  as?: 'button';
}

// Anchor-specific props
interface AnchorProps extends ButtonCommonProps,
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonCommonProps> {
  as: 'a';
}

// React Router Link props
interface LinkProps extends ButtonCommonProps,
  Omit<React.ComponentProps<typeof RouterLink>, keyof ButtonCommonProps> {
  as: typeof RouterLink;
}

// Union type for all possible props
type PolymorphicButtonProps = ButtonProps | AnchorProps | LinkProps;

// Type guards
const isAnchorProps = (props: PolymorphicButtonProps): props is AnchorProps => {
  return props.as === 'a';
};

const isLinkProps = (props: PolymorphicButtonProps): props is LinkProps => {
  return props.as === RouterLink;
};

// Button component implementation
const ButtonComponent = (
  props: PolymorphicButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement | HTMLAnchorElement>
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
    ...restProps
  } = props;

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

  const buttonClasses = cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className
  );

  const content = (
    <>
      {loading ? (
        <LoadingSpinner size={size} className={iconPosition === 'left' ? 'mr-2' : 'ml-2'} />
      ) : icon && iconPosition === 'left' ? (
        <span className={cn('mr-2', iconSizeClasses[size])}>{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={cn('ml-2', iconSizeClasses[size])}>{icon}</span>
      )}
    </>
  );

  if (isLinkProps(props)) {
    const { as: Component, ...linkProps } = props;
    return (
      <Component
        ref={ref as any}
        className={buttonClasses}
        {...linkProps}
      >
        {content}
      </Component>
    );
  }

  if (isAnchorProps(props)) {
    return (
      <a
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        className={buttonClasses}
        {...(restProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      className={buttonClasses}
      disabled={disabled || loading}
      type="button"
      {...(restProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {content}
    </button>
  );
};

export const Button = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  PolymorphicButtonProps
>(ButtonComponent);

Button.displayName = 'Button';
