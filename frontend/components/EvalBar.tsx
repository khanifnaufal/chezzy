'use client';

import React from 'react';

interface EvalBarProps {
  score: number;
}

const EvalBar: React.FC<EvalBarProps> = ({ score }) => {
  // Gracefully handle null, undefined, or NaN scores
  const safeScore = (score === null || score === undefined || isNaN(score)) ? 0 : score;

  // Helper to format score
  const getDisplayScore = (): string => {
    const absScore = Math.abs(safeScore);
    // Check if it's mate (convention: |score| >= 9000 is a mate in N moves)
    if (absScore >= 9000) {
      const moves = safeScore > 0 ? (10000 - safeScore) : Math.abs(-10000 - safeScore);
      return `M${moves}`;
    }
    const pawnScore = safeScore / 100;
    return pawnScore > 0 ? `+${pawnScore.toFixed(2)}` : pawnScore.toFixed(2);
  };

  // Convert score to percentage of white area (top portion of the bar)
  const getWhitePercentage = (): number => {
    const absScore = Math.abs(safeScore);
    if (absScore >= 9000) {
      return safeScore > 0 ? 100 : 0;
    }
    const pawnScore = safeScore / 100;
    // Limit pawn score range to [-8.0, 8.0] for visual aesthetics
    const maxPawn = 8;
    const clampedPawn = Math.max(-maxPawn, Math.min(maxPawn, pawnScore));
    
    // In a vertical bar with white at the top:
    // If White is winning (pawnScore > 0), white percentage is high (closer to 100)
    // If Black is winning (pawnScore < 0), white percentage is low (closer to 0)
    return 50 + (clampedPawn / maxPawn) * 50;
  };

  const whitePercent = getWhitePercentage();
  const displayScore = getDisplayScore();
  const isWhiteWinning = safeScore >= 0;

  return (
    <div className="relative w-7 bg-slate-950 border-2 border-slate-700/80 rounded-xl overflow-hidden shadow-2xl flex flex-col select-none">
      {/* White portion (top) */}
      <div
        className="bg-slate-100 transition-[height] duration-700 ease-out w-full"
        style={{ height: `${whitePercent}%` }}
      />
      {/* Black portion (bottom) filled by the remaining space of flex container */}
      <div className="flex-1 w-full bg-slate-950" />

      {/* Floating evaluation text inside the bar */}
      {isWhiteWinning ? (
        <span className="absolute top-3 left-0 right-0 text-[10px] font-extrabold text-slate-950 text-center font-mono tracking-tighter z-10">
          {displayScore}
        </span>
      ) : (
        <span className="absolute bottom-3 left-0 right-0 text-[10px] font-extrabold text-slate-100 text-center font-mono tracking-tighter z-10">
          {displayScore}
        </span>
      )}
    </div>
  );
};

export default EvalBar;
