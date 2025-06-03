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

  const iconOnly = !children && !!icon;
  const variantClasses = {
    primary: 'bg-primary text-white shadow hover:shadow-md focus:ring-primary transform hover:-translate-y-0.5 transition-transform duration-200 ease-in-out',
    secondary: 'bg-secondary text-secondary-foreground shadow hover:shadow-md focus:ring-secondary transform hover:-translate-y-0.5 transition-transform duration-200 ease-in-out',
    danger: 'bg-destructive text-destructive-foreground shadow hover:shadow-md focus:ring-destructive transform hover:-translate-y-0.5 transition-transform duration-200 ease-in-out',
    ghost: 'hover:bg-accent hover:text-accent-foreground focus:ring-accent',
    link: 'text-primary underline-offset-4 hover:underline focus:ring-primary',
  };

  const sizeClasses = {
    sm: iconOnly ? 'h-8 w-8 p-1.5' : 'h-9 px-3 py-2',
    md: iconOnly ? 'h-10 w-10 p-2' : 'h-10 px-4 py-2',
    lg: iconOnly ? 'h-11 w-11 p-2.5' : 'h-11 px-8 py-3',
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const buttonClasses = cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && !iconOnly && 'w-full',
    className
  );

  const content = (
    <>
      {loading ? (
        <LoadingSpinner size={size} className={iconOnly ? '' : (iconPosition === 'left' ? 'mr-2' : 'ml-2')} />
      ) : icon && iconPosition === 'left' ? (
        <span className={cn(iconOnly ? '' : 'mr-2', iconSizeClasses[size])}>{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === 'right' && (
        <span className={cn(iconOnly ? '' : 'ml-2', iconSizeClasses[size])}>{icon}</span>
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
