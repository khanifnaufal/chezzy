import chess
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.labeler import label_move, get_phase
from backend.engine.recommender import analyze_move_heuristics, generate_explanation_and_risk

logger = logging.getLogger("chess_analyzer")

router = APIRouter()

# Global dictionary to store active games. Key: session_id, Value: chess.Board
active_games: dict[str, chess.Board] = {}

def get_move_explanation(label: str, h: dict, explanation: str, risk: str) -> str:
    """
    Generates a context-aware explanation based on the move's label and heuristics.
    """
    if label == "Blunder":
        base = "Langkah ini adalah blunder fatal yang merugikan posisi atau material Anda secara signifikan."
        if risk:
            base += f" {risk}"
        return base
    elif label == "Mistake":
        base = "Langkah ini kurang tepat (mistake) dan memberikan lawan kesempatan untuk merebut inisiatif."
        if risk:
            base += f" {risk}"
        return base
    elif label == "Inaccuracy":
        base = "Langkah ini kurang akurat (inaccuracy) dan sedikit melemahkan keaktifan perwira Anda."
        if risk:
            base += f" {risk}"
        return base
    elif label == "Brilliant":
        return "Langkah luar biasa! Sebuah manuver taktis yang sangat cerdas dan sulit dideteksi."
    elif label == "Excellent":
        return f"Langkah yang sangat bagus! {explanation}"
    else:
        return explanation

@router.websocket("/ws/game/{session_id}")
async def websocket_game(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"Client connected to WS game session: {session_id}")
    
    # Retrieve or create chess board for session_id
    if session_id not in active_games:
        active_games[session_id] = chess.Board()
        
    board = active_games[session_id]
    
    # Send initial FEN on connection
    await websocket.send_json({
        "type": "initial_fen",
        "fen": board.fen()
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "move":
                uci = data.get("uci")
                is_white = data.get("is_white", True)
                
                if not uci:
                    await websocket.send_json({
                        "type": "error",
                        "message": "UCI move missing"
                    })
                    continue
                
                try:
                    move = chess.Move.from_uci(uci)
                except ValueError:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid UCI format"
                    })
                    continue
                
                if move not in board.legal_moves:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Illegal move"
                    })
                    continue
                
                # Analyze state BEFORE the move is applied
                try:
                    score_before = get_evaluation(board.fen())
                except Exception as e:
                    logger.error(f"Error evaluating position before move: {e}")
                    score_before = 0
                
                # Check if the move is unexpected (not the engine's top choice)
                is_unexpected = False
                try:
                    top_moves = get_top_moves(board.fen(), n=1)
                    if top_moves:
                        top_move_uci = top_moves[0]["move_uci"]
                        if uci != top_move_uci:
                            is_unexpected = True
                except Exception as e:
                    logger.error(f"Error checking top recommended move: {e}")
                
                # Extract heuristics before pushing
                phase = get_phase(board.fullmove_number)
                h = analyze_move_heuristics(board, move, phase)
                explanation_raw, risk_raw = generate_explanation_and_risk(h)
                
                # Apply the move
                san = board.san(move)
                board.push(move)
                
                # Analyze state AFTER the move is applied
                try:
                    score_after = get_evaluation(board.fen())
                except Exception as e:
                    logger.error(f"Error evaluating position after move: {e}")
                    score_after = 0
                
                # Generate final move label
                label = label_move(score_before, score_after, is_white, is_unexpected)
                
                # Refine explanation based on move quality label
                final_explanation = get_move_explanation(label, h, explanation_raw, risk_raw)
                
                # Send the response back to client
                await websocket.send_json({
                    "type": "move_result",
                    "san": san,
                    "label": label,
                    "score_before": score_before,
                    "score_after": score_after,
                    "explanation": final_explanation,
                    "current_fen": board.fen()
                })
                
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from WS game session: {session_id}")
    except Exception as e:
        logger.error(f"Unhandled error in WS game session {session_id}: {e}", exc_info=True)
