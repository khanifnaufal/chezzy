'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Board, { BoardRef } from '../../components/Board';
import EvalBar from '../../components/EvalBar';
import MoveList, { Move } from '../../components/MoveList';
import RecommendPanel from '../../components/RecommendPanel';
import PositionSetup from '../../components/PositionSetup';
import HintPanel from '../../components/HintPanel';
import BlunderPracticeSetup, { BlunderPosition } from '../../components/BlunderPracticeSetup';
import { startGame, resignGame } from '../../lib/api';
import { Recommendation, Game, GameOverEvent } from '../../lib/types';
import { Chess } from 'chess.js';
import Image from 'next/image';

const queryClient = new QueryClient();

// ─── Accuracy Badge ───────────────────────────────────────────────────────────
function AccuracyBadge({ value, label }: { value: number; label: string }) {
  const color =
    value >= 90 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
    value >= 75 ? 'text-sky-400 border-sky-500/30 bg-sky-500/10' :
    value >= 60 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' :
                  'text-rose-400 border-rose-500/30 bg-rose-500/10';

  return (
    <div className={`flex flex-col items-center gap-1 px-5 py-3 rounded-2xl border ${color}`}>
      <span className="text-2xl font-serif font-black tabular-nums">{value.toFixed(1)}%</span>
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}

// ─── Game Over Modal ──────────────────────────────────────────────────────────
function GameOverModal({
  event,
  playerColor,
  onNewGame,
}: {
  event: GameOverEvent;
  playerColor: 'white' | 'black';
  onNewGame: () => void;
}) {
  const resultMap: Record<string, string> = {
    '1-0': 'White Wins',
    '0-1': 'Black Wins',
    '1/2-1/2': 'Draw',
  };

  const reasonMap: Record<string, string> = {
    checkmate: 'Checkmate',
    draw: 'Draw',
    resign: 'Resignation',
    stalemate: 'Stalemate',
  };

  const resultLabel = resultMap[event.result] ?? event.result;
  const reasonLabel = reasonMap[event.reason] ?? event.reason;

  const playerWon =
    (playerColor === 'white' && event.result === '1-0') ||
    (playerColor === 'black' && event.result === '0-1');
  const isDraw = event.result === '1/2-1/2';

  const emoji = playerWon ? '🏆' : isDraw ? '🤝' : '🫡';
  const headlineColor = playerWon
    ? 'from-amber-400 to-yellow-300'
    : isDraw
    ? 'from-sky-400 to-blue-300'
    : 'from-slate-400 to-slate-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-8 w-full max-w-md flex flex-col gap-6 shadow-2xl shadow-black/60 animate-scale-up">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">{emoji}</span>
          <h2 className={`text-3xl font-serif font-black bg-gradient-to-r ${headlineColor} bg-clip-text text-transparent`}>
            {resultLabel}
          </h2>
          <p className="text-slate-400 text-sm font-medium">{reasonLabel}</p>
        </div>

        <div className="flex gap-4 justify-center">
          <AccuracyBadge value={event.white_accuracy} label="White Accuracy" />
          <AccuracyBadge value={event.black_accuracy} label="Black Accuracy" />
        </div>

        <div className="bg-slate-800/60 rounded-2xl px-5 py-3 text-center border border-slate-700/50">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Your Accuracy</p>
          <p className="text-2xl font-serif font-black text-slate-100">
            {playerColor === 'white'
              ? event.white_accuracy.toFixed(1)
              : event.black_accuracy.toFixed(1)}%
          </p>
        </div>

        <div className="flex gap-3">
          <button
            id="btn-new-game-modal"
            onClick={onNewGame}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-slate-950 font-serif font-extrabold rounded-2xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:scale-95 duration-150"
          >
            ♙ New Game
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function ChessAnalyzerApp() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [showColorModal, setShowColorModal] = useState(false);
  const [modalStep, setModalStep] = useState<'mode' | 'side' | 'analysis_setup' | 'position_setup' | 'blunder_practice'>('mode');
  const [practiceBlunder, setPracticeBlunder] = useState<BlunderPosition | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<{ status: 'success' | 'fail'; message: string } | null>(null);
  const boardRef = useRef<BoardRef>(null);

  // Auto-open modal if ?newgame=true
  useEffect(() => {
    if (searchParams.get('newgame') === 'true') {
      setModalStep('mode');
      setShowColorModal(true);
    }
  }, [searchParams]);

  const openNewGameModal = () => {
    setModalStep('mode');
    setShowColorModal(true);
    setPracticeBlunder(null);
    setPracticeFeedback(null);
  };

  const [wsStatus, setWsStatus] = useState<'connected' | 'reconnecting' | 'failed' | 'disconnected'>('disconnected');
  const [wsAttempt, setWsAttempt] = useState<number>(0);

  const [lastMoveEvaluation, setLastMoveEvaluation] = useState<{
    san: string;
    label: string;
    explanation: string;
  } | null>(null);

  const [activeThreat, setActiveThreat] = useState<{
    threat: string;
    bestResponse: string;
  } | null>(null);

  const [gameMode, setGameMode] = useState<'bot' | 'analysis'>('analysis');
  const [currentFen, setCurrentFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [moves, setMoves] = useState<Move[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommendLoading, setIsRecommendLoading] = useState<boolean>(false);
  const [highlightSquares, setHighlightSquares] = useState<string[]>([]);
  const recommendationsFenRef = useRef<string | null>(null);
  const [localGame, setLocalGame] = useState(() => new Chess());
  const [gameOverEvent, setGameOverEvent] = useState<GameOverEvent | null>(null);
  const [isGameEnded, setIsGameEnded] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const [redoStack, setRedoStack] = useState<{ uci: string; promotion?: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'hint' | 'recommend'>('recommend');
  const [isMoveListExpanded, setIsMoveListExpanded] = useState(false);

  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);

  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;
    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const size = Math.max(150, Math.min(rect.width - 40, rect.height));
      setBoardSize(size);
    };
    handleResize();
    const observer = new ResizeObserver(() => { handleResize(); });
    observer.observe(container);
    return () => { observer.disconnect(); };
  }, [activeGame]);

  useEffect(() => {
    if (gameMode !== 'analysis') { setActiveTab('recommend'); }
  }, [gameMode]);

  useEffect(() => { setRedoStack([]); }, [gameMode]);

  useEffect(() => {
    try { setLocalGame(new Chess(currentFen)); }
    catch (e) { console.error('Failed to sync local game FEN:', e); }
  }, [currentFen]);

  useEffect(() => {
    if (!activeGame || gameMode !== 'bot' || isGameEnded) return;
    const currentTurn = localGame.turn() === 'w' ? 'white' : 'black';
    if (currentTurn !== playerColor && !localGame.isGameOver()) {
      const timer = setTimeout(() => {
        const moves = localGame.moves({ verbose: true });
        if (moves.length > 0) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          const uci = randomMove.from + randomMove.to + (randomMove.promotion || '');
          if (boardRef.current) {
            boardRef.current.sendMove({ from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion, uci });
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentFen, playerColor, activeGame, gameMode, localGame, isGameEnded]);

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
    } catch (e) { console.error('Error in FEN monitoring effect:', e); }
  }, [currentFen, playerColor, activeGame]);

  const handleStartNewGame = async (color: 'white' | 'black', customFen?: string) => {
    try {
      const gameData = await startGame(color, customFen);
      setShowColorModal(false);
      setActiveGame(gameData);
      setPlayerColor(color);
      const startingFen = customFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      setCurrentFen(startingFen);
      setMoves([]);
      setLocalGame(new Chess(startingFen));
      setLastMoveEvaluation(null);
      setActiveThreat(null);
      setCurrentScore(0);
      setRecommendations([]);
      setHighlightSquares([]);
      const tempChess = new Chess(startingFen);
      const isPlayerTurn = tempChess.turn() === color[0];
      setIsRecommendLoading(isPlayerTurn);
      recommendationsFenRef.current = null;
      setGameOverEvent(null);
      setIsGameEnded(false);
      setIsResigning(false);
      setRedoStack([]);
      setWsStatus('disconnected');
      setWsAttempt(0);
      setPracticeFeedback(null);
    } catch (error) {
      console.error('Failed to start game:', error);
      alert('Failed to start game. Make sure the backend is running.');
    }
  };

  const handleResign = async (color?: 'white' | 'black') => {
    if (!activeGame || isGameEnded || isResigning) return;
    setIsResigning(true);
    try {
      const targetColor = color || playerColor;
      if (boardRef.current) { (boardRef.current as any).sendResign?.(targetColor); }
      const data = await resignGame(activeGame.id, targetColor);
      setIsGameEnded(true);
      setGameOverEvent({ result: data.result, reason: 'resign', white_accuracy: data.white_accuracy, black_accuracy: data.black_accuracy });
    } catch (error) { console.error('Resign failed:', error); }
    finally { setIsResigning(false); }
  };

  const canUndo = gameMode === 'bot' ? moves.length >= 2 : moves.length >= 1;
  const canRedo = redoStack.length > 0;

  const handleUndo = () => {
    if (!canUndo) return;
    const undoCount = gameMode === 'bot' ? 2 : 1;
    const movesToUndo = moves.slice(moves.length - undoCount);
    let redoItems: { uci: string; promotion?: string }[] = [];
    if (gameMode === 'bot') {
      const playerMove = movesToUndo.find((m) => m.isWhite === (playerColor === 'white'));
      if (playerMove && playerMove.uci) { redoItems = [{ uci: playerMove.uci }]; }
    } else {
      const lastMove = movesToUndo[0];
      if (lastMove && lastMove.uci) { redoItems = [{ uci: lastMove.uci }]; }
    }
    if (redoItems.length > 0) { setRedoStack((prev) => [...prev, ...redoItems]); }
    if (boardRef.current) { (boardRef.current as any).sendUndo?.(undoCount); }
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const nextMove = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    if (boardRef.current && nextMove) {
      const from = nextMove.uci.slice(0, 2);
      const to = nextMove.uci.slice(2, 4);
      const promotion = nextMove.uci.length === 5 ? nextMove.uci.slice(4, 5) : undefined;
      boardRef.current.sendMove({ from, to, promotion, uci: nextMove.uci });
    }
  };

  const isMoveBetter = (
    newScore: number | null | undefined,
    newLabel: string | null | undefined,
    originalScore: number | null | undefined,
    originalLabel: string | null | undefined,
    isWhite: boolean
  ): boolean => {
    if (newScore !== null && newScore !== undefined && originalScore !== null && originalScore !== undefined) {
      return isWhite ? (newScore > originalScore) : (newScore < originalScore);
    }
    const labelValues: Record<string, number> = { 'Brilliant': 5, 'Excellent': 4, 'Good': 3, 'Inaccuracy': 2, 'Mistake': 1, 'Blunder': 0, 'Unknown': 0 };
    const newVal = labelValues[newLabel || ''] ?? 0;
    const origVal = labelValues[originalLabel || ''] ?? 0;
    return newVal > origVal;
  };

  const handleMoveResult = (result: {
    san: string | null; label: string | null; score_before: number | null; score_after: number | null;
    explanation: string | null; current_fen: string; recommendations?: Recommendation[]; opponent_analysis?: any;
    game_over?: GameOverEvent; is_undo?: boolean; undone_count?: number; uci?: string;
  }) => {
    setCurrentFen(result.current_fen);
    if (result.score_after !== null && result.score_after !== undefined) { setCurrentScore(result.score_after); }
    if (result.recommendations !== undefined) {
      setRecommendations(result.recommendations);
      setIsRecommendLoading(false);
      recommendationsFenRef.current = result.current_fen;
    }
    if (result.opponent_analysis && result.opponent_analysis.threat) {
      setActiveThreat({ threat: result.opponent_analysis.threat, bestResponse: result.opponent_analysis.best_response });
    } else { setActiveThreat(null); }
    if (result.game_over) { setIsGameEnded(true); setGameOverEvent(result.game_over); }
    if (result.is_undo) {
      setIsGameEnded(false);
      setGameOverEvent(null);
      setPracticeFeedback(null);
      const count = result.undone_count || 1;
      setMoves((prev) => prev.slice(0, prev.length - count));
      if (result.san) {
        setLastMoveEvaluation({ san: result.san, label: result.label || '', explanation: result.explanation || '' });
      } else { setLastMoveEvaluation(null); }
    } else if (result.san) {
      if (practiceBlunder && moves.length === 0) {
        const isWhite = playerColor === 'white';
        const isBetter = isMoveBetter(result.score_after, result.label, practiceBlunder.score_after, practiceBlunder.label, isWhite);
        if (isBetter) {
          setPracticeFeedback({ status: 'success', message: '✓ Better than before!' });
        } else {
          setPracticeFeedback({ status: 'fail', message: 'Still not optimal, try again' });
        }
      }
      setLastMoveEvaluation({ san: result.san, label: result.label || '', explanation: result.explanation || '' });
      setMoves((prev) => {
        const nextMoveIndex = prev.length;
        const isWhite = nextMoveIndex % 2 === 0;
        const moveNumber = Math.floor(nextMoveIndex / 2) + 1;
        const newMove: Move = { moveNumber, san: result.san!, uci: result.uci || undefined, label: result.label || '', explanation: result.explanation || '', isWhite, opponent_analysis: result.opponent_analysis };
        return [...prev, newMove];
      });
    }
  };

  const handleHighlight = (uci: string | null) => {
    if (!uci) { setHighlightSquares([]); }
    else { setHighlightSquares([uci.slice(2, 4)]); }
  };

  const getGameStatusLabel = () => {
    if (isGameEnded) {
      const r = gameOverEvent?.result;
      if (r === '1-0') return 'White Wins ♔';
      if (r === '0-1') return 'Black Wins ♚';
      if (r === '1/2-1/2') return 'Draw 🤝';
      return 'Game Over';
    }
    if (localGame.isCheckmate()) return 'Checkmate!';
    if (localGame.isDraw()) return 'Draw';
    if (localGame.isCheck()) return 'Check!';
    return localGame.turn() === 'w' ? "White's Turn" : "Black's Turn";
  };

  const isPlayerTurn = activeGame ? (localGame.turn() === playerColor[0]) : false;

  return (
    <div className={activeGame
      ? "flex-1 w-full flex flex-col h-[calc(100vh-70px)] md:h-[calc(100vh-73px)] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 items-center justify-between"
      : "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center"
    }>
      {/* Sub-header action bar */}
      {activeGame && (
        <div className="w-full max-w-7xl px-6 py-3 flex justify-between items-center bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="brass-plaque px-4 py-1.5 flex items-center gap-2 font-serif font-bold tracking-tight shadow-md">
              <span className="text-[10px] uppercase opacity-75">Status:</span>
              <span className="text-sm font-black">{getGameStatusLabel()}</span>
            </div>
            <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-950/40 border border-slate-800 text-indigo-500 font-bold uppercase tracking-wider">
              {gameMode === 'bot' ? '🤖 VS Bot' : '🔬 Analysis'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 border-r border-slate-800 pr-2 mr-2">
              <button
                id="btn-undo"
                onClick={handleUndo}
                disabled={!canUndo}
                className="px-2.5 py-1.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-1 transition duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 hover:border-slate-700"
              >
                ↶ Undo
              </button>
              <button
                id="btn-redo"
                onClick={handleRedo}
                disabled={!canRedo}
                className="px-2.5 py-1.5 rounded-lg border font-bold text-xs flex items-center justify-center gap-1 transition duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-slate-100 hover:border-slate-700"
              >
                Redo ↷
              </button>
            </div>

            {!isGameEnded && (
              <>
                <button
                  id={playerColor === 'white' ? 'btn-resign-white' : 'btn-resign-black'}
                  onClick={() => handleResign(playerColor)}
                  disabled={isResigning}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 transition rounded-lg border border-rose-800/50 hover:border-rose-700/60 active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResigning ? 'Resigning...' : `🏳 Resign ${playerColor === 'white' ? 'White' : 'Black'}`}
                </button>
                <button
                  id={playerColor === 'white' ? 'btn-resign-black' : 'btn-resign-white'}
                  onClick={() => handleResign(playerColor === 'white' ? 'black' : 'white')}
                  disabled={isResigning}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 transition rounded-lg border border-emerald-800/50 hover:border-emerald-700/60 active:scale-95 duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResigning ? 'Resigning...' : `🏳 Resign ${playerColor === 'white' ? 'Black' : 'White'}`}
                </button>
              </>
            )}
            <button
              id="btn-new-game-header"
              onClick={openNewGameModal}
              className="px-3 py-1.5 text-xs font-serif font-black text-slate-950 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition rounded-lg shadow-md active:scale-95 duration-150"
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace */}
      <main className={activeGame
        ? "flex-1 w-full max-w-7xl px-6 py-4 flex flex-col min-h-0 justify-between overflow-hidden"
        : "flex-1 w-full max-w-7xl px-4 py-8 flex flex-col items-center justify-center overflow-y-auto"
      }>
        {!activeGame ? (
          <div className="text-center max-w-2xl px-6 py-16 bg-slate-900/40 rounded-3xl border border-slate-800/80 backdrop-blur-2xl shadow-2xl flex flex-col items-center gap-6 mt-8 animate-fade-in">
            <div className="relative w-20 h-20 flex items-center justify-center mb-2">
              <Image src="/logos/logo_concept3_arrow_knight.svg" alt="CHEZZY Logo" width={80} height={80} className="object-contain" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-extrabold text-slate-100">
              Chess Analysis with Stockfish Heuristics
            </h2>
            <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
              Improve your tactics and strategy in real-time. Get detailed explanations and risk analysis for every best move recommended by Stockfish.
            </p>
            <button
              id="btn-new-game-landing"
              onClick={openNewGameModal}
              className="mt-4 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-slate-950 font-serif font-black rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 duration-150"
            >
              New Game
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full flex flex-col gap-4 items-center justify-between">
            {wsStatus === 'reconnecting' && (
              <div className="w-full max-w-5xl bg-rose-600/95 border border-rose-500 text-white px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-lg animate-pulse shrink-0">
                <span className="text-xl">⚠️</span>
                <div className="flex-1 text-sm font-bold">Connection lost, reconnecting... (Attempt {wsAttempt}/5)</div>
              </div>
            )}
            {wsStatus === 'failed' && (
              <div className="w-full max-w-5xl bg-rose-700 border border-rose-600 text-white px-5 py-2.5 rounded-2xl flex items-center gap-3 shadow-lg shrink-0">
                <span className="text-xl">🚨</span>
                <div className="flex-1 text-sm font-bold">Reconnection failed, please refresh the page</div>
              </div>
            )}

            <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-6 items-stretch justify-center">
              <div className="flex flex-col justify-between items-center gap-2 w-full lg:w-[480px] xl:w-[540px] shrink-0">
                <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-1.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${playerColor === 'white' ? 'bg-slate-500 border border-slate-400' : 'bg-slate-200 shadow'}`} />
                    <span className="font-semibold text-xs text-slate-200">
                      {gameMode === 'bot' ? 'Opponent (Bot)' : 'Analysis Opponent'}
                    </span>
                  </div>
                  {!isPlayerTurn && !localGame.isGameOver() && !isGameEnded && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">Moving...</span>
                  )}
                </div>

                <div ref={boardContainerRef} className="flex-1 min-h-0 w-full flex items-center justify-center gap-3">
                  <div style={{ height: boardSize }} className="flex items-stretch gap-3 justify-center">
                    <EvalBar score={currentScore} />
                    <Board
                      boardWidth={boardSize}
                      position={currentFen}
                      playerColor={playerColor}
                      sessionId={activeGame?.id}
                      onMoveResult={handleMoveResult}
                      highlightSquares={highlightSquares}
                      gameMode={gameMode}
                      onNewMove={() => setRedoStack([])}
                      ref={boardRef}
                      onConnectionStatusChange={(status, attempt) => { setWsStatus(status); setWsAttempt(attempt); }}
                    />
                  </div>
                </div>

                <div className="w-full bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-1.5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${playerColor === 'white' ? 'bg-slate-200 shadow' : 'bg-slate-500 border border-slate-400'}`} />
                    <span className="font-semibold text-xs text-slate-200">You</span>
                  </div>
                  {isPlayerTurn && !localGame.isGameOver() && !isGameEnded && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 animate-pulse">Your Turn</span>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {activeThreat && !isGameEnded && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 py-2 px-3 rounded-xl flex items-start gap-2 shadow-sm animate-fade-in shrink-0 text-xs">
                    <span className="shrink-0 text-amber-400 mt-0.5">⚠️</span>
                    <div className="flex-1 min-w-0 leading-normal">
                      <p className="text-slate-200"><span className="font-bold text-amber-400 mr-1.5">Threat:</span>{activeThreat.threat}</p>
                      <p className="text-slate-400 text-[11px] mt-1">Best response: <span className="font-bold font-mono text-emerald-400 bg-slate-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">{activeThreat.bestResponse}</span></p>
                    </div>
                  </div>
                )}

                {practiceFeedback && (
                  <div className={`p-4 rounded-xl border backdrop-blur-xl animate-fade-in flex flex-col gap-1.5 shrink-0 ${practiceFeedback.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/10 border-rose-500/30 text-rose-200'}`}>
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <span className="text-sm">{practiceFeedback.status === 'success' ? '🏆' : '❌'}</span>
                      <span>{practiceFeedback.message}</span>
                    </div>
                    {practiceFeedback.status === 'fail' && (
                      <p className="text-[10px] text-rose-300/80 leading-normal">
                        Your move was less optimal than the original. Click <span className="underline cursor-pointer font-bold hover:text-rose-100 transition" onClick={handleUndo}>Undo</span> to try another move.
                      </p>
                    )}
                  </div>
                )}

                {lastMoveEvaluation && (
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-1.5 shadow-md shrink-0 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Last Move:</span>
                      <span className="text-xs font-bold font-mono text-indigo-400">{lastMoveEvaluation.san}</span>
                      <span className="text-slate-500">—</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${
                        lastMoveEvaluation.label === 'Brilliant' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        lastMoveEvaluation.label === 'Excellent' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        lastMoveEvaluation.label === 'Good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        lastMoveEvaluation.label === 'Inaccuracy' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        lastMoveEvaluation.label === 'Mistake' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        lastMoveEvaluation.label === 'Blunder' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {lastMoveEvaluation.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-350 font-medium leading-relaxed">{lastMoveEvaluation.explanation}</p>
                  </div>
                )}

                <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                  <div className="flex border-b border-slate-800/80 bg-slate-950/20 shrink-0">
                    {gameMode === 'analysis' && (
                      <button
                        onClick={() => setActiveTab('hint')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${activeTab === 'hint' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
                      >
                        💡 Hint
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('recommend')}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${activeTab === 'recommend' ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'}`}
                    >
                      🎯 Recommendations
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin">
                    {activeTab === 'hint' && gameMode === 'analysis' && (
                      <HintPanel fen={currentFen} is_white={playerColor === 'white'} noWrapper={true} />
                    )}
                    {activeTab === 'recommend' && (
                      <RecommendPanel
                        recommendations={recommendations}
                        onHighlight={handleHighlight}
                        isMyTurn={isPlayerTurn}
                        isLoading={isRecommendLoading}
                        noWrapper={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full shrink-0">
              <div className="bg-slate-900/60 border border-slate-850 rounded-xl overflow-hidden transition-all duration-300 flex flex-col">
                <button
                  onClick={() => setIsMoveListExpanded(!isMoveListExpanded)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-slate-800/40 transition text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">{isMoveListExpanded ? '▼' : '▲'}</span>
                    <span>Move List</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono border border-slate-800/40">{moves.length} moves</span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic font-normal">
                    {isMoveListExpanded ? 'Click to collapse' : 'Click to expand'}
                  </span>
                </button>
                <div className={`transition-all duration-300 overflow-hidden ${isMoveListExpanded ? 'h-32 p-3 border-t border-slate-800/50' : 'h-0'}`}>
                  <MoveList moves={moves} noWrapper={true} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {!activeGame && (
        <footer className="w-full border-t border-slate-900/50 py-4 text-center text-xs text-slate-600 max-w-7xl shrink-0">
          CHEZZY v1.0.0 &copy; 2026. Powered by Stockfish engine.
        </footer>
      )}

      {/* Game Setup Modal */}
      {showColorModal && (
        <div onClick={() => setShowColorModal(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md cursor-pointer">
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full flex flex-col gap-6 shadow-2xl relative animate-scale-up cursor-default transition-all duration-200 ${modalStep === 'position_setup' || modalStep === 'blunder_practice' ? 'max-w-md' : 'max-w-sm'}`}
          >
            {modalStep === 'mode' ? (
              <>
                <h3 className="text-lg font-bold text-center text-slate-200">Choose Game Mode</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button id="btn-choose-bot" onClick={() => { setGameMode('bot'); setModalStep('side'); }} className="flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100 text-left">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">🤖</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-200">VS Bot</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Practice your chess against a random AI bot.</span>
                    </div>
                  </button>
                  <button id="btn-choose-analysis" onClick={() => { setGameMode('analysis'); setModalStep('analysis_setup'); }} className="flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100 text-left">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">🔬</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-200">Solo Analysis</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Analyze moves step-by-step with the engine.</span>
                    </div>
                  </button>
                </div>
                <button id="btn-color-cancel" onClick={() => setShowColorModal(false)} className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 rounded-xl text-center border border-slate-800">Cancel</button>
              </>
            ) : modalStep === 'analysis_setup' ? (
              <>
                <h3 className="text-lg font-bold text-center text-slate-200">Setup Solo Analysis</h3>
                <div className="grid grid-cols-1 gap-4">
                  <button id="btn-choose-start-pos" onClick={() => setModalStep('side')} className="flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100 text-left">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">🏁</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-200">Start from initial position</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Begin a standard chess game from the starting position.</span>
                    </div>
                  </button>
                  <button id="btn-choose-manual-setup" onClick={() => setModalStep('position_setup')} className="flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100 text-left">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">⚙️</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-200">Manual position setup</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Enter a custom position via FEN string.</span>
                    </div>
                  </button>
                  <button id="btn-choose-blunder-practice" onClick={() => setModalStep('blunder_practice')} className="flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100 text-left">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">🧠</span>
                    <div>
                      <span className="block text-sm font-semibold text-slate-200">Practice from Your Blunders</span>
                      <span className="block text-xs text-slate-400 mt-0.5">Train from mistakes made in previous games.</span>
                    </div>
                  </button>
                </div>
                <button id="btn-analysis-setup-back" onClick={() => setModalStep('mode')} className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 rounded-xl text-center border border-slate-800">Back</button>
              </>
            ) : modalStep === 'position_setup' ? (
              <PositionSetup
                onLoadPosition={(fen) => {
                  try { const chess = new Chess(fen); handleStartNewGame(chess.turn() === 'w' ? 'white' : 'black', fen); }
                  catch (e) { console.error('Invalid FEN loaded:', e); }
                }}
                onBack={() => setModalStep('analysis_setup')}
              />
            ) : modalStep === 'blunder_practice' ? (
              <BlunderPracticeSetup
                onLoadPosition={(fen, blunder) => {
                  try {
                    setGameMode('analysis');
                    setPracticeBlunder(blunder);
                    setPracticeFeedback(null);
                    const chess = new Chess(fen);
                    handleStartNewGame(chess.turn() === 'w' ? 'white' : 'black', fen);
                  } catch (e) { console.error('Invalid FEN loaded:', e); }
                }}
                onBack={() => setModalStep('analysis_setup')}
              />
            ) : (
              <>
                <h3 className="text-lg font-bold text-center text-slate-200">Choose Your Color</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button id="btn-color-white" onClick={() => handleStartNewGame('white')} className="flex flex-col items-center gap-3 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100">
                    <span className="text-4xl group-hover:scale-110 transition duration-150">♔</span>
                    <span className="text-sm font-semibold text-slate-200">White</span>
                  </button>
                  <button id="btn-color-black" onClick={() => handleStartNewGame('black')} className="flex flex-col items-center gap-3 p-4 bg-slate-950 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group active:scale-95 duration-100">
                    <span className="text-4xl text-slate-400 group-hover:scale-110 transition duration-150">♚</span>
                    <span className="text-sm font-semibold text-slate-200">Black</span>
                  </button>
                </div>
                <button id="btn-modal-back" onClick={() => { setModalStep(gameMode === 'analysis' ? 'analysis_setup' : 'mode'); }} className="py-2.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 rounded-xl text-center border border-slate-800">Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {gameOverEvent && (
        <GameOverModal event={gameOverEvent} playerColor={playerColor} onNewGame={() => { setGameOverEvent(null); openNewGameModal(); }} />
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <React.Suspense fallback={null}>
        <ChessAnalyzerApp />
      </React.Suspense>
    </QueryClientProvider>
  );
}
