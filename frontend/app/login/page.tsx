'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Email dan password harus diisi.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Show clear error message for incorrect credentials or server issues
        let friendlyMessage = error.message;
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendlyMessage = 'Email atau password salah. Silakan coba lagi.';
        }
        setErrorMsg(friendlyMessage);
        toast.error(friendlyMessage);
      } else {
        toast.success('Login berhasil!');
        // Redirect to homepage
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
      toast.error(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-73px)] flex items-center justify-center px-6 py-12" style={{ background: 'linear-gradient(135deg, #050810 0%, #0a1020 40%, #0d1a10 70%, #050810 100%)' }}>
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(223,183,92,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(223,183,92,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Card container */}
      <div className="relative w-full max-w-md bg-slate-900/40 border border-white/8 backdrop-blur-xl rounded-2xl p-8 shadow-2xl z-10 animate-fade-in" style={{ boxShadow: '0 0 50px rgba(223,183,92,0.05), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
        {/* Logo and header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-16 h-16 mb-4 flex items-center justify-center animate-pulse">
            <Image
              src="/logos/logo_concept3_arrow_knight.svg"
              alt="CHEZZY Logo"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <h2 className="text-3xl font-black font-serif tracking-tight text-center" style={{
            background: 'linear-gradient(135deg, #dfb75c 0%, #f5d78e 50%, #dfb75c 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            CHEZZY
          </h2>
          <p className="text-sm text-slate-400 mt-2">Masuk ke akun Chezzy Anda</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="email">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-12 pr-4 py-3 bg-slate-950/50 border border-slate-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition duration-200"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="password">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="w-full pl-12 pr-12 py-3 bg-slate-950/50 border border-slate-800 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 rounded-xl text-slate-100 placeholder-slate-600 outline-none transition duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-xl font-serif font-black text-slate-950 relative overflow-hidden group transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #dfb75c, #f5a623)',
              boxShadow: '0 0 25px rgba(223,183,92,0.25)',
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                'Masuk'
              )}
            </span>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
          Belum punya akun?{' '}
          <Link href="/register" className="text-amber-400 hover:underline font-semibold">
            Daftar di sini
          </Link>
        </div>
      </div>
    </div>
  );
}
