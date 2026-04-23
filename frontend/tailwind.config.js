/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#181818',
        foreground: '#ffffff',
        card: '#222222',
        border: '#333333',
        muted: '#C8C8C8',
        accent: '#22c55e',
        'accent-glow': '#00ff94',
        success: '#22c55e',
        mid: '#6B7280',
        urgent: '#FF0000',
        fiery: '#FF4500',
      },
      fontFamily: {
        display: ['Aileron', 'system-ui', 'sans-serif'],
        body: ['Aileron', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'accent-glow': '0 0 8px rgba(34, 197, 94, 0.18)',
        'accent-glow-lg': '0 0 40px rgba(34, 197, 94, 0.25)',
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'flash': 'flash 0.3s ease-in-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
};
