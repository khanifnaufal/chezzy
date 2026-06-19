'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Gamepad2, History, LayoutDashboard, Loader2, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function Navbar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: '/game', label: 'Game', icon: <Gamepad2 className="w-4 h-4 shrink-0" /> },
    { href: '/history', label: 'History', icon: <History className="w-4 h-4 shrink-0" /> },
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  ];

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      setIsDropdownOpen(false);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logged out successfully');
      router.push('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to log out');
    }
  };

  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        {/* Logo and title */}
        <Link href="/" className="flex items-center gap-3 group shrink-0">
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

        {/* Navigation links & Auth actions */}
        <div className="flex items-center gap-6">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="font-mono text-xs text-slate-500 hidden sm:inline">Verifying session...</span>
            </div>
          ) : user ? (
            <>
              {/* Navigation links - hidden if not logged in */}
              <nav className="hidden md:flex items-center gap-1">
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

              {/* Profile Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 transition duration-150 text-amber-400 font-bold text-sm select-none"
                  title={user.email || 'User Profile'}
                >
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1.5">
                      <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Signed in as</p>
                      <p className="text-sm font-medium text-slate-300 truncate">{user.email}</p>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 transition mb-1.5"
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>Profile</span>
                    </Link>

                    {/* Mobile nav fallback inside dropdown */}
                    <div className="md:hidden flex flex-col gap-0.5 border-b border-slate-800/80 pb-1.5 mb-1.5">
                      {links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setIsDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition"
                        >
                          {link.icon}
                          <span>{link.label}</span>
                        </Link>
                      ))}
                    </div>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-left"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800/40 rounded-xl transition duration-150"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl transition duration-150 font-bold"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

