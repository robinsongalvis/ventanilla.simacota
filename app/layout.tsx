import type { Metadata } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import './globals.css';

// Body + UI text — DM Sans per Obsidian Kinetic spec
const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

// Headlines — Manrope 700/800
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ventanilla Única Digital – Alcaldía de Simacota',
  description:
    'Plataforma oficial de radicación de solicitudes ciudadanas de la Alcaldía Municipal de Simacota, Santander. Atención digital híbrida con trazabilidad total.',
  keywords: ['Simacota', 'Alcaldía', 'Ventanilla Única', 'Radicación', 'Santander'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${manrope.variable} h-full`}
    >
      <body className="min-h-full bg-[#0A0A0B] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
