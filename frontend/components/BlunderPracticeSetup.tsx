'use client';

import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { BASE_URL } from '../lib/api';
import { AlertTriangle, Trophy } from 'lucide-react';

export interface BlunderPosition {
  game_id: string;
  move_number: number;
  fen_before: string;
  your_move_was: string;
  label: string;
  date: string | null;
  score_after: number | null;
  is_white: boolean;
}

interface BlunderPracticeSetupProps {
  onLoadPosition: (fen: string, blunderData: BlunderPosition) => void;
  onBack: () => void;
}

export default function BlunderPracticeSetup({ onLoadPosition, onBack }: BlunderPracticeSetupProps) {
  const [blunderPositions, setBlunderPositions] = useState<BlunderPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    fetch(`${BASE_URL}/api/practice/blunder-positions`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Gagal mengambil daftar blunder.');
        }
        return res.json();
      })
      .then((data) => {
        if (active) {
          setBlunderPositions(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error(err);
          setError(err.message || 'Terjadi kesalahan saat menghubungi server.');
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5 text-left animate-fade-in w-full max-w-sm sm:max-w-md">
      <h3 className="text-xl font-black text-center text-slate-100 bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">
        Latihan dari Blunder Kamu
      </h3>
      <p className="text-xs text-slate-400 text-center -mt-3">
        Pilih posisi di mana Anda melakukan kesalahan dan cari langkah yang lebih baik
      </p>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-indigo-500 animate-spin" />
          <span className="text-xs text-slate-400 animate-pulse font-medium">Memuat daftar blunder...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-2xl text-center font-medium flex items-center justify-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" /> {error}
        </div>
      ) : blunderPositions.length === 0 ? (
        <div className="py-12 bg-slate-950/40 border border-slate-800/60 rounded-3xl p-6 text-center flex flex-col items-center gap-2">
          <Trophy className="w-10 h-10 text-amber-400 mb-1 animate-bounce" />
          <p className="text-sm font-bold text-slate-300">Hebat! Belum ada blunder tercatat</p>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Mainkan game Solo Analisis atau VS Bot terlebih dahulu. Setiap kesalahan (Mistake / Blunder) yang Anda buat akan otomatis disimpan ke sini.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1 select-none custom-scrollbar">
          {blunderPositions.map((blunder, index) => {
            const dateStr = blunder.date
              ? new Date(blunder.date).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Tanggal tidak diketahui';

            return (
              <div
                key={index}
                className="group p-4 bg-slate-950/80 border border-slate-850 hover:border-indigo-500/40 rounded-2xl flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/5"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {dateStr}
                    </p>
                    <h4 className="text-sm font-bold text-slate-200 mt-1 truncate">
                      Move ke-{blunder.move_number}, kamu blunder di sini
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                      <span>Langkah asal:</span>
                      <span className="font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 text-[11px]">
                        {blunder.your_move_was}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/10">
                        {blunder.label}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  id={`btn-load-blunder-${index}`}
                  onClick={() => onLoadPosition(blunder.fen_before, blunder)}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-slate-100 font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-500/20 transition duration-150 active:scale-[0.98] text-center"
                >
                  Latihan Posisi Ini
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        id="btn-blunder-back"
        onClick={onBack}
        className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 rounded-xl text-center border border-slate-800/80 transition duration-100"
      >
        Kembali
      </button>
    </div>
  );
}
