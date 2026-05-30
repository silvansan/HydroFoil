/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './src/**/*.css',
    '../../packages/ui-kit/src/**/*.{js,jsx,ts,tsx}',
  ],
  safelist: [
    'bg-hydro-gradient',
    'bg-hydro-sidebar',
    'border-hydro-border',
    'bg-hydro-panel',
    'shadow-hydro',
    { pattern: /^(bg|border|text)-hydro-/ },
    { pattern: /^border-hydro-border\// },
    { pattern: /^bg-hydro-panel\// },
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e6fcff',
          100: '#b3f5ff',
          200: '#80eeff',
          300: '#4de7ff',
          400: '#1ae0ff',
          500: '#00c8e8',
          600: '#00a0ba',
          700: '#00788c',
          800: '#00505e',
          900: '#002830',
          950: '#00141a',
        },
        hydro: {
          base: '#050a14',
          panel: '#0c1628',
          border: '#1a2d4a',
        },
      },
      backgroundImage: {
        'hydro-gradient':
          'linear-gradient(135deg, #050a14 0%, #0a1628 40%, #0c2238 70%, #061018 100%)',
        'hydro-sidebar': 'linear-gradient(180deg, #0a1424 0%, #061018 100%)',
      },
      boxShadow: {
        hydro: '0 4px 24px rgba(0, 200, 232, 0.12)',
      },
    },
  },
  plugins: [],
};
