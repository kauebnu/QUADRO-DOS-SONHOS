// Escala de opacidade de 1 em 1 (o padrão do Tailwind pula valores como /12
// e /45, muito usados no acabamento dourado). O JIT só gera o que é usado.
const opacity = Object.fromEntries(
  Array.from({ length: 101 }, (_, i) => [String(i), String(i / 100)]),
)

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      opacity,
      colors: {
        ink: {
          950: '#050506',
          900: '#08080A',
          850: '#0C0C10',
          800: '#121216',
          700: '#1A1A20',
          600: '#24242C',
          500: '#33333D',
        },
        gold: {
          50: '#FBF6E4',
          100: '#F6EDC8',
          200: '#F0E1A4',
          300: '#E8D07C',
          400: '#DCBE5C',
          500: '#D4AF37',
          600: '#B8912F',
          700: '#8F6F24',
          800: '#67501A',
          900: '#403110',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond Variable"', 'Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(212,175,55,0.22), 0 18px 45px -20px rgba(212,175,55,0.45)',
        'gold-lg': '0 0 0 1px rgba(212,175,55,0.32), 0 30px 70px -25px rgba(212,175,55,0.6)',
        deep: '0 24px 60px -28px rgba(0,0,0,0.95)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg,#F6EDC8 0%,#D4AF37 42%,#8F6F24 100%)',
        'gold-sheen': 'linear-gradient(100deg,transparent 20%,rgba(246,237,200,.55) 48%,transparent 72%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-160% 0' },
          '100%': { backgroundPosition: '260% 0' },
        },
        'pulse-gold': {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(212,175,55,.45)' },
          '50%': { boxShadow: '0 0 0 12px rgba(212,175,55,0)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'ken-burns': {
          '0%': { transform: 'scale(1.06) translate3d(0,0,0)' },
          '100%': { transform: 'scale(1.18) translate3d(-1.5%,-1.5%,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .55s cubic-bezier(.2,.7,.3,1) both',
        'fade-in': 'fade-in .5s ease both',
        shimmer: 'shimmer 2.8s linear infinite',
        'pulse-gold': 'pulse-gold 2.4s ease-out infinite',
        float: 'float 5s ease-in-out infinite',
        'ken-burns': 'ken-burns 14s ease-out both',
      },
    },
  },
  plugins: [],
}
