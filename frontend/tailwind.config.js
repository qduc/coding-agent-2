module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeInSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(15px)' },
          '100%': { opacity: '1', transform: 'translateY(0px)' },
        },
        dialogOverlayShow: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        dialogContentShow: {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0px) scale(1)' },
        }
      },
      animation: {
        'fade-in-slide-up': 'fadeInSlideUp 0.3s ease-out forwards',
        'dialog-overlay-show': 'dialogOverlayShow 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dialog-content-show': 'dialogContentShow 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        // Type scale: 16px base
        xs: ['0.75rem', '1.5'],      // 12px
        sm: ['0.875rem', '1.5'],     // 14px
        base: ['1rem', '1.5'],       // 16px
        lg: ['1.125rem', '1.4'],     // 18px
        xl: ['1.25rem', '1.4'],      // 20px
        '2xl': ['1.5rem', '1.3'],    // 24px
        '3xl': ['1.875rem', '1.2'],  // 30px
        '4xl': ['2.25rem', '1.2'],   // 36px
        '5xl': ['3rem', '1.1'],      // 48px
        '6xl': ['3.75rem', '1.1'],   // 60px
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight: '-0.02em',
        normal: '0',
        wide: '0.02em',
        wider: '0.04em',
      },
      lineHeight: {
        tight: '1.25',
        snug: '1.375',
        normal: '1.5',
        relaxed: '1.625',
        loose: '2',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        DEFAULT: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        md: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        lg: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        xl: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
      },
      backdropBlur: {
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
      },
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          light: '#93C5FD',
          dark: '#1D4ED8',
        },
        secondary: {
          DEFAULT: '#6B7280',
          light: '#9CA3AF',
          dark: '#374151',
        },
        destructive: {
          DEFAULT: '#EF4444',
          light: '#FECACA',
          dark: '#B91C1C',
        },
      },
      transitionTimingFunction: {
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
        'in': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
