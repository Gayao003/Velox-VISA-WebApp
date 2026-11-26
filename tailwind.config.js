/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        velox: {
          crimson: '#C8102E',
          dark: '#991B1B',
          slate: '#1E293B',
          light: '#FEF2F2',
        },
        primary: {
          DEFAULT: '#C8102E',
          hover: '#A30D24',
          light: '#FEF2F2',
          foreground: '#FFFFFF',
        },
        slate: {
          850: '#152033',
          950: '#0B1120',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
