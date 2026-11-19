import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      screens: { short: { raw: '(max-height: 480px)' } },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        sunken: token('sunken'),
        ink: token('ink'),
        muted: token('muted'),
        line: token('line'),
        navy: token('navy'),
        blue: token('blue'),
        lime: token('lime'),
        'lime-ink': token('lime-ink'),
        success: token('success'),
        danger: token('danger'),
        warn: token('warn'),
        accent: token('accent'),
        primary: token('primary'),
        'on-primary': token('on-primary'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        sans: ['"Manrope Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '22px',
        '2xl': '28px',
      },
      boxShadow: {
        card: '0 1px 0 rgb(var(--line) / 0.9), 0 8px 24px -16px rgb(16 28 44 / 0.25)',
        float: '0 18px 48px -18px rgb(16 28 44 / 0.45)',
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'sheet-up': { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'pop-in': { from: { transform: 'scale(.96)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        'toast-in': { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in .2s cubic-bezier(.2,.8,.2,1) both',
        shimmer: 'shimmer 1.4s linear infinite',
        'toast-in': 'toast-in .25s cubic-bezier(.2,.8,.2,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
