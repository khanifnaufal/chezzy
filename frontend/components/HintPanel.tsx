'use client';

import React, { useState, useEffect } from 'react';
import { getHint } from '../lib/api';

interface HintPanelProps {
  fen: string;
  is_white: boolean;
}

export default function HintPanel({ fen, is_white }: HintPanelProps) {
  const [hints, setHints] = useState<Record<number, string>>({});
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset hint panel when position (FEN) changes
  useEffect(() => {
    setHints({});
    setLoadingLevel(null);
    setError(null);
  }, [fen]);

  const getNextLevel = (): number | null => {
    if (!hints[1]) return 1;
    if (!hints[2]) return 2;
    if (!hints[3]) return 3;
    return null;
  };

  const handleRequestHint = async () => {
    const nextLevel = getNextLevel();
    if (!nextLevel) return;

    setLoadingLevel(nextLevel);
    setError(null);

    try {
      const response = await getHint(fen, nextLevel, is_white);
      setHints((prev) => ({
        ...prev,
        [nextLevel]: response.hint,
      }));
    } catch (err: any) {
      console.error('Error fetching hint:', err);
      setError('Gagal mengambil hint. Silakan coba lagi.');
    } finally {
      setLoadingLevel(null);
    }
  };

  const nextLevel = getNextLevel();

  const getButtonText = () => {
    if (loadingLevel !== null) {
      return 'Memuat petunjuk...';
    }
    if (!hints[1]) {
      return '💡 Minta Hint';
    }
    if (!hints[2]) {
      return '💡 Hint Lebih Dalam (Level 2)';
    }
    return '💡 Hint Lebih Dalam (Level 3)';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
      <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Petunjuk (Hints)</h3>
          <p className="text-xs text-slate-400 mt-0.5">Analisis posisi bertingkat</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold uppercase tracking-wider">
          Solo
        </span>
      </div>

      {/* Cards stack */}
      <div className="flex flex-col gap-3">
        {/* Level 1 Card */}
        {hints[1] && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-3 animate-fade-in">
            <span className="text-xl shrink-0">⚠️</span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Level 1: Threat Awareness</span>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{hints[1]}</p>
            </div>
          </div>
        )}

        {/* Level 2 Card */}
        {hints[2] && (
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 flex gap-3 animate-fade-in">
            <span className="text-xl shrink-0">🎯</span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Level 2: Tactical Hint</span>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{hints[2]}</p>
            </div>
          </div>
        )}

        {/* Level 3 Card */}
        {hints[3] && (
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 flex gap-3 animate-fade-in">
            <span className="text-xl shrink-0">🧠</span>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Level 3: Strategic Hint</span>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{hints[3]}</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-[11px] text-rose-400 font-medium bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 animate-fade-in">
          {error}
        </div>
      )}

      {/* Button or Final Message */}
      <div className="mt-2">
        {nextLevel ? (
          <button
            onClick={handleRequestHint}
            disabled={loadingLevel !== null}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:border-slate-800 text-slate-100 font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 disabled:shadow-none transition active:scale-95 duration-100 border border-indigo-500/20 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingLevel !== null && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-500 border-t-white animate-spin" />
            )}
            {getButtonText()}
          </button>
        ) : (
          <div className="text-center py-3 px-4 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs text-slate-400 font-medium leading-relaxed italic animate-fade-in">
            Sudah dapat semua hint, sekarang coba pikirkan sendiri move-nya
          </div>
        )}
      </div>
    </div>
  );
}
