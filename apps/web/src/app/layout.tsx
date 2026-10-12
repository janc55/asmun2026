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
};

export const metadata: Metadata = {
  title: 'ASMUN Control — Registro y Control de Acceso',
  description:
    'Sistema de Registro, Credencialización y Control para el Modelo de Naciones Unidas del Colegio Americano de Oruro',
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
          <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            <main className="flex-1 pb-10">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
