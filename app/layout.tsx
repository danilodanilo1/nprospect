import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pospect — Prospecção Inteligente para Materiais de Construção",
    template: "%s | Pospect",
  },
  description:
    "CRM B2B de prospecção com PNCP, Google Places, IA e automação n8n para lojas de materiais de construção.",
  keywords: [
    "prospecção",
    "materiais de construção",
    "CRM B2B",
    "PNCP",
    "construtoras",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
