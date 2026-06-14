'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

export interface BoardRef {
  sendMove: (move: { from: string; to: string; promotion?: string; uci?: string }) => void;
}

interface BoardProps {
  position: string;
  playerColor: 'white' | 'black';
  sessionId?: string;
  onMoveResult?: (result: {
    san: string;
    label: string;
    score_before: number;
    score_after: number;
    explanation: string;
    current_fen: string;
  }) => void;
  highlightSquares?: Record<string, React.CSSProperties> | string[];
}

const Board = forwardRef<BoardRef, BoardProps>(({ position, playerColor, sessionId, onMoveResult, highlightSquares }, ref) => {
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

  // Establish WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = `ws://localhost:8000/ws/game/${sessionId}`;
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
        } else if (data.type === 'error') {
          console.error('WebSocket game error:', data.message);
          // Revert local state to parent's position on error
          const resetGame = new Chess(position);
          setGame(resetGame);
          setCurrentFen(position);
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
  }, [sessionId, position]);

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

  useImperativeHandle(ref, () => ({
    sendMove: sendMoveViaWS
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
    // Enforce that only the current player's pieces can be dragged on their turn
    const isCorrectColor =
      (playerColor === 'white' && piece.startsWith('w')) ||
      (playerColor === 'black' && piece.startsWith('b'));
    
    const isMyTurn = game.turn() === playerColor[0];
    
    return isCorrectColor && isMyTurn && !game.isGameOver();
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

  // Parse custom highlightSquares prop (supports array or style object)
  let propStyles: Record<string, React.CSSProperties> = {};
  if (highlightSquares) {
    if (Array.isArray(highlightSquares)) {
      highlightSquares.forEach((sq) => {
        propStyles[sq] = {
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 20%, transparent 25%)', // Blue indicator dot
          borderRadius: '50%',
        };
      });
    } else if (typeof highlightSquares === 'object') {
      propStyles = highlightSquares as Record<string, React.CSSProperties>;
    }
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
