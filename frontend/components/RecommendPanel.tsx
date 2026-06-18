'use client';

import React from 'react';
import { Recommendation } from '../lib/types';

interface RecommendPanelProps {
  recommendations: Recommendation[];
  onHighlight: (uci: string | null) => void;
  isMyTurn: boolean;
  isLoading?: boolean;
  noWrapper?: boolean;
}

export default function RecommendPanel({
  recommendations,
  onHighlight,
  isMyTurn,
  isLoading = false,
  noWrapper = false,
}: RecommendPanelProps) {
  
  // Render loading skeleton
  const renderSkeleton = () => (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <div 
          key={i} 
          className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 animate-pulse flex flex-col gap-3"
        >
          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <div className="w-8 h-5 bg-slate-800 rounded" />
              <div className="w-12 h-6 bg-slate-800 rounded" />
              <div className="w-16 h-5 bg-slate-800 rounded" />
            </div>
            <div className="w-10 h-6 bg-slate-800 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-800 rounded w-full" />
            <div className="h-3 bg-slate-800 rounded w-5/6" />
          </div>
          <div className="flex justify-between items-center mt-1">
            <div className="h-3 bg-slate-850 rounded w-1/2" />
            <div className="w-16 h-7 bg-slate-800 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className={noWrapper 
      ? "flex flex-col gap-4 h-full min-h-0" 
      : "bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl flex-1 min-h-[300px]"
    }>
      {noWrapper ? (
        <div className="text-xs text-slate-400 pb-1.5 border-b border-slate-800/40">
          {isMyTurn ? (
            <span className="text-emerald-400 font-semibold animate-pulse">● Giliran kamu</span>
          ) : (
            <span className="text-slate-500">● Menunggu move lawan...</span>
          )}
        </div>
      ) : (
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Rekomendasi Move</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isMyTurn ? (
                <span className="text-emerald-400 font-semibold animate-pulse">● Giliran kamu</span>
              ) : (
                <span className="text-slate-500">● Menunggu move lawan...</span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Content Area */}
      {!isMyTurn ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500">
          <div className="text-3xl mb-2">⏳</div>
          <p className="text-sm font-medium">Menunggu move lawan...</p>
          <p className="text-xs text-slate-650 mt-1 max-w-[250px] leading-relaxed">
            Rekomendasi langkah terbaik Stockfish akan muncul setelah lawan melangkah.
          </p>
        </div>
      ) : isLoading ? (
        renderSkeleton()
      ) : recommendations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12 text-center">
          Tidak ada rekomendasi untuk posisi ini. Silakan jalankan langkah baru.
        </div>
      ) : (
        <div className={noWrapper 
          ? "flex flex-col gap-3"
          : "flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin"
        }>
          {recommendations.slice(0, 3).map((rec, index) => {
            // Rank badge styling
            let rankLabel = `#${index + 1}`;
            let rankBadgeClass = 'bg-slate-800 text-slate-450 border-slate-700';
            if (index === 0) {
              rankBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            } else if (index === 1) {
              rankBadgeClass = 'bg-slate-300/10 text-slate-300 border-slate-300/20';
            } else if (index === 2) {
              rankBadgeClass = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            }

            // Move type badge styling
            let typeBadgeClass = 'bg-slate-800/80 text-slate-400 border-slate-700';
            if (rec.type === 'Taktik') {
              typeBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            } else if (rec.type === 'Defensive') {
              typeBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            } else if (rec.type === 'Endgame') {
              typeBadgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            } else if (rec.type === 'Posisional') {
              typeBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            }

            // Score formatting
            let scoreStr = '';
            if (rec.mate_in !== null) {
              scoreStr = `M${Math.abs(rec.mate_in)}`;
            } else if (rec.score !== null) {
              const pawnVal = rec.score / 100;
              scoreStr = pawnVal > 0 ? `+${pawnVal.toFixed(1)}` : pawnVal.toFixed(1);
            }

            return (
              <div
                key={rec.move_uci}
                className="shrink-0 p-4 bg-slate-950/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition flex flex-col gap-2 relative overflow-hidden"
              >
                {/* Top Row: Rank, Move, Score, Type */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-serif font-black px-1.5 py-0.5 rounded border ${rankBadgeClass}`}>
                      {rankLabel}
                    </span>
                    <span className="font-serif text-lg font-bold text-slate-100">
                      {rec.move_san}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${typeBadgeClass}`}>
                      {rec.type}
                    </span>
                  </div>

                  <span className="text-xs font-serif font-black text-indigo-500 bg-slate-950/40 px-2 py-1 rounded border border-slate-800">
                    {scoreStr}
                  </span>
                </div>

                {/* Explanation */}
                <p className="text-slate-350 text-xs leading-relaxed">
                  {rec.explanation}
                </p>

                {/* Risk and Action Row */}
                <div className="flex items-end justify-between gap-4 mt-1">
                  {rec.risk ? (
                    <p className="text-[11px] text-red-400 font-medium leading-snug flex-1 italic">
                      <span className="text-red-500/90 font-bold not-italic pr-1">Risk:</span>
                      {rec.risk}
                    </p>
                  ) : (
                    <div className="flex-1" />
                  )}

                  <button
                    onClick={() => onHighlight(rec.move_uci)}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-indigo-400 transition rounded-lg border border-slate-700 hover:border-indigo-500/40 active:scale-95 duration-100"
                  >
                    Lihat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
