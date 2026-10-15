import type { Config } from 'tailwindcss';

/**
 * Paleta institucional del Colegio Americano de Oruro.
 *
 * `primary` es el azul del colegio (#13193B) y se usa en botones, enlaces,
 * encabezados y en la barra superior. `gray`/`plomo` es el gris institucional
 * (#676767) en una escala neutra (sin el tinte azulado de la escala por
 * defecto de Tailwind), que se usa para bordes, textos secundarios y fondos.
 *
 * Los colores de estado (verde/amarillo/rojo) y los colores por rol de la
 * credencial se mantienen tal como los define el SDD (10.2): nunca se indican
 * estados solo por color y cada rol debe distinguirse del resto.
 */
const plomo = {
  50: '#F7F7F7',
  100: '#F0F0F0',
  200: '#E0E0E0',
  300: '#C7C7C7',
  400: '#9E9E9E',
  500: '#7A7A7A',
  600: '#676767',
  700: '#4A4A4A',
  800: '#333333',
  900: '#212121',
} as const;

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#F2F3F8',
          100: '#E2E5EF',
          200: '#C6CBE0',
          300: '#9BA3C6',
          400: '#6C77A5',
          500: '#3F4A7D',
          600: '#13193B',
          700: '#0E1330',
          800: '#0A0E24',
          900: '#070A19',
        },
        /** Alias explícito del plomo institucional (mismos valores que `gray`). */
        plomo,
        /** La escala de grises de Tailwind pasa a ser neutra (plomo). */
        gray: plomo,
        status: {
          ok: '#16A34A',
          warning: '#F59E0B',
          error: '#DC2626',
        },
        role: {
          delegado: '#1D4ED8',
          docente: '#0F766E',
          mesa: '#7C2D12',
          secretaria: '#6D28D9',
          staff: '#111827',
          invitado: '#B45309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(19 25 59 / 0.04), 0 1px 3px 0 rgb(19 25 59 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
