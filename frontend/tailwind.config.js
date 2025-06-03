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
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
