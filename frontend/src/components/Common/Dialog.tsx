import React, { useEffect, useRef, useState } from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { Button } from './Button';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
    disabled?: boolean;
  }>;
}

export const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  ({ isOpen, onClose, title, children, className, overlayClassName, actions }, ref) => {
    const internalDialogRef = useRef<HTMLDivElement>(null);
    const combinedRef = ref || internalDialogRef;

    // State to control mounting/unmounting for exit animations
    const [isMounted, setIsMounted] = useState(isOpen);
    // State to control visibility classes for enter/exit transitions
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      if (isOpen) {
        setIsMounted(true);
        // Delay setting isVisible to true to allow CSS transitions to catch the change
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setIsVisible(true));
        });
      } else {
        setIsVisible(false); // Start exit animation
        // Unmount after animation duration
        const timer = setTimeout(() => setIsMounted(false), 200); // Corresponds to animation duration
        return () => clearTimeout(timer);
      }
    }, [isOpen]);

    useEffect(() => {
      if (!isMounted) return; // Don't add listeners if not mounted

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };

      // const handleOutsideClick = (e: MouseEvent) => { // Now handled by overlay click
      //   if (combinedRef.current && !combinedRef.current.contains(e.target as Node)) {
      //     onClose();
      //   }
      // };
      
      document.addEventListener('keydown', handleEscape);
      // document.addEventListener('mousedown', handleOutsideClick);
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        // document.removeEventListener('mousedown', handleOutsideClick);
        document.body.style.overflow = 'unset';
      };
    }, [isMounted, onClose, combinedRef]);
    
    if (!isMounted) return null;
    
    return createPortal(
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center motion-reduce:animate-none',
          isVisible ? 'animate-dialog-overlay-show' : 'opacity-0', // Apply animation or ensure initial state for exit
          overlayClassName
        )}
        aria-modal="true"
        role="dialog"
      >
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div
          ref={combinedRef}
          className={cn(
            'relative z-10 bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6 max-w-md w-full motion-reduce:animate-none',
            isVisible ? 'animate-dialog-content-show' : 'opacity-0 scale-95', // Apply animation or ensure initial state for exit
            className
          )}
        >
          {title && (
            <h2 className="text-xl font-bold mb-4">{title}</h2>
          )}
          <div className="mb-6">
            {children}
          </div>
          {actions && actions.length > 0 && (
            <div className="flex justify-end gap-3">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  onClick={action.onClick}
                  variant={action.variant || 'primary'}
                  disabled={action.disabled}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>,
      document.getElementById('dialog-root') || document.body // Prefer a dedicated root if available
    );
  }
);

Dialog.displayName = 'Dialog';
