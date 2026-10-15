import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { AuthProvider } from '../context/auth-context';
import { Navbar } from '../components/layout/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /** Color de la barra del navegador en móvil (azul institucional). */
  themeColor: '#13193B',
};

export const metadata: Metadata = {
  title: 'ASMUN Control — Registro y Control de Acceso',
  description:
    'Sistema de Registro, Credencialización y Control para el Modelo de Naciones Unidas del Colegio Americano de Oruro',
  /**
   * Icono del sitio: coloque el archivo en `apps/web/public/icono-asmun.png`.
   * Si todavía no existe, el navegador solo recibe un 404 en el icono y la
   * aplicación funciona igual.
   */
  icons: {
    icon: [{ url: '/icono-asmun.png', type: 'image/png' }],
    shortcut: '/icono-asmun.png',
    apple: '/icono-asmun.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen flex flex-col bg-plomo-100">
            <Navbar />
            <main className="flex-1 pb-10">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
