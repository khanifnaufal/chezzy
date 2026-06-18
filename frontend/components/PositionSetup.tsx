'use client';

import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

interface PositionSetupProps {
  onLoadPosition: (fen: string) => void;
  onBack: () => void;
}

export default function PositionSetup({ onLoadPosition, onBack }: PositionSetupProps) {
  const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  const [fenInput, setFenInput] = useState(defaultFen);
  const [previewFen, setPreviewFen] = useState(defaultFen);
  const [error, setError] = useState<string | null>(null);

  const validateAndSetFen = (value: string) => {
    setFenInput(value);
    
    const cleanFen = value.trim().replace(/\s+/g, ' ');
    if (!cleanFen) {
      setError('String FEN tidak boleh kosong.');
      return;
    }

    try {
      // Chess constructor throws error if FEN format is invalid in chess.js v1+
      const tempChess = new Chess(cleanFen);
      
      // If we reach here, it is valid
      setError(null);
      setPreviewFen(cleanFen);
    } catch (e: any) {
      setError(e.message || 'Format FEN tidak valid.');
    }
  };

  const handleReset = () => {
    setFenInput(defaultFen);
    setPreviewFen(defaultFen);
    setError(null);
  };

  const handleLoad = () => {
    const clean = fenInput.trim().replace(/\s+/g, ' ');
    if (error || !clean) return;
    onLoadPosition(clean);
  };

  const getActiveTurnText = (): string => {
    try {
      const chess = new Chess(previewFen);
      return chess.turn() === 'w' ? 'Putih' : 'Hitam';
    } catch (e) {
      return 'Putih';
    }
  };

  const getOrientation = (): 'white' | 'black' => {
    try {
      const chess = new Chess(previewFen);
      return chess.turn() === 'w' ? 'white' : 'black';
    } catch (e) {
      return 'white';
    }
  };

  return (
    <div className="flex flex-col gap-5 text-left animate-fade-in w-full max-w-sm sm:max-w-md">
      <h3 className="text-xl font-black text-center text-slate-100 bg-gradient-to-r from-indigo-400 to-violet-300 bg-clip-text text-transparent">
        Setup Posisi Manual
      </h3>
      <p className="text-xs text-slate-400 text-center -mt-3">
        Masukkan string FEN untuk menganalisis posisi kustom
      </p>

      {/* Input Field */}
      <div className="flex flex-col gap-1.5 relative">
        <div className="flex justify-between items-center">
          <label htmlFor="fen-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            FEN String
          </label>
          <div className="relative group cursor-help">
            <span className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-md font-bold">
              ❔ Apa itu FEN?
            </span>
            {/* Tooltip Card */}
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950/95 border border-indigo-500/30 rounded-2xl p-4 flex flex-col gap-1.5 text-xs text-indigo-200/90 leading-relaxed shadow-2xl z-50 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 transform origin-top-right backdrop-blur-md">
              <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                <span>💡</span> Apa itu FEN?
              </div>
              <p>
                <strong>FEN (Forsyth-Edwards Notation)</strong> adalah kode teks standar yang menggambarkan susunan perwira di atas papan catur secara lengkap.
              </p>
              <p className="opacity-90">
                Anda bisa mendapatkan kode ini dengan menyalin (<strong>Copy FEN</strong>) dari menu <strong>Share / Export</strong> di platform seperti <strong>Lichess</strong> atau <strong>Chess.com</strong>.
              </p>
            </div>
          </div>
        </div>
        <textarea
          id="fen-input"
          value={fenInput}
          onChange={(e) => validateAndSetFen(e.target.value)}
          placeholder="Paste FEN di sini (e.g. rnbqkbnr/pppppppp/...)"
          rows={3}
          className={`w-full px-4 py-3 bg-slate-950/80 border text-slate-100 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 transition duration-200 resize-none ${
            error
              ? 'border-rose-500/70 focus:ring-rose-500/40'
              : 'border-slate-800 focus:border-indigo-500/70 focus:ring-indigo-500/30'
          }`}
        />
        {error && (
          <span className="text-[11px] text-rose-400 font-medium bg-rose-500/10 px-3 py-1.5 rounded-xl border border-rose-500/20 animate-fade-in">
            ⚠️ {error}
          </span>
        )}
      </div>

      {/* Small Preview Board */}
      <div className="flex flex-col items-center gap-2 bg-slate-950/45 p-4 rounded-3xl border border-slate-800/60">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Preview Posisi
        </span>
        
        <div className="w-[180px] sm:w-[200px] aspect-square rounded-xl overflow-hidden border border-slate-700/40 shadow-lg">
          <Chessboard
            position={previewFen}
            boardOrientation={getOrientation()}
            arePiecesDraggable={false}
            customDarkSquareStyle={{ backgroundColor: '#244b37' }} // Match Board.tsx felt green
            customLightSquareStyle={{ backgroundColor: '#eae2d3' }} // Match Board.tsx warm ivory/gading
            customBoardStyle={{ borderRadius: '8px' }}
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-slate-400">Giliran Melangkah:</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
            getActiveTurnText() === 'Putih' 
              ? 'bg-slate-100 text-slate-950 border border-slate-300' 
              : 'bg-slate-800 text-slate-200 border border-slate-700'
          }`}>
            {getActiveTurnText()}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            id="btn-fen-reset"
            onClick={handleReset}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 font-bold text-xs rounded-2xl border border-slate-700 hover:border-slate-600 transition active:scale-95 duration-100"
          >
            ↺ Reset Posisi
          </button>
          
          <button
            id="btn-fen-load"
            onClick={handleLoad}
            disabled={!!error || !fenInput.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-indigo-950 disabled:to-violet-950 text-slate-100 disabled:text-slate-500 font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 disabled:shadow-none transition active:scale-95 duration-100 disabled:cursor-not-allowed border border-indigo-500/20 disabled:border-none"
          >
            ✓ Load Posisi
          </button>
        </div>

        <button
          id="btn-fen-back"
          onClick={onBack}
          className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-850 rounded-xl text-center border border-slate-800/80 transition duration-100"
        >
          Kembali
        </button>
      </div>
    </div>
  );
}
