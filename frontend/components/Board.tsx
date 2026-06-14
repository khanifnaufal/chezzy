'use client';

import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

interface BoardProps {
  position: string;
  playerColor: 'white' | 'black';
  onMove?: (move: { from: string; to: string; promotion?: string; san?: string; uci?: string }) => void;
  highlightSquares?: Record<string, React.CSSProperties> | string[];
}

export default function Board({ position, playerColor, onMove, highlightSquares }: BoardProps) {
  const [game, setGame] = useState(() => new Chess(position));
  const [currentFen, setCurrentFen] = useState(position);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Sync internal board game when the parent position prop changes
  useEffect(() => {
    if (position && position !== game.fen()) {
      try {
        const newGame = new Chess(position);
        setGame(newGame);
        setCurrentFen(position);
      } catch (e) {
        console.error('Failed to sync board game with parent position FEN:', e);
      }
    }
  }, [position]);

  // Reset/re-initialize board when playerColor changes
  useEffect(() => {
    const newGame = new Chess(position);
    setGame(newGame);
    setCurrentFen(position);
    setLastMove(null);
  }, [playerColor]);

  // Handle move validation and execution
  const makeAMove = (from: string, to: string, promotion?: string): boolean => {
    try {
      const moveObj = { from, to, promotion };
      const moveResult = game.move(moveObj);
      
      if (moveResult) {
        setCurrentFen(game.fen());
        setLastMove({ from, to });
        
        if (onMove) {
          onMove({
            from,
            to,
            promotion,
            san: moveResult.san,
            uci: moveResult.from + moveResult.to + (moveResult.promotion || ''),
          });
        }
        return true;
      }
    } catch (error) {
      console.warn('Move rejected by chess.js (illegal move):', error);
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
}
