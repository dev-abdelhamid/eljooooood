/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#A47148',
          foreground: '#F7F0E8'
        },
        secondary: {
          DEFAULT: '#D6A772',
          foreground: '#4A4A4A'
        },
        accent: {
          DEFAULT: '#F7F0E8',
          foreground: '#A47148'
        },
        jawdiya: {
          brown: '#A47148',
          caramel: '#D6A772',
          beige: '#F7F0E8',
          'brown-dark': '#8B5A3C',
          'caramel-light': '#E4B88A'
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF'
        },
        muted: {
          DEFAULT: '#F7F0E8',
          foreground: '#8B5A3C'
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#4A4A4A'
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#4A4A4A'
        },
        sidebar: {
          DEFAULT: '#FFFFFF',
          foreground: '#4A4A4A',
          primary: '#A47148',
          'primary-foreground': '#F7F0E8',
          accent: '#F7F0E8',
          'accent-foreground': '#A47148',
          border: '#D6A772',
          ring: '#A47148'
        }
      }
    }
  }
};
