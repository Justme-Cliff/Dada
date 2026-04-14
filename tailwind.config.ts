import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        auditory: '#3B82F6',
        wernicke: '#10B981',
        broca: '#F59E0B',
      },
    },
  },
  plugins: [],
} satisfies Config
