'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Board, { BoardRef } from '../components/Board';
import EvalBar from '../components/EvalBar';
import MoveList, { Move } from '../components/MoveList';
import RecommendPanel from '../components/RecommendPanel';
import { startGame, sendMove } from '../lib/api';
import { Recommendation, Game } from '../lib/types';
import { Chess } from 'chess.js';

const queryClient = new QueryClient();

function ChessAnalyzerApp() {
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [showColorModal, setShowColorModal] = useState(false);
  const boardRef = useRef<BoardRef>(null);
  const [lastMoveEvaluation, setLastMoveEvaluation] = useState<{
    san: string;
    label: string;
    explanation: string;
  } | null>(null);
  const [activeThreat, setActiveThreat] = useState<{
    threat: string;
    bestResponse: string;
  } | null>(null);
  
  // Game mode: 'bot' (random move opponent) or 'analysis' (freely move both sides)
  const [gameMode, setGameMode] = useState<'bot' | 'analysis'>('bot');
  
  // Core state for board synced from Board.tsx
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [moves, setMoves] = useState<Move[]>([]);
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendLoading, setIsRecommendLoading] = useState<boolean>(false);
  const [highlightSquares, setHighlightSquares] = useState<string[]>([]);
  const recommendationsFenRef = useRef<string | null>(null);
  
  // Game instance for status check (check, checkmate, draw, turn)
  const [localGame, setLocalGame] = useState(() => new Chess());

  // Keep localGame in sync with current FEN
  useEffect(() => {
    try {
      setLocalGame(new Chess(currentFen));
    } catch (e) {
      console.error('Failed to sync local game FEN:', e);
    }
  }, [currentFen]);

  // Handle local bot move response when it's the bot's turn
  useEffect(() => {
    if (!activeGame || gameMode !== 'bot') return;

    const currentTurn = localGame.turn() === 'w' ? 'white' : 'black';
    if (currentTurn !== playerColor && !localGame.isGameOver()) {
      const timer = setTimeout(() => {
        const moves = localGame.moves({ verbose: true });
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          const uci = randomMove.from + randomMove.to + (randomMove.promotion || '');
          
          if (boardRef.current) {
            boardRef.current.sendMove({
              from: randomMove.from,
              to: randomMove.to,
              promotion: randomMove.promotion,
              uci: uci
            });
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentFen, playerColor, activeGame, gameMode, localGame]);

  // Monitor currentFen to manage loading state and board highlights
  useEffect(() => {
    if (!activeGame) return;
    
    try {
      const tempChess = new Chess(currentFen);
      const nextTurn = tempChess.turn() === 'w' ? 'white' : 'black';
      const isNextPlayerTurn = nextTurn === playerColor;
      
      if (isNextPlayerTurn) {
        if (recommendationsFenRef.current !== currentFen) {
          setIsRecommendLoading(true);
          setHighlightSquares([]);
          setRecommendations([]);
        }
      } else {
        setIsRecommendLoading(false);
        setRecommendations([]);
        setHighlightSquares([]);
      }
    } catch (e) {
      console.error('Error in FEN monitoring effect:', e);
    }
  }, [currentFen, playerColor, activeGame]);

  const handleStartNewGame = async (color: 'white' | 'black') => {
    try {
      const gameData = await startGame(color);
      setShowColorModal(false);
      setActiveGame(gameData);
      setPlayerColor(color);
      setCurrentFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      setMoves([]);
      setLocalGame(new Chess());
      setLastMoveEvaluation(null);
      setActiveThreat(null);
      setCurrentScore(0);
      setRecommendations([]);
      setHighlightSquares([]);
      setIsRecommendLoading(color === 'white');
      recommendationsFenRef.current = null;
    } catch (error) {
      console.error('Failed to start game:', error);
      // Optionally show an error message to the user
      alert('Gagal memulai permainan. Pastikan backend aktif.');
    }
  };

  const handleMoveResult = (result: {
    san: string | null;
    label: string | null;
    score_before: number | null;
    score_after: number | null;
    explanation: string | null;
    current_fen: string;
    recommendations?: Recommendation[];
    opponent_analysis?: any;
  }) => {
    setCurrentFen(result.current_fen);
    if (result.score_after !== null && result.score_after !== undefined) {
      setCurrentScore(result.score_after);
    }

    if (result.recommendations !== undefined) {
      setRecommendations(result.recommendations);
      setIsRecommendLoading(false);
      recommendationsFenRef.current = result.current_fen;
    }

    // Set or clear the active threat warning banner
    if (result.opponent_analysis && result.opponent_analysis.threat) {
      setActiveThreat({
        threat: result.opponent_analysis.threat,
        bestResponse: result.opponent_analysis.best_response,
      });
    } else {
      setActiveThreat(null);
    }

    if (result.san) {
      setLastMoveEvaluation({
        san: result.san,
        label: result.label || '',
        explanation: result.explanation || '',
      });

      setMoves((prev) => {
        const nextMoveIndex = prev.length;
        const isWhite = nextMoveIndex % 2 === 0;
        const moveNumber = Math.floor(nextMoveIndex / 2) + 1;
        
        const newMove: Move = {
          moveNumber,
          san: result.san!,
          label: result.label || '',
          explanation: result.explanation || '',
          isWhite,
          opponent_analysis: result.opponent_analysis,
        };
        
        return [...prev, newMove];
      });
    }
  };

  const handleHighlight = (uci: string | null) => {
    if (!uci) {
      setHighlightSquares([]);
    } else {
      const dest = uci.slice(2, 4);
      setHighlightSquares([dest]);
    }
  };

  // Get status label
  const getGameStatusLabel = () => {
    if (localGame.isCheckmate()) return 'Checkmate!';
    if (localGame.isDraw()) return 'Draw / Remis';
    if (localGame.isCheck()) return 'Check / Skak!';
    return localGame.turn() === 'w' ? "White's Turn" : "Black's Turn";
  };

  const isPlayerTurn = activeGame ? (localGame.turn() === playerColor[0]) : false;

  // Active Board Workspace Layout: 3 Columns
  // Column 1: EvalBar
  // Column 2: Board (with Opponent and Player cards)
  // Column 3: MoveList & Sidebar panels
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center">
      {/* Navbar / Header */}
      <header className="w-full border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-6 py-4 flex justify-between items-center max-w-7xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/20">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Chezzy Chess Analyzer
          </h1>
        </div>

        {activeGame && (
          <button
            onClick={() => setShowColorModal(true)}
            className="px-4 py-2 text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition rounded-xl border border-slate-700 hover:border-slate-600 active:scale-95 duration-150"
          >
            Mulai Baru
          </button>
        )}
      </header>

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-7xl px-4 py-8 flex items-center justify-center">
        {!activeGame ? (
          /* Landing Page */
          <div className="text-center max-w-2xl px-6 py-16 bg-slate-900/40 rounded-3xl border border-slate-800/80 backdrop-blur-2xl shadow-2xl flex flex-col items-center gap-6 mt-8 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 font-black text-4xl mb-2 shadow-2xl">
              ♞
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100">
              Analisis Catur dengan Heuristik Stockfish
            </h2>
            <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
              Tingkatkan taktik dan strategi catur Anda secara real-time. Dapatkan penjelasan rinci beserta analisis risiko untuk setiap langkah terbaik yang disarankan oleh Stockfish.
            </p>
            <button
              onClick={() => setShowColorModal(true)}
              className="mt-4 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-slate-100 font-bold rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 duration-150"
            >
              New Game
            </button>
          </div>
        ) : (
          /* Active Board Workspace (Responsive 3-Column Layout) */
          <div className="w-full flex flex-col gap-6 items-center">
            {activeThreat && (
              <div className="w-full max-w-5xl bg-amber-500/10 border border-amber-500/30 text-amber-200 px-5 py-3 rounded-2xl flex items-center gap-3 shadow-lg shadow-amber-500/5 animate-fade-in">
                <span className="text-xl">⚠</span>
                <div className="flex-1 text-sm font-medium">
                  Lawan mengancam <span className="font-semibold text-amber-100">{activeThreat.threat}</span> &mdash;{" "}
                  Respons terbaik: <span className="font-bold font-mono text-emerald-400 bg-slate-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">{activeThreat.bestResponse}</span>
                </div>
              </div>
            )}
            <div className="w-full flex flex-col lg:flex-row gap-8 items-start justify-center">
            
            {/* Column 1 & 2: Chessboard and EvalBar Column */}
            <div className="flex flex-col items-center gap-4 w-full max-w-[540px]">
              {/* Opponent Card */}
              <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${playerColor === 'white' ? 'bg-slate-500 border border-slate-400' : 'bg-slate-200 shadow'}`} />
                  <span className="font-semibold text-sm text-slate-200">
                    {gameMode === 'bot' ? 'Opponent (Bot)' : 'Analysis Opponent'}
                  </span>
                </div>
                {!isPlayerTurn && !localGame.isGameOver() && (
                  <span className="text-xs px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                    Melangkah...
                  </span>
                )}
              </div>

              {/* Board Area with EvalBar (visible next to Board, stretched to match its height) */}
              <div className="w-full flex items-stretch gap-3">
                <EvalBar score={currentScore} />
                <div className="flex-1 min-w-0 aspect-square">
                  <Board
                    position={currentFen}
                    playerColor={playerColor}
                    sessionId={activeGame?.id}
                    onMoveResult={handleMoveResult}
                    highlightSquares={highlightSquares}
                    gameMode={gameMode}
                    ref={boardRef}
                  />
                </div>
              </div>

              {/* Player Card */}
              <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${playerColor === 'white' ? 'bg-slate-200 shadow' : 'bg-slate-500 border border-slate-400'}`} />
                  <span className="font-semibold text-sm text-slate-200">You</span>
                </div>
                {isPlayerTurn && !localGame.isGameOver() && (
                  <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse">
                    Giliran Anda
                  </span>
                )}
              </div>
            </div>

            {/* Column 3: Sidebar Analysis & MoveList Column */}
            <div className="flex-1 w-full lg:max-w-[450px] flex flex-col gap-6">
              
              {/* Game Status & Controls Panel */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Permainan</h3>
                    <p className="text-lg font-bold text-slate-100 mt-1">{getGameStatusLabel()}</p>
                  </div>

                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => setGameMode('bot')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${gameMode === 'bot' ? 'bg-indigo-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      VS Bot
                    </button>
                    <button
                      onClick={() => setGameMode('analysis')}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition ${gameMode === 'analysis' ? 'bg-indigo-600 text-slate-100 shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Solo Analisis
                    </button>
                  </div>
                </div>

                {/* Last Move Evaluation */}
                {lastMoveEvaluation && (
                  <div className="border-b border-slate-800 pb-3 flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Langkah Terakhir:</span>
                      <span className="text-sm font-bold font-mono text-indigo-400">
                        {lastMoveEvaluation.san}
                      </span>
                      <span className="text-slate-500">—</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        lastMoveEvaluation.label === 'Brilliant' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        lastMoveEvaluation.label === 'Excellent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        lastMoveEvaluation.label === 'Good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        lastMoveEvaluation.label === 'Inaccuracy' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        lastMoveEvaluation.label === 'Mistake' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        lastMoveEvaluation.label === 'Blunder' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {lastMoveEvaluation.label} {
                          lastMoveEvaluation.label === 'Brilliant' || lastMoveEvaluation.label === 'Excellent' || lastMoveEvaluation.label === 'Good' ? '✓' : '✗'
                        }
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {lastMoveEvaluation.explanation}
                    </p>
                  </div>
                )}
              </div>

              {/* MoveList Panel (New component) */}
              <MoveList moves={moves} />

              {/* Recommendation Panel */}
              <RecommendPanel
                recommendations={recommendations}
                onHighlight={handleHighlight}
                isMyTurn={isPlayerTurn}
                isLoading={isRecommendLoading}
              />
            </div>
          </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900/50 py-4 text-center text-xs text-slate-600 max-w-7xl">
        Chezzy Analyzer v1.0.0 &copy; 2026. Powered by Stockfish engine.
      </footer>

      {/* Color Selection Modal */}
      {showColorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-center text-slate-200">Pilih Warna Anda</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleStartNewGame('white')}
                className="flex flex-col items-center gap-3 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100"
              >
                <span className="text-4xl group-hover:scale-110 transition duration-150">♔</span>
                <span className="text-sm font-semibold text-slate-200">Putih (White)</span>
              </button>

              <button
                onClick={() => handleStartNewGame('black')}
                className="flex flex-col items-center gap-3 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100"
              >
                <span className="text-4xl text-slate-400 group-hover:scale-110 transition duration-150">♚</span>
                <span className="text-sm font-semibold text-slate-200">Hitam (Black)</span>
              </button>
            </div>

            <button
              onClick={() => setShowColorModal(false)}
              className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 rounded-xl text-center border border-slate-800"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <ChessAnalyzerApp />
    </QueryClientProvider>
  );
}
