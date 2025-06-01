import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../utils/cn';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
}

export const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ isOpen, onClose, title, children, className, overlayClassName }, ref) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      
      const handleOutsideClick = (e: MouseEvent) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      
      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
        document.addEventListener('mousedown', handleOutsideClick);
        document.body.style.overflow = 'hidden';
      }
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousedown', handleOutsideClick);
        document.body.style.overflow = 'unset';
      };
    }, [isOpen, onClose]);
    
    if (!isOpen) return null;
    
    return ReactDOM.createPortal(
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center',
          overlayClassName
        )}
        aria-modal="true"
        role="dialog"
      >
        <div className="fixed inset-0 bg-black/50" />
        <div
          ref={ref || dialogRef}
          className={cn(
            'relative z-10 bg-white rounded-lg shadow-lg p-6 max-w-md w-full',
            className
          )}
        >
          {title && (
            <h2 className="text-xl font-bold mb-4">{title}</h2>
          )}
          {children}
        </div>
      </div>,
      document.body
    );
  }
);

Dialog.displayName = 'Dialog';
