'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import Board from '../../components/Board';
import EvalBar from '../../components/EvalBar';
import MoveList, { Move } from '../../components/MoveList';
import { getGames, getGameDetail } from '../../lib/api';
import { GameSummary, GameDetail } from '../../lib/types';
import { Sparkles, Check, CheckCheck, AlertTriangle, X, Skull, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Info } from 'lucide-react';

export default function HistoryPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null);
  const [fens, setFens] = useState<string[]>([]);
  
  const [isLoadingGames, setIsLoadingGames] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  // ResizeObserver to dynamically measure parent width and set board width
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;
    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      // Calculate size that fits both height and width, leaving margin
      const size = Math.max(150, Math.min(rect.width - 24, rect.height || 400));
      setBoardSize(size);
    };
    handleResize();
    const observer = new ResizeObserver(() => { handleResize(); });
    observer.observe(container);
    return () => { observer.disconnect(); };
  }, [gameDetail]);

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

  const getResultBadge = (result: string | null, compact = false) => {
    if (!result) return <span className="text-slate-500 text-[10px]">Aktif</span>;
    if (result === '1-0') {
      return (
        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold font-mono">
          {compact ? '1-0' : '1-0 (Putih Menang)'}
        </span>
      );
    }
    if (result === '0-1') {
      return (
        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-bold font-mono">
          {compact ? '0-1' : '0-1 (Hitam Menang)'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-700 rounded-lg text-xs font-bold font-mono">
        {compact ? '½-½' : '½-½ (Remis)'}
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
    let icon: React.ReactNode = null;

    if (norm === 'brilliant') {
      bg = 'bg-purple-500/15 text-purple-400 border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.2)]';
      text = 'Brilliant';
      icon = <Sparkles className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'excellent') {
      bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      text = 'Excellent';
      icon = <CheckCheck className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'good') {
      bg = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
      text = 'Good';
      icon = <Check className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'inaccuracy') {
      bg = 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(234,179,8,0.2)]';
      text = 'Inaccuracy';
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'mistake') {
      bg = 'bg-orange-500/15 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)]';
      text = 'Mistake';
      icon = <X className="w-3.5 h-3.5 shrink-0" />;
    } else if (norm === 'blunder') {
      bg = 'bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]';
      text = 'Blunder';
      icon = <Skull className="w-3.5 h-3.5 shrink-0" />;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-bold ${bg}`}>
        <span>{text}</span>
        {icon}
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
    <div className="h-[calc(100vh-70px)] md:h-[calc(100vh-73px)] w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center overflow-hidden">
      <div className="w-full max-w-7xl flex-1 flex flex-col min-h-0 p-4 md:p-6 gap-4 animate-fade-in">
        
        {/* Title / Header Bar */}
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-100 flex items-center gap-2">
              <span>Riwayat Permainan</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                {games.length} Games
              </span>
            </h2>
            <p className="text-slate-400 text-xs mt-0.5 hidden sm:block">
              Review dan replay permainan catur yang telah selesai dianalisis.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Split Container */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 w-full overflow-hidden">
          
          {/* Left Column: Sidebar with Game List */}
          <div className={`w-full lg:w-[320px] xl:w-[360px] flex flex-col bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 shrink-0 min-h-0 ${selectedGameId ? 'hidden lg:flex' : 'flex'}`}>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 shrink-0">
              Daftar Permainan
            </h3>
            
            {isLoadingGames ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-xs font-medium">Memuat...</p>
              </div>
            ) : games.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-6 text-slate-500 text-xs leading-relaxed">
                Belum ada game catur yang tersimpan. Mulailah bermain game baru!
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin">
                {games.map((game) => {
                  const isSelected = selectedGameId === game.game_id;
                  return (
                    <div
                      key={game.game_id}
                      onClick={() => setSelectedGameId(isSelected ? null : game.game_id)}
                      className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 relative overflow-hidden ${
                        isSelected
                          ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.12)]'
                          : 'bg-slate-950/20 border-slate-800/80 hover:bg-slate-900/30 hover:border-slate-700/60'
                      }`}
                    >
                      {/* Selected Indicator Light */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                      )}
                      
                      {/* Card Header: Date & Result */}
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                        <span>{formatDate(game.date)}</span>
                        <div>{getResultBadge(game.result, true)}</div>
                      </div>

                      {/* Card Body: Matchup */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center text-xs font-semibold text-slate-300">
                          <span className="inline-block w-4 h-4 text-center leading-4 rounded bg-slate-105 text-slate-950 font-extrabold text-[9px] mr-1.5 shrink-0">W</span>
                          <span className="truncate max-w-[150px]">{game.white}</span>
                          {game.white_accuracy !== null && (
                            <span className={`ml-auto font-mono font-bold text-[10px] ${
                              game.white_accuracy >= 80 ? 'text-emerald-400' : game.white_accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {game.white_accuracy.toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs font-semibold text-slate-300">
                          <span className="inline-block w-4 h-4 text-center leading-4 rounded bg-slate-950 text-slate-100 border border-slate-800 font-extrabold text-[9px] mr-1.5 shrink-0">B</span>
                          <span className="truncate max-w-[150px]">{game.black}</span>
                          {game.black_accuracy !== null && (
                            <span className={`ml-auto font-mono font-bold text-[10px] ${
                              game.black_accuracy >= 80 ? 'text-emerald-400' : game.black_accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {game.black_accuracy.toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Main Analysis Workspace */}
          <div className={`flex-1 bg-slate-900/10 border border-slate-800/80 rounded-2xl min-h-0 overflow-hidden flex flex-col relative ${selectedGameId ? 'flex' : 'hidden lg:flex'}`}>
            {!selectedGameId ? (
              /* Empty State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 shadow-lg shadow-indigo-500/5 animate-pulse">
                  <Info className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-200">Pilih Game untuk Dianalisis</h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">
                    Silakan pilih salah satu partai game dari daftar di sebelah kiri untuk mereview langkah, melihat akurasi permainan, evaluasi dari engine Stockfish, dan rincian kesalahan.
                  </p>
                </div>
              </div>
            ) : isLoadingDetail ? (
              /* Loading Detail State */
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-slate-400">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                <p className="text-xs font-semibold">Mengambil detail permainan...</p>
              </div>
            ) : gameDetail ? (
              /* Replay Workspace Content */
              <div className="flex-1 flex flex-col min-h-0 p-4 md:p-5 gap-4 overflow-y-auto lg:overflow-hidden">
                
                {/* Game Info Header Summary */}
                <div className="bg-slate-900/45 border border-slate-800/85 rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                  <div className="flex flex-col gap-1 text-center sm:text-left">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedGameId(null)}
                        className="lg:hidden px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 font-semibold flex items-center gap-1 mr-1.5"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> List
                      </button>
                      <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">Analisis Review</span>
                    </div>
                    <div className="flex items-center gap-2 text-base font-extrabold text-slate-100 justify-center sm:justify-start">
                      <span>{gameDetail.white}</span>
                      <span className="text-slate-500 text-xs font-medium">vs</span>
                      <span>{gameDetail.black}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Partai dimainkan pada: {formatDate(gameDetail.date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
                    {/* Result Card */}
                    <div className="bg-slate-950/30 border border-slate-850 rounded-xl px-3 py-1.5 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Hasil</span>
                      <div className="mt-0.5">{getResultBadge(gameDetail.result)}</div>
                    </div>

                    {/* White Accuracy */}
                    <div className="bg-slate-950/30 border border-slate-850 rounded-xl px-3 py-1.5 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Akurasi W</span>
                      <span className={`text-sm font-extrabold font-serif mt-0.5 ${
                        (gameDetail.white_accuracy ?? 0) >= 80 ? 'text-emerald-400' : (gameDetail.white_accuracy ?? 0) >= 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {gameDetail.white_accuracy !== null ? `${gameDetail.white_accuracy.toFixed(1)}%` : '-'}
                      </span>
                    </div>

                    {/* Black Accuracy */}
                    <div className="bg-slate-950/30 border border-slate-850 rounded-xl px-3 py-1.5 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Akurasi B</span>
                      <span className={`text-sm font-extrabold font-serif mt-0.5 ${
                        (gameDetail.black_accuracy ?? 0) >= 80 ? 'text-emerald-400' : (gameDetail.black_accuracy ?? 0) >= 60 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {gameDetail.black_accuracy !== null ? `${gameDetail.black_accuracy.toFixed(1)}%` : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-Workspace grid: Board (col 1) & Sidebar (col 2) */}
                <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0 items-stretch justify-center overflow-hidden">
                  
                  {/* Column 1: Board + controls */}
                  <div className="flex flex-col items-center gap-3 w-full lg:w-[480px] xl:w-[500px] shrink-0 justify-between min-h-0">
                    
                    {/* Opponent Label Card */}
                    <div className="w-full bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-1.5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-500 border border-slate-400" />
                        <span className="font-semibold text-xs text-slate-200">
                          {gameDetail.black} (Hitam)
                        </span>
                      </div>
                    </div>

                    {/* Board + EvalBar container */}
                    <div ref={boardContainerRef} className="flex-1 w-full min-h-0 flex items-center justify-center gap-3">
                      <div style={{ height: boardSize }} className="flex items-stretch gap-3 justify-center">
                        <EvalBar score={getCurrentScore()} />
                        <Board
                          boardWidth={boardSize}
                          position={(currentMoveIndex + 1 >= 0 && currentMoveIndex + 1 < fens.length && fens[currentMoveIndex + 1]) || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                          playerColor="white"
                          readOnly={true}
                        />
                      </div>
                    </div>

                    {/* Player Label Card */}
                    <div className="w-full bg-slate-900/40 border border-slate-800/60 rounded-xl px-4 py-1.5 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-slate-250 shadow" />
                        <span className="font-semibold text-xs text-slate-200">
                          {gameDetail.white} (Putih)
                        </span>
                      </div>
                    </div>

                    {/* Replay navigation buttons below board */}
                    <div className="w-full bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 flex flex-col items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        <button
                          onClick={handleFirst}
                          disabled={currentMoveIndex === -1}
                          className="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700/80 text-slate-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold flex items-center gap-1 shrink-0"
                          title="Kembali ke awal (Home)"
                        >
                          <ChevronsLeft className="w-3.5 h-3.5" /> First
                        </button>
                        <button
                          onClick={handlePrev}
                          disabled={currentMoveIndex === -1}
                          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-slate-950 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:text-slate-500 active:scale-95 font-bold flex items-center gap-1 shrink-0"
                          title="Langkah sebelumnya (Panah Kiri)"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800 min-w-[65px] text-center">
                          {currentMoveIndex + 1} / {gameDetail.moves.length}
                        </span>
                        <button
                          onClick={handleNext}
                          disabled={currentMoveIndex === gameDetail.moves.length - 1}
                          className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-slate-950 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed disabled:text-slate-500 active:scale-95 font-bold flex items-center gap-1 shrink-0"
                          title="Langkah berikutnya (Panah Kanan)"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleLast}
                          disabled={currentMoveIndex === gameDetail.moves.length - 1}
                          className="px-2.5 py-1.5 text-xs bg-slate-800 border border-slate-700 hover:bg-slate-700/80 text-slate-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 font-bold flex items-center gap-1 shrink-0"
                          title="Loncat ke akhir (End)"
                        >
                          Last <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium hidden sm:block">
                        Tips: Gunakan tombol keyboard <span className="font-bold border border-slate-800 px-1 py-0.2 rounded bg-slate-950 text-slate-400">←</span> dan <span className="font-bold border border-slate-800 px-1 py-0.2 rounded bg-slate-950 text-slate-400">→</span> untuk navigasi cepat.
                      </p>
                    </div>

                  </div>

                  {/* Column 2: Sidebar (Move Info Card + MoveList) */}
                  <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden min-h-0">
                    
                    {/* Active Move Detail Explanation Card */}
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-3 shrink-0">
                      {activeMove ? (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                            <div>
                              <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Evaluasi Langkah</h3>
                              <p className="text-base font-bold font-serif text-indigo-400 mt-0.5">
                                {activeMove.move_number}{activeMove.is_white ? '.' : '...'} {activeMove.san}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {renderActiveMoveBadge(activeMove.label)}
                              <span className="text-[9px] font-serif font-extrabold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                                Eval: {formatScore(activeMove.score_after)}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Penjelasan</p>
                            <p className="text-xs text-slate-200 leading-relaxed font-medium max-h-[72px] overflow-y-auto pr-1 scrollbar-thin">
                              {activeMove.explanation || 'Langkah ini tidak memiliki penjelasan tambahan dari engine.'}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/60">
                            <div className="bg-slate-950/30 rounded-lg p-2 border border-slate-800/40">
                              <span className="text-[8px] font-bold text-slate-500 uppercase">Eval Sebelum</span>
                              <span className="block text-xs font-extrabold text-slate-300 font-serif mt-0.5">
                                {formatScore(activeMove.score_before)}
                              </span>
                            </div>
                            <div className="bg-slate-950/30 rounded-lg p-2 border border-slate-800/40">
                              <span className="text-[8px] font-bold text-slate-500 uppercase">Perubahan Eval</span>
                              <span className={`block text-xs font-extrabold font-serif mt-0.5 ${
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
                        <div className="py-4 text-center flex flex-col items-center gap-1.5">
                          <Info className="w-6 h-6 text-slate-600 shrink-0" />
                          <div>
                            <h3 className="text-xs font-bold text-slate-300">Posisi Awal Game</h3>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[240px] leading-normal">
                              Replay game dengan menekan tombol navigasi di bawah papan atau klik langsung salah satu langkah di Move List.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Interactive MoveList Wrapper */}
                    <div className="flex-1 min-h-0 bg-slate-900/30 border border-slate-800/80 rounded-xl overflow-hidden flex flex-col">
                      <MoveList
                        moves={mappedMovesForList}
                        activeMoveIndex={currentMoveIndex}
                        onMoveClick={(idx) => setCurrentMoveIndex(idx)}
                        noWrapper={true}
                      />
                    </div>

                  </div>

                </div>

              </div>
            ) : null}
          </div>

        </div>

      </div>
    </div>
  );
}
