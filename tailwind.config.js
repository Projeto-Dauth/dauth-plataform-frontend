// Fonte global do sistema — trocar só aqui para testar/aplicar uma fonte nova em tudo.
// Lembrar de atualizar também o <link> do Google Fonts em index.html se a fonte mudar.
const FONT_FAMILY = 'Inter'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      'rgb(var(--bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          2:       'rgb(var(--surface-2) / <alpha-value>)',
          3:       'rgb(var(--surface-3) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          2:       'rgb(var(--ink-2) / <alpha-value>)',
          3:       'rgb(var(--ink-3) / <alpha-value>)',
          4:       'rgb(var(--ink-4) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          2:       'rgb(var(--line-2) / <alpha-value>)',
          3:       'rgb(var(--line-3) / <alpha-value>)',
        },
        brand: {
          DEFAULT:  'rgb(var(--brand) / <alpha-value>)',
          dark:     'rgb(var(--brand-dark) / <alpha-value>)',
          ink:      '#ffffff',
          soft:     'rgb(var(--brand-soft) / <alpha-value>)',
          'soft-ink': 'rgb(var(--brand-soft-ink) / <alpha-value>)',
        },
        gold:    { DEFAULT: '#c9a57b', soft: '#f4e9d6' },
        success: { DEFAULT: '#4a6b3e', soft: '#e3ebd9' },
        warning: { DEFAULT: '#9a6b1f', soft: '#f6ead1' },
        danger:  { DEFAULT: '#8b3a32', soft: '#f3dcd8' },
      },
      fontFamily: {
        display: [FONT_FAMILY, 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body:    [FONT_FAMILY, 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    [FONT_FAMILY, 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
        serif:   [FONT_FAMILY, 'Georgia', 'serif'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px', '2xl': '28px' },
      boxShadow: {
        xs: '0 1px 2px rgba(0,0,0,0.04)',
        sm: '0 2px 6px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
      },
      fontSize: {
        xs: '11px', sm: '12.5px', md: '14px', lg: '16px',
        xl: '20px', '2xl': '28px', '3xl': '40px',
      },
    },
  },
  plugins: [],
}
