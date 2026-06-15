'use client';

import React, { useState, useRef, useEffect } from 'react';

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
}

interface MovePair {
  moveNumber: number;
  white?: Move;
  black?: Move;
}

const MoveList: React.FC<MoveListProps> = ({ moves, activeMoveIndex = -1, onMoveClick }) => {
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
    let bg = 'bg-slate-800 text-slate-400 border-slate-700';
    let text = label;
    let icon = '';

    if (norm === 'brilliant') {
      bg = 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]';
      text = 'Brilliant';
      icon = '✨';
    } else if (norm === 'good' || norm === 'excellent') {
      bg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
      text = 'Good';
      icon = '✓';
    } else if (norm === 'inaccuracy') {
      bg = 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(234,179,8,0.15)]';
      text = 'Inaccuracy';
      icon = '⚠';
    } else if (norm === 'mistake') {
      bg = 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]';
      text = 'Mistake';
      icon = '✗';
    } else if (norm === 'blunder') {
      bg = 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_8px_rgba(239,68,68,0.15)]';
      text = 'Blunder';
      icon = '✗✗';
    }

    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold select-none ${bg}`}>
        <span>{text}</span>
        {icon && <span className="text-[9px] ml-0.5">{icon}</span>}
      </span>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 min-h-[300px]"
    >
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-3 mb-4">
        Daftar Langkah (Move List)
      </h3>

      {pairs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm py-12 text-center">
          Belum ada langkah dimainkan.
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-1 scrollbar-thin flex flex-col gap-2 max-h-[320px]"
        >
          {pairs.map((pair) => (
            <div 
              key={pair.moveNumber} 
              className="grid grid-cols-12 items-center py-1.5 px-3 hover:bg-slate-950/20 rounded-lg transition duration-150 border border-transparent"
            >
              {/* Move number */}
              <div className="col-span-2 text-slate-500 font-mono font-bold text-sm">
                {pair.moveNumber}.
              </div>

              {/* White Move */}
              <div className="col-span-4 flex items-center">
                {pair.white ? (
                  <span
                    onMouseEnter={(e) => handleMouseEnter(e, pair.white!)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => onMoveClick && onMoveClick(pair.white!.flatIndex!)}
                    data-active={pair.white.flatIndex === activeMoveIndex ? "true" : undefined}
                    className={`cursor-pointer flex items-center gap-1.5 hover:bg-slate-800/80 transition-all px-2 py-1 rounded-lg border ${
                      pair.white.flatIndex === activeMoveIndex
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-[0_0_8px_rgba(99,102,241,0.2)] font-semibold'
                        : 'border-transparent text-slate-100 hover:text-white'
                    }`}
                  >
                    <span className="font-mono font-semibold">{pair.white.san}</span>
                    {renderBadge(pair.white.label)}
                  </span>
                ) : (
                  <span className="text-slate-700 font-mono">-</span>
                )}
              </div>

              {/* Separator */}
              <div className="col-span-2 text-slate-600 font-mono text-center text-xs">
                ...
              </div>

              {/* Black Move */}
              <div className="col-span-4 flex items-center">
                {pair.black ? (
                  <span
                    onMouseEnter={(e) => handleMouseEnter(e, pair.black!)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => onMoveClick && onMoveClick(pair.black!.flatIndex!)}
                    data-active={pair.black.flatIndex === activeMoveIndex ? "true" : undefined}
                    className={`cursor-pointer flex items-center gap-1.5 hover:bg-slate-800/80 transition-all px-2 py-1 rounded-lg border ${
                      pair.black.flatIndex === activeMoveIndex
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-[0_0_8px_rgba(99,102,241,0.2)] font-semibold'
                        : 'border-transparent text-slate-100 hover:text-white'
                    }`}
                  >
                    <span className="font-mono font-semibold">{pair.black.san}</span>
                    {renderBadge(pair.black.label)}
                  </span>
                ) : (
                  <span className="text-slate-600 font-mono">...</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tooltip positioned container-relative to avoid clipping */}
      {hoveredMove && (() => {
        const isOpponent = !!hoveredMove.opponent_analysis;
        const displayLabel = isOpponent ? hoveredMove.opponent_analysis!.label : hoveredMove.label;
        const displayExplanation = isOpponent ? hoveredMove.opponent_analysis!.explanation : hoveredMove.explanation;
        const threat = isOpponent ? hoveredMove.opponent_analysis!.threat : null;
        const bestResponse = isOpponent ? hoveredMove.opponent_analysis!.best_response : null;

        return (
          <div
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            className="absolute z-50 pointer-events-none w-72 p-3.5 rounded-xl bg-slate-950/95 backdrop-blur-md border border-slate-800 text-slate-100 shadow-2xl text-xs transition-all duration-150 flex flex-col gap-2"
          >
            <div className="font-bold font-mono text-indigo-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span>
                {hoveredMove.moveNumber}{hoveredMove.isWhite ? '.' : '...'} {hoveredMove.san}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border uppercase ${
                displayLabel === 'Brilliant' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                displayLabel === 'Excellent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                displayLabel === 'Good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                displayLabel === 'Inaccuracy' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                displayLabel === 'Mistake' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                displayLabel === 'Blunder' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                {displayLabel}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed font-medium">
              {displayExplanation}
            </p>
            {isOpponent && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-800/80">
                {threat && (
                  <div className="text-amber-400 font-semibold flex items-start gap-1">
                    <span className="shrink-0 text-amber-500">⚠</span>
                    <span>Ancaman: <span className="font-normal text-slate-200">{threat}</span></span>
                  </div>
                )}
                {bestResponse && (
                  <div className="text-emerald-400 font-semibold flex items-start gap-1">
                    <span className="shrink-0 text-emerald-500">💡</span>
                    <span>Respons terbaik: <span className="font-bold font-mono text-slate-100">{bestResponse}</span></span>
                  </div>
                )}
              </div>
            )}
            {/* Triangle arrow pointer */}
            <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-slate-950/95 border-r border-b border-slate-800 rotate-45" />
          </div>
        );
      })()}
    </div>
  );
};

export default MoveList;
