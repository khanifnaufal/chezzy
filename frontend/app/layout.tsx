import './globals.css';
import type { Metadata } from 'next';
import { Inter, Lora } from 'next/font/google';
import Navbar from '../components/Navbar';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../lib/auth-context';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'CHEZZY — AI Chess Analyzer',
  description: 'Elevate your chess with real-time Stockfish analysis. Get move classifications, threat detection, and strategic recommendations for every position.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${inter.variable} ${lora.variable} min-h-screen bg-slate-950 text-slate-100 flex flex-col`}>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#11231e', // Matches slate-900
                color: '#f4ede1', // Matches slate-100
                border: '1px solid #dfb75c', // Gold/brass accent border
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#11231e',
                },
              },
              error: {
                iconTheme: {
                  primary: '#f43f5e',
                  secondary: '#11231e',
                },
              },
            }}
          />
          <Navbar />
          <div className="flex-1 w-full">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}



