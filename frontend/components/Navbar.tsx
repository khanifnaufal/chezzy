'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Gamepad2, History, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/game', label: 'Game', icon: <Gamepad2 className="w-4 h-4 shrink-0" /> },
    { href: '/history', label: 'History', icon: <History className="w-4 h-4 shrink-0" /> },
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo and title */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 group-hover:scale-105 transition flex items-center justify-center">
            <Image
              src="/logos/logo_concept3_arrow_knight.svg"
              alt="CHEZZY Logo"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-indigo-400 to-violet-500 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-violet-400 transition font-serif">
            CHEZZY
          </h1>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = link.href === '/game'
              ? pathname === '/game' || pathname === '/'
              : pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition duration-150 border ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
