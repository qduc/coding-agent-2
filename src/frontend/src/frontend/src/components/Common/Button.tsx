import React from 'react';
import { LoadingSpinner } from '../LoadingSpinner';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${styles[size]} ${
          fullWidth ? styles.fullWidth : ''
        } ${className}`}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && (
          <span className={styles.loadingSpinner}>
            <LoadingSpinner size={size} />
          </span>
        )}
        {icon && iconPosition === 'left' && !loading && (
          <span className={styles.iconLeft}>{icon}</span>
        )}
        {children}
        {icon && iconPosition === 'right' && !loading && (
          <span className={styles.iconRight}>{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
