'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Check, CheckCheck, AlertTriangle, X, Skull, Lightbulb } from 'lucide-react';

export interface OpponentAnalysis {
  label: string;
  explanation: string;
  threat: string;
  best_response: string;
}

export interface Move {
  moveNumber: number;
  san: string;
  uci?: string;
  label: string;
  explanation: string;
  isWhite: boolean;
  opponent_analysis?: OpponentAnalysis | null;
  flatIndex?: number;
}

interface MoveListProps {
  moves: Move[];
  activeMoveIndex?: number;
  onMoveClick?: (index: number) => void;
  noWrapper?: boolean;
}

interface MovePair {
  moveNumber: number;
  white?: Move;
  black?: Move;
}

const MoveList: React.FC<MoveListProps> = ({ moves, activeMoveIndex = -1, onMoveClick, noWrapper = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [hoveredMove, setHoveredMove] = useState<Move | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Auto-scroll to the active move or bottom when moves/activeMoveIndex changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      const activeEl = container.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      } else {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [moves, activeMoveIndex]);

  // Group flat moves array into white/black pairs
  const pairs: MovePair[] = [];
  moves.forEach((m, idx) => {
    let pair = pairs.find((p) => p.moveNumber === m.moveNumber);
    if (!pair) {
      pair = { moveNumber: m.moveNumber };
      pairs.push(pair);
    }
    const moveWithIndex = { ...m, flatIndex: idx };
    if (m.isWhite) {
      pair.white = moveWithIndex;
    } else {
      pair.black = moveWithIndex;
    }
  });

  // Sort pairs just in case
  pairs.sort((a, b) => a.moveNumber - b.moveNumber);

  const handleMouseEnter = (e: React.MouseEvent, move: Move) => {
    const targetRect = e.currentTarget.getBoundingClientRect();
    const container = containerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      
      // Calculate coordinates relative to containerRef
      const x = targetRect.left - containerRect.left + targetRect.width / 2;
      const y = targetRect.top - containerRect.top - 8; // Position 8px above the hovered element

      setTooltipPos({ x, y });
      setHoveredMove(move);
    }
  };

  const handleMouseLeave = () => {
    setHoveredMove(null);
  };

  const renderBadge = (label: string) => {
    const norm = label.toLowerCase();
    let bg = 'text-slate-400';
    let icon: React.ReactNode = null;

    if (norm === 'brilliant') {
      bg = 'text-purple-400 drop-shadow-[0_0_4px_rgba(168,85,247,0.4)]';
      icon = <Sparkles className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'excellent') {
      bg = 'text-emerald-400 drop-shadow-[0_0_4px_rgba(16,185,129,0.4)]';
      icon = <CheckCheck className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'good') {
      bg = 'text-emerald-400';
      icon = <Check className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'inaccuracy') {
      bg = 'text-amber-400 drop-shadow-[0_0_4px_rgba(234,179,8,0.4)]';
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'mistake') {
      bg = 'text-orange-400 drop-shadow-[0_0_4px_rgba(249,115,22,0.4)]';
      icon = <X className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'blunder') {
      bg = 'text-rose-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.4)]';
      icon = <Skull className="w-3.5 h-3.5 shrink-0" />;
    }

    if (!icon) return null;

    return (
      <span className={`inline-flex items-center justify-center select-none ${bg}`} title={label}>
        {icon}
      </span>
    );
  };

  // Tooltip content variables
  const isOpponent = hoveredMove ? !!hoveredMove.opponent_analysis : false;
  const displayLabel = hoveredMove
    ? (isOpponent ? hoveredMove.opponent_analysis!.label : hoveredMove.label)
    : '';
  const displayExplanation = hoveredMove
    ? (isOpponent ? hoveredMove.opponent_analysis!.explanation : hoveredMove.explanation)
    : '';
  const threat = hoveredMove
    ? (isOpponent ? hoveredMove.opponent_analysis!.threat : null)
    : null;
  const bestResponse = hoveredMove
    ? (isOpponent ? hoveredMove.opponent_analysis!.best_response : null)
    : null;

  return (
    <div 
      ref={containerRef} 
      className={noWrapper 
        ? "relative w-full flex flex-col h-full min-h-0" 
        : "relative w-full flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 min-h-[300px]"
      }
    >
      {!noWrapper && (
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-3 mb-4">
          Daftar Langkah (Move List)
        </h3>
      )}

      {pairs.length === 0 ? (
        <div className={noWrapper 
          ? "flex-1 flex items-center justify-center text-slate-500 text-sm py-6 text-center" 
          : "flex-1 flex items-center justify-center text-slate-500 text-sm py-12 text-center"
        }>
          Belum ada langkah dimainkan.
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className={noWrapper
            ? "flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col gap-1 h-full"
            : "flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col gap-1 max-h-[320px]"
          }
        >
          {pairs.map((pair) => (
            <div 
              key={pair.moveNumber} 
              className="grid grid-cols-12 items-center py-1 px-3 hover:bg-slate-950/20 rounded-lg transition duration-150 border border-transparent"
            >
              {/* Move number */}
              <div className="col-span-2 text-slate-500 font-serif font-bold text-sm">
                {pair.moveNumber}.
              </div>

              {/* White Move */}
              <div className="col-span-5 flex items-center">
                {pair.white ? (
                  <span
                    onClick={() => onMoveClick && onMoveClick(pair.white!.flatIndex!)}
                    data-active={pair.white.flatIndex === activeMoveIndex ? "true" : undefined}
                    title={`${pair.white.san} (${pair.white.label}): ${pair.white.explanation}`}
                    className={`cursor-pointer flex items-center gap-1.5 hover:bg-slate-800/80 transition-all px-2 py-0.5 rounded-lg border ${
                      pair.white.flatIndex === activeMoveIndex
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-[0_0_8px_rgba(99,102,241,0.2)] font-semibold'
                        : 'border-transparent text-slate-100 hover:text-white'
                    }`}
                  >
                    <span className="font-serif font-bold text-sm">{pair.white.san}</span>
                    {renderBadge(pair.white.label)}
                  </span>
                ) : (
                  <span className="text-slate-700 font-serif">-</span>
                )}
              </div>

              {/* Black Move */}
              <div className="col-span-5 flex items-center">
                {pair.black ? (
                  <span
                    onClick={() => onMoveClick && onMoveClick(pair.black!.flatIndex!)}
                    data-active={pair.black.flatIndex === activeMoveIndex ? "true" : undefined}
                    title={`${pair.black.san} (${pair.black.label}): ${pair.black.explanation}`}
                    className={`cursor-pointer flex items-center gap-1.5 hover:bg-slate-800/80 transition-all px-2 py-0.5 rounded-lg border ${
                      pair.black.flatIndex === activeMoveIndex
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-[0_0_8px_rgba(99,102,241,0.2)] font-semibold'
                        : 'border-transparent text-slate-100 hover:text-white'
                    }`}
                  >
                    <span className="font-serif font-bold text-sm">{pair.black.san}</span>
                    {renderBadge(pair.black.label)}
                  </span>
                ) : (
                  <span className="text-slate-650 font-serif">...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MoveList;
