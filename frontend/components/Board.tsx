'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { WS_URL } from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth-context';

export interface BoardRef {
  sendMove: (move: { from: string; to: string; promotion?: string; uci?: string }) => void;
  sendResign: (color?: 'white' | 'black') => void;
  sendUndo: (count: number) => void;
}

interface BoardProps {
  position: string;
  playerColor: 'white' | 'black';
  sessionId?: string;
  onMoveResult?: (result: {
    san: string | null;
    label: string | null;
    score_before: number | null;
    score_after: number | null;
    explanation: string | null;
    current_fen: string;
    recommendations?: any[];
    opponent_analysis?: any;
    game_over?: {
      result: string;
      reason: string;
      white_accuracy: number;
      black_accuracy: number;
    };
  }) => void;
  highlightSquares?: string[];
  gameMode?: 'bot' | 'analysis';
  readOnly?: boolean;
  onConnectionStatusChange?: (
    status: 'connected' | 'reconnecting' | 'failed',
    attempt: number
  ) => void;
  onNewMove?: () => void;
  boardWidth?: number;
}

const Board = forwardRef<BoardRef, BoardProps>(({ position, playerColor, sessionId, onMoveResult, highlightSquares, gameMode = 'bot', readOnly = false, onConnectionStatusChange, onNewMove, boardWidth }, ref) => {
  const { session } = useAuth();
  const [game, setGame] = useState(() => new Chess(position));
  const [currentFen, setCurrentFen] = useState(position);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const onMoveResultRef = useRef(onMoveResult);

  useEffect(() => {
    onMoveResultRef.current = onMoveResult;
  }, [onMoveResult]);

  // Sync internal board game when the parent position prop changes
  useEffect(() => {
    if (position && position !== game.fen()) {
      try {
        const newGame = new Chess(position);
        setGame(newGame);
        setCurrentFen(position);
        
        // Sync last move highlight
        const history = newGame.history({ verbose: true });
        if (history.length > 0) {
          const last = history[history.length - 1];
          setLastMove({ from: last.from, to: last.to });
        } else {
          setLastMove(null);
        }
      } catch (e) {
        console.error('Failed to sync board game with parent position FEN:', e);
      }
    }
  }, [position, game]);

  // Reset/re-initialize board when playerColor changes
  useEffect(() => {
    const newGame = new Chess(position);
    setGame(newGame);
    setCurrentFen(position);
    setLastMove(null);
  }, [playerColor]);

  // Keep the latest position in a ref so the WebSocket event listeners can access it
  // without re-triggering the connection effect.
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // Establish WebSocket connection with auto-reconnect
  useEffect(() => {
    if (!sessionId || readOnly) return;

    let ws: WebSocket | null = null;
    let reconnectTimeoutId: any = null;
    let currentAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000;
    let isIntentionalClose = false;

    // Helper to derive WS URL
    let parsedWsUrl = WS_URL;
    if (parsedWsUrl.startsWith('http://')) {
      parsedWsUrl = parsedWsUrl.replace('http://', 'ws://');
    } else if (parsedWsUrl.startsWith('https://')) {
      parsedWsUrl = parsedWsUrl.replace('https://', 'wss://');
    }
    const token = session?.access_token || '';
    const wsUrl = `${parsedWsUrl}/ws/game/${sessionId}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    function establishConnection() {
      if (readOnly || isIntentionalClose) return;

      console.log(`Connecting to WebSocket: ${wsUrl} (Attempt ${currentAttempts + 1}/${maxReconnectAttempts})`);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connection established.');
        if (currentAttempts > 0) {
          toast.success("Koneksi tersambung kembali", { id: 'ws-conn-toast' });
        }
        currentAttempts = 0;
        if (onConnectionStatusChange) {
          onConnectionStatusChange('connected', 0);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'initial_fen') {
            console.log('Received initial FEN from WS:', data.fen);
            const newGame = new Chess(data.fen);
            setGame(newGame);
            setCurrentFen(data.fen);
          } else if (data.type === 'undo_result') {
            console.log('Received undo result from WS:', data);
            const newGame = new Chess(data.current_fen);
            setGame(newGame);
            setCurrentFen(data.current_fen);

            const history = newGame.history({ verbose: true });
            if (history.length > 0) {
              const last = history[history.length - 1];
              setLastMove({ from: last.from, to: last.to });
            } else {
              setLastMove(null);
            }

            if (onMoveResultRef.current) {
              onMoveResultRef.current({
                san: data.last_move_evaluation ? data.last_move_evaluation.san : null,
                label: data.last_move_evaluation ? data.last_move_evaluation.label : null,
                score_before: null,
                score_after: data.score,
                explanation: data.last_move_evaluation ? data.last_move_evaluation.explanation : null,
                current_fen: data.current_fen,
                recommendations: data.recommendations,
                opponent_analysis: data.active_threat ? {
                  threat: data.active_threat.threat,
                  best_response: data.active_threat.best_response,
                } : null,
                is_undo: true,
                undone_count: data.undone_count
              } as any);
            }
          } else if (data.type === 'move_result') {
            console.log('Received move result from WS:', data);
            const newGame = new Chess(data.current_fen);
            setGame(newGame);
            setCurrentFen(data.current_fen);

            const history = newGame.history({ verbose: true });
            if (history.length > 0) {
              const last = history[history.length - 1];
              setLastMove({ from: last.from, to: last.to });
            }

            if (onMoveResultRef.current) {
              onMoveResultRef.current(data);
            }
          } else if (data.type === 'game_over') {
            // Toast notification: game saved
            toast.success("Game tersimpan");
            
            // Forward game_over as a special move result to the parent
            if (onMoveResultRef.current) {
              onMoveResultRef.current({
                san: null,
                label: null,
                score_before: null,
                score_after: null,
                explanation: null,
                current_fen: game.fen(),
                game_over: {
                  result: data.result,
                  reason: data.reason,
                  white_accuracy: data.white_accuracy,
                  black_accuracy: data.black_accuracy,
                },
              });
            }
          } else if (data.type === 'error') {
            console.error('WebSocket game error:', data.message);
            if (data.message === "Illegal move" || data.message === "Illegal move.") {
              toast.error("Move ilegal");
            } else {
              toast.error(`Error: ${data.message}`);
            }

            // Revert local state to parent's position on error using positionRef
            const resetGame = new Chess(positionRef.current);
            setGame(resetGame);
            setCurrentFen(positionRef.current);
          }
        } catch (e) {
          console.error('Error handling WS message:', e);
        }
      };

      ws.onclose = (e) => {
        console.log(`WebSocket closed: code=${e.code}`);
        if (isIntentionalClose) return;

        // Trigger disconnect toast
        if (currentAttempts === 0) {
          toast.error("Koneksi terputus", { id: 'ws-conn-toast' });
        }

        if (currentAttempts < maxReconnectAttempts) {
          const nextAttempt = currentAttempts + 1;
          currentAttempts = nextAttempt;
          if (onConnectionStatusChange) {
            onConnectionStatusChange('reconnecting', nextAttempt);
          }
          
          reconnectTimeoutId = setTimeout(() => {
            establishConnection();
          }, reconnectInterval);
        } else {
          if (onConnectionStatusChange) {
            onConnectionStatusChange('failed', currentAttempts);
          }
          toast.error("Gagal reconnect, refresh halaman", { id: 'ws-conn-toast', duration: 10000 });
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    }

    establishConnection();

    return () => {
      isIntentionalClose = true;
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      wsRef.current = null;
    };
  }, [sessionId, readOnly, session]);

  // Send a move through WebSocket
  const sendMoveViaWS = (move: { from: string; to: string; promotion?: string; uci?: string }) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const uci = move.uci || `${move.from}${move.to}${move.promotion || ''}`;
      const isWhite = game.turn() === 'w';
      
      console.log('Sending move via WS:', { type: 'move', uci, is_white: isWhite });
      ws.send(JSON.stringify({
        type: 'move',
        uci,
        is_white: isWhite
      }));
    } else {
      console.warn('WebSocket is not open. Cannot send move.');
    }
  };

  const sendResignViaWS = (color?: 'white' | 'black') => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resign', color }));
    } else {
      console.warn('WebSocket is not open. Cannot send resign.');
    }
  };

  const sendUndoViaWS = (count: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('Sending undo via WS, count:', count);
      ws.send(JSON.stringify({
        type: 'undo',
        count: count
      }));
    } else {
      console.warn('WebSocket is not open. Cannot send undo.');
    }
  };

  useImperativeHandle(ref, () => ({
    sendMove: sendMoveViaWS,
    sendResign: sendResignViaWS,
    sendUndo: sendUndoViaWS,
  }));

  // Handle move validation and execution (local test and WS request)
  const makeAMove = (from: string, to: string, promotion?: string): boolean => {
    try {
      const moveObj = { from, to, promotion };
      const tempGame = new Chess(game.fen());
      const moveResult = tempGame.move(moveObj);
      
      if (moveResult) {
        // Optimistically update local board first so piece moves smoothly
        setGame(tempGame);
        setCurrentFen(tempGame.fen());
        setLastMove({ from, to });
        
        // Send move to server
        sendMoveViaWS({
          from,
          to,
          promotion,
          uci: from + to + (promotion || '')
        });
        if (onNewMove) {
          onNewMove();
        }
        return true;
      } else {
        toast.error("Move ilegal");
      }
    } catch (error) {
      console.warn('Move validation failed locally:', error);
      toast.error("Move ilegal");
    }
    return false;
  };

  const onPromotionCheck = (sourceSquare: string, targetSquare: string): boolean => {
    const tempGame = new Chess(game.fen());
    const validMoves = tempGame.moves({ verbose: true });
    return validMoves.some(
      (move) => move.from === sourceSquare && move.to === targetSquare && move.promotion
    );
  };

  const onPromotionPieceSelect = (piece?: string, promoteFromSquare?: string, promoteToSquare?: string): boolean => {
    if (!piece || !promoteFromSquare || !promoteToSquare) return false;
    const promotion = piece.toLowerCase().charAt(piece.length - 1);
    return makeAMove(promoteFromSquare, promoteToSquare, promotion);
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    // Check if this move is a promotion. If so, skip local normal move execution
    // and let react-chessboard trigger the promotion check/selection flow.
    const tempGame = new Chess(game.fen());
    const validMoves = tempGame.moves({ verbose: true });
    const isPromotion = validMoves.some(
      (move) => move.from === sourceSquare && move.to === targetSquare && move.promotion
    );
    if (isPromotion) {
      return true;
    }

    // Normal moves only (promotions are handled by onPromotionCheck/onPromotionPieceSelect)
    return makeAMove(sourceSquare, targetSquare);
  };

  const isDraggablePiece = ({ piece }: { piece: string }): boolean => {
    if (readOnly || game.isGameOver()) return false;

    if (gameMode === 'analysis') {
      // In analysis mode, allow dragging any piece (rules validation is handled on drop)
      return true;
    } else {
      // In bot mode, only allow the player to drag their own pieces on their turn
      const isCorrectColor =
        (playerColor === 'white' && piece.startsWith('w')) ||
        (playerColor === 'black' && piece.startsWith('b'));
      
      const isMyTurn = game.turn() === playerColor[0];
      
      return isCorrectColor && isMyTurn;
    }
  };

  // Determine last move squares to highlight (yellow)
  const lastMoveStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    lastMoveStyles[lastMove.from] = {
      backgroundColor: 'rgba(253, 224, 71, 0.4)', // Amber/Yellow
    };
    lastMoveStyles[lastMove.to] = {
      backgroundColor: 'rgba(253, 224, 71, 0.6)', // Amber/Yellow
    };
  }

  // Parse custom highlightSquares prop (supports array of square names)
  let propStyles: Record<string, React.CSSProperties> = {};
  if (highlightSquares && Array.isArray(highlightSquares)) {
    highlightSquares.forEach((sq) => {
      propStyles[sq] = {
        backgroundColor: 'rgba(34, 197, 94, 0.35)', // transparent green
        border: '2.5px solid rgba(34, 197, 94, 0.85)',
      };
    });
  }

  // Combine styles
  const customSquareStyles = {
    ...lastMoveStyles,
    ...propStyles,
  };

  return (
    <div 
      style={boardWidth ? { width: boardWidth, height: boardWidth } : undefined}
      className={boardWidth
        ? "rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[8px] border-[#3a2212] ring-1 ring-[#dfb75c]/50 bg-[#3a2212] overflow-hidden shrink-0"
        : "w-full max-w-[500px] aspect-square rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[8px] border-[#3a2212] ring-1 ring-[#dfb75c]/50 bg-[#3a2212] shrink-0"
      }
    >
      <Chessboard
        boardWidth={boardWidth ? (boardWidth - 16) : undefined}
        position={currentFen}
        onPieceDrop={readOnly ? () => false : onPieceDrop}
        onPromotionCheck={readOnly ? () => false : onPromotionCheck}
        onPromotionPieceSelect={readOnly ? () => false : onPromotionPieceSelect}
        isDraggablePiece={readOnly ? () => false : isDraggablePiece}
        boardOrientation={playerColor}
        customSquareStyles={customSquareStyles}
        arePiecesDraggable={!readOnly}
        animationDuration={100}
        customDarkSquareStyle={{ backgroundColor: '#244b37' }} // Deep tournament felt green
        customLightSquareStyle={{ backgroundColor: '#eae2d3' }} // Warm ivory/gading
        customBoardStyle={{ borderRadius: '4px' }}
      />
    </div>
  );
});

Board.displayName = 'Board';

export default Board;
