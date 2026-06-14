'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { WS_URL } from '../lib/api';

export interface BoardRef {
  sendMove: (move: { from: string; to: string; promotion?: string; uci?: string }) => void;
  sendResign: () => void;
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
}

const Board = forwardRef<BoardRef, BoardProps>(({ position, playerColor, sessionId, onMoveResult, highlightSquares, gameMode = 'bot' }, ref) => {
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

  // Establish WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    // Dynamically derive WS URL based on API config (avoid hardcoding port 8000)
    let parsedWsUrl = WS_URL;
    if (parsedWsUrl.startsWith('http://')) {
      parsedWsUrl = parsedWsUrl.replace('http://', 'ws://');
    } else if (parsedWsUrl.startsWith('https://')) {
      parsedWsUrl = parsedWsUrl.replace('https://', 'wss://');
    }
    const wsUrl = `${parsedWsUrl}/ws/game/${sessionId}`;
    
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'initial_fen') {
          console.log('Received initial FEN from WS:', data.fen);
          const newGame = new Chess(data.fen);
          setGame(newGame);
          setCurrentFen(data.fen);
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
          // Revert local state to parent's position on error using positionRef
          const resetGame = new Chess(positionRef.current);
          setGame(resetGame);
          setCurrentFen(positionRef.current);
        }
      } catch (e) {
        console.error('Error handling WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

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

  const sendResignViaWS = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resign' }));
    } else {
      console.warn('WebSocket is not open. Cannot send resign.');
    }
  };

  useImperativeHandle(ref, () => ({
    sendMove: sendMoveViaWS,
    sendResign: sendResignViaWS,
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
        return true;
      }
    } catch (error) {
      console.warn('Move validation failed locally:', error);
    }
    return false;
  };

  const onPieceDrop = (sourceSquare: string, targetSquare: string, piece: string): boolean => {
    // Detect promotion: pawn moving to the end rank
    const pieceObj = game.get(sourceSquare as any);
    const isPawn = pieceObj && pieceObj.type === 'p';
    const isEndRow = targetSquare[1] === '8' || targetSquare[1] === '1';
    const promotion = isPawn && isEndRow ? 'q' : undefined;

    return makeAMove(sourceSquare, targetSquare, promotion);
  };

  const isDraggablePiece = ({ piece }: { piece: string }): boolean => {
    if (game.isGameOver()) return false;

    if (gameMode === 'analysis') {
      // In analysis mode, allow moving the piece matching the current turn's color
      const currentTurnPiecePrefix = game.turn(); // 'w' or 'b'
      return piece.startsWith(currentTurnPiecePrefix);
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
    <div className="w-full max-w-[500px] aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-700/50 bg-slate-900">
      <Chessboard
        position={currentFen}
        onPieceDrop={onPieceDrop}
        isDraggablePiece={isDraggablePiece}
        boardOrientation={playerColor}
        customSquareStyles={customSquareStyles}
        arePiecesDraggable={true}
        animationDuration={200}
        customDarkSquareStyle={{ backgroundColor: '#475569' }} // Tailwind slate-600
        customLightSquareStyle={{ backgroundColor: '#cbd5e1' }} // Tailwind slate-300
      />
    </div>
  );
});

Board.displayName = 'Board';

export default Board;
