'use client';

import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import Board from '../../components/Board';
import EvalBar from '../../components/EvalBar';
import MoveList, { Move } from '../../components/MoveList';
import { getGames, getGameDetail } from '../../lib/api';
import { GameSummary, GameDetail } from '../../lib/types';

export default function HistoryPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [fens, setFens] = useState<string[]>([]);
  
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch games list on load
  useEffect(() => {
    async function loadGames() {
      try {
        setIsLoadingGames(true);
        const data = await getGames();
        setGames(data);
      } catch (err) {
        console.error('Failed to load games list:', err);
        setErrorMsg('Gagal memuat daftar game. Pastikan server backend Anda berjalan.');
      } finally {
        setIsLoadingGames(false);
      }
    }
    loadGames();
  }, []);

  // Fetch game detail when selectedGameId changes
  useEffect(() => {
    if (!selectedGameId) {
      setGameDetail(null);
      setFens([]);
      setCurrentMoveIndex(-1);
      return;
    }

    async function loadGameDetail() {
      try {
        setIsLoadingDetail(true);
        const detail = await getGameDetail(selectedGameId!);
        setGameDetail(detail);
        
        // Reconstruct FEN history using chess.js
        const chess = new Chess();
        const calculatedFens = [chess.fen()];
        
        for (const m of detail.moves) {
          try {
            // First try SAN, if fails, fallback to UCI
            chess.move(m.san || m.uci);
            calculatedFens.push(chess.fen());
          } catch (e) {
            console.warn(`Failed to play move: ${m.san || m.uci}`, e);
            try {
              if (!m.uci || typeof m.uci !== 'string' || m.uci.length < 4) {
                throw new Error("UCI string is malformed or undefined");
              }
              // Try making move by parsing UCI (from -> to)
              const from = m.uci.slice(0, 2);
              const to = m.uci.slice(2, 4);
              const promotion = m.uci.length > 4 ? m.uci[4] : undefined;
              chess.move({ from, to, promotion });
              calculatedFens.push(chess.fen());
            } catch (err) {
              // Push undefined to indicate failure/gap
              calculatedFens.push(undefined as any);
            }
          }
        }
        
        setFens(calculatedFens);
        // Start replay view at the starting position (-1)
        setCurrentMoveIndex(-1);
      } catch (err) {
        console.error('Failed to load game detail:', err);
        alert('Gagal mengambil detail game.');
      } finally {
        setIsLoadingDetail(false);
      }
    }

    loadGameDetail();
  }, [selectedGameId]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!gameDetail) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        handleLast();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameDetail, currentMoveIndex]);

  const handleFirst = () => setCurrentMoveIndex(-1);
  const handleLast = () => {
    if (gameDetail) {
      setCurrentMoveIndex(gameDetail.moves.length - 1);
    }
  };
  const handlePrev = () => {
    if (currentMoveIndex > -1) {
      setCurrentMoveIndex(currentMoveIndex - 1);
    }
  };
  const handleNext = () => {
    if (gameDetail && currentMoveIndex < gameDetail.moves.length - 1) {
      setCurrentMoveIndex(currentMoveIndex + 1);
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  const getResultBadge = (result: string | null) => {
    if (!result) return <span className="text-slate-400">Aktif</span>;
    if (result === '1-0') {
      return (
        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold font-mono">
          1-0 (Putih Menang)
        </span>
      );
    }
    if (result === '0-1') {
      return (
        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold font-mono">
          0-1 (Hitam Menang)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-700 rounded-lg text-xs font-bold font-mono">
        ½-½ (Remis)
      </span>
    );
  };

  const getCurrentScore = (): number => {
    if (!gameDetail || gameDetail.moves.length === 0) return 0;
    if (currentMoveIndex === -1) {
      return gameDetail.moves[0].score_before ?? 0;
    }
    return gameDetail.moves[currentMoveIndex].score_after ?? 0;
  };

  const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return '0.00';
    const absScore = Math.abs(score);
    if (absScore >= 9000) {
      const moves = score > 0 ? (10000 - score) : Math.abs(-10000 - score);
      return `M${moves}`;
    }
    const pawnScore = score / 100;
    return pawnScore > 0 ? `+${pawnScore.toFixed(2)}` : pawnScore.toFixed(2);
  };

  const renderActiveMoveBadge = (label: string | null) => {
    if (!label) return null;
    const norm = label.toLowerCase();
    let bg = 'bg-slate-800 text-slate-400 border-slate-700';
    let text = label;
    let icon = '';

    if (norm === 'brilliant') {
      bg = 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
      text = 'Brilliant';
      icon = '✨';
    } else if (norm === 'good' || norm === 'excellent') {
      bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      text = norm === 'excellent' ? 'Excellent' : 'Good';
      icon = norm === 'excellent' ? '✓✓' : '✓';
    } else if (norm === 'inaccuracy') {
      bg = 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(234,179,8,0.2)]';
      text = 'Inaccuracy';
      icon = '⚠';
    } else if (norm === 'mistake') {
      bg = 'bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)]';
      text = 'Mistake';
      icon = '✗';
    } else if (norm === 'blunder') {
      bg = 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]';
      text = 'Blunder';
      icon = '✗✗';
    }

    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border font-bold ${bg}`}>
        <span>{text}</span>
        {icon && <span className="text-[10px] ml-0.5">{icon}</span>}
      </span>
    );
  };

  // Prepare moves in MoveList expected format
  const mappedMovesForList: Move[] = gameDetail
    ? gameDetail.moves.map((m) => ({
        moveNumber: m.move_number,
        san: m.san,
        label: m.label || '',
        explanation: m.explanation || '',
        isWhite: m.is_white,
        opponent_analysis: null,
      }))
    : [];

  const activeMove = gameDetail && currentMoveIndex >= 0 ? gameDetail.moves[currentMoveIndex] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-7xl flex flex-col gap-8">
        
        {/* Title */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">Riwayat Permainan</h2>
          <p className="text-slate-400 text-sm mt-1">Review dan replay permainan catur yang telah selesai dianalisis.</p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-5 py-3 rounded-2xl text-sm font-medium shadow-lg">
            ⚠ {errorMsg}
          </div>
        )}

        {/* Table of Saved Games */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-xl">
          {isLoadingGames ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium">Memuat riwayat game...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              Belum ada game. Mulai game pertamamu!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/60 bg-slate-950/40 text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                    <th className="py-4 px-6">Tanggal</th>
                    <th className="py-4 px-6">Putih vs Hitam</th>
                    <th className="py-4 px-6">Hasil</th>
                    <th className="py-4 px-6 text-center">Akurasi Putih</th>
                    <th className="py-4 px-6 text-center">Akurasi Hitam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-sm">
                  {games.map((game) => {
                    const isSelected = selectedGameId === game.game_id;
                    return (
                      <tr
                        key={game.game_id}
                        onClick={() => setSelectedGameId(isSelected ? null : game.game_id)}
                        className={`hover:bg-slate-900/50 cursor-pointer transition duration-150 ${
                          isSelected ? 'bg-indigo-600/10 border-l-2 border-l-indigo-500' : ''
                        }`}
                      >
                        <td className="py-4 px-6 text-slate-300 font-mono text-xs">
                          {formatDate(game.date)}
                        </td>
                        <td className="py-4 px-6 font-semibold text-slate-200">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-950 text-[10px] font-extrabold mr-1.5">W</span>
                          {game.white} 
                          <span className="text-slate-500 mx-2">vs</span> 
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-950 text-slate-100 border border-slate-700 text-[10px] font-extrabold mr-1.5">B</span>
                          {game.black}
                        </td>
                        <td className="py-4 px-6">
                          {getResultBadge(game.result)}
                        </td>
                        <td className="py-4 px-6 text-center font-bold font-mono">
                          {game.white_accuracy !== null ? (
                            <span className={game.white_accuracy >= 80 ? 'text-emerald-400' : game.white_accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'}>
                              {game.white_accuracy.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-4 px-6 text-center font-bold font-mono">
                          {game.black_accuracy !== null ? (
                            <span className={game.black_accuracy >= 80 ? 'text-emerald-400' : game.black_accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'}>
                              {game.black_accuracy.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Game Replay Workspace */}
        {selectedGameId && (
          <div className="border-t border-slate-800/60 pt-8 flex flex-col gap-6">
            
            {isLoadingDetail ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-sm font-semibold">Mengambil detail game...</p>
              </div>
            ) : gameDetail ? (
              <div className="flex flex-col gap-6 animate-fade-in">
                
                {/* Game Info Header Summary */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl">
                  <div className="flex flex-col gap-1.5 text-center md:text-left">
                    <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase">Analisis Review</span>
                    <div className="flex items-center flex-wrap gap-2 text-xl font-extrabold text-slate-100 justify-center md:justify-start">
                      <span>{gameDetail.white}</span>
                      <span className="text-slate-500 text-sm font-medium">vs</span>
                      <span>{gameDetail.black}</span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Partai dimainkan pada: {formatDate(gameDetail.date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 flex-wrap justify-center">
                    {/* Result Card */}
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl px-5 py-3 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Hasil Akhir</span>
                      <div className="mt-1">{getResultBadge(gameDetail.result)}</div>
                    </div>

                    {/* White Accuracy */}
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl px-5 py-3 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Akurasi Putih</span>
                      <span className={`text-xl font-extrabold font-mono mt-1 ${
                        (gameDetail.white_accuracy ?? 0) >= 80 ? 'text-emerald-400' : (gameDetail.white_accuracy ?? 0) >= 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {gameDetail.white_accuracy !== null ? `${gameDetail.white_accuracy.toFixed(1)}%` : '-'}
                      </span>
                    </div>

                    {/* Black Accuracy */}
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl px-5 py-3 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Akurasi Hitam</span>
                      <span className={`text-xl font-extrabold font-mono mt-1 ${
                        (gameDetail.black_accuracy ?? 0) >= 80 ? 'text-emerald-400' : (gameDetail.black_accuracy ?? 0) >= 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {gameDetail.black_accuracy !== null ? `${gameDetail.black_accuracy.toFixed(1)}%` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workspace grid: Board (col 1) & Sidebar (col 2) */}
                <div className="w-full flex flex-col lg:flex-row gap-8 items-start justify-center">
                  
                  {/* Column 1: Board + controls */}
                  <div className="flex flex-col items-center gap-4 w-full max-w-[540px]">
                    
                    {/* Opponent Label Card */}
                    <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-slate-500 border border-slate-400" />
                        <span className="font-semibold text-sm text-slate-200">
                          {gameDetail.black} (Hitam)
                        </span>
                      </div>
                    </div>

                    {/* Board + EvalBar */}
                    <div className="w-full flex items-stretch gap-3">
                      <EvalBar score={getCurrentScore()} />
                      <div className="flex-1 min-w-0 aspect-square">
                        <Board
                          position={(currentMoveIndex + 1 >= 0 && currentMoveIndex + 1 < fens.length && fens[currentMoveIndex + 1]) || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                          playerColor="white"
                          readOnly={true}
                        />
                      </div>
                    </div>

                    {/* Player Label Card */}
                    <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-slate-200 shadow" />
                        <span className="font-semibold text-sm text-slate-200">
                          {gameDetail.white} (Putih)
                        </span>
                      </div>
                    </div>

                    {/* Replay navigation buttons below board */}
                    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-md">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleFirst}
                          disabled={currentMoveIndex === -1}
                          className="px-3.5 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold"
                          title="Kembali ke awal (Home)"
                        >
                          ⏮ First
                        </button>
                        <button
                          onClick={handlePrev}
                          disabled={currentMoveIndex === -1}
                          className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold"
                          title="Langkah sebelumnya (Panah Kiri)"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 min-w-[70px] text-center">
                          {currentMoveIndex + 1} / {gameDetail.moves.length}
                        </span>
                        <button
                          onClick={handleNext}
                          disabled={currentMoveIndex === gameDetail.moves.length - 1}
                          className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold"
                          title="Langkah berikutnya (Panah Kanan)"
                        >
                          Next →
                        </button>
                        <button
                          onClick={handleLast}
                          disabled={currentMoveIndex === gameDetail.moves.length - 1}
                          className="px-3.5 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold"
                          title="Loncat ke akhir (End)"
                        >
                          Last ⏭
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium tracking-tight">
                        Tips: Gunakan tombol keyboard <span className="font-bold border border-slate-800 px-1 py-0.2 rounded bg-slate-950 text-slate-400">←</span> dan <span className="font-bold border border-slate-800 px-1 py-0.2 rounded bg-slate-950 text-slate-400">→</span> untuk navigasi cepat.
                      </p>
                    </div>

                  </div>

                  {/* Column 2: Sidebar (Move Info Card + MoveList) */}
                  <div className="flex-1 w-full lg:max-w-[450px] flex flex-col gap-6">
                    
                    {/* Active Move Detail Explanation Card */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                      
                      {activeMove ? (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evaluasi Langkah</h3>
                              <p className="text-lg font-black font-mono text-indigo-400 mt-0.5">
                                {activeMove.move_number}{activeMove.is_white ? '.' : '...'} {activeMove.san}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              {renderActiveMoveBadge(activeMove.label)}
                              <span className="text-[10px] font-mono font-extrabold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                                Eval: {formatScore(activeMove.score_after)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Penjelasan</p>
                            <p className="text-sm text-slate-200 leading-relaxed font-medium">
                              {activeMove.explanation || 'Langkah ini tidak memiliki penjelasan tambahan dari engine.'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-1.5 pt-3 border-t border-slate-800/80">
                            <div className="bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/50">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Eval Sebelum</span>
                              <span className="block text-sm font-extrabold text-slate-300 font-mono mt-0.5">
                                {formatScore(activeMove.score_before)}
                              </span>
                            </div>
                            <div className="bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/50">
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Perubahan Eval</span>
                              <span className={`block text-sm font-extrabold font-mono mt-0.5 ${
                                activeMove.score_after !== null && activeMove.score_before !== null
                                  ? (activeMove.is_white
                                      ? (activeMove.score_after - activeMove.score_before >= 0 ? 'text-emerald-400' : 'text-rose-400')
                                      : (activeMove.score_before - activeMove.score_after >= 0 ? 'text-emerald-400' : 'text-rose-400'))
                                  : 'text-slate-400'
                              }`}>
                                {activeMove.score_after !== null && activeMove.score_before !== null
                                  ? (activeMove.is_white
                                      ? (activeMove.score_after - activeMove.score_before >= 0 ? '+' : '') + ((activeMove.score_after - activeMove.score_before)/100).toFixed(2)
                                      : (activeMove.score_before - activeMove.score_after >= 0 ? '+' : '') + ((activeMove.score_before - activeMove.score_after)/100).toFixed(2))
                                  : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-6 text-center flex flex-col items-center gap-2">
                          <span className="text-3xl text-slate-600">♟</span>
                          <div>
                            <h3 className="font-bold text-slate-300">Posisi Awal Game</h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                              Replay game dengan menekan tombol navigasi di bawah papan atau klik langsung salah satu langkah di Move List.
                            </p>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Interactive MoveList */}
                    <MoveList
                      moves={mappedMovesForList}
                      activeMoveIndex={currentMoveIndex}
                      onMoveClick={(idx) => setCurrentMoveIndex(idx)}
                    />

                  </div>

                </div>

              </div>
            ) : null}

          </div>
        )}

      </div>
    </div>
  );
}
