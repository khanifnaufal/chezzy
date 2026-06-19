'use client';

import React, { useState } from 'react';
import { useAuth } from '../../lib/auth-context';
import { supabase } from '../../lib/supabase';
import { User, Calendar, ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!user || !user.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast.success('Link reset password telah dikirim ke email Anda!');
    } catch (err: any) {
      console.error('Error resetting password:', err);
      toast.error(err.message || 'Gagal mengirim email reset password.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      return dateString;
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
        {/* Profile Avatar Card */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 transition duration-150 text-amber-400 font-bold text-3xl flex items-center justify-center shadow-lg select-none mb-4">
            {user?.email ? user.email[0].toUpperCase() : 'U'}
          </div>
          <h2 className="text-2xl font-black font-serif text-slate-100 tracking-tight">Profil Akun</h2>
          <p className="text-xs text-slate-400 mt-1">Detail data keanggotaan Chezzy Anda</p>
        </div>

        {/* User Stats/Info Blocks */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Email Info */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</span>
              <span className="text-sm font-semibold text-slate-200 truncate">{user?.email || '-'}</span>
            </div>
          </div>

          {/* Registration Date Info */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Terdaftar Sejak</span>
              <span className="text-sm font-semibold text-slate-200">{formatDate(user?.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4">
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="w-full py-4 rounded-xl font-serif font-black text-slate-950 relative overflow-hidden group transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #dfb75c, #f5a623)',
              boxShadow: '0 0 25px rgba(223,183,92,0.25)',
            }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                <span>Reset Password</span>
              </>
            )}
          </button>
          
          <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-3 flex gap-2.5 items-start">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-500 leading-normal">
              Kami akan mengirimkan email konfirmasi berisi link aman untuk mereset kata sandi Anda. Silakan ikuti instruksi di dalam email tersebut.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
