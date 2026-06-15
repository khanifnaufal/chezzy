import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from '../components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Chezzy Chess Analyzer',
  description: 'Interactive Chess Analyzer with Stockfish Engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100 flex flex-col`}>
        <Navbar />
        <div className="flex-1 w-full">
          {children}
        </div>
      </body>
    </html>
  );
}

