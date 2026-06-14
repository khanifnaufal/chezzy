import chess
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.labeler import label_move, get_phase
from backend.engine.recommender import (
    analyze_move_heuristics,
    generate_explanation_and_risk,
    recommend_moves,
    detect_opponent_threats
)

logger = logging.getLogger("chess_analyzer")

router = APIRouter()

# CONCURRENCY & MEMORY LIMITATIONS:
# 1. This application is designed for single-user interactive analysis. Only one WebSocket connection
#    per `session_id` is supported at any given time.
# 2. Access to active games is not synchronized across multiple concurrent connection handlers for the
#    same session ID. If multiple clients connect to the same session and send moves simultaneously,
#    race conditions on the underlying `chess.Board` state can occur.
# 3. Active game boards are kept in this dictionary in-memory to support transient client reconnections
#    (e.g., during browser refresh) without losing game history. In a production clustering or
#    high-concurrency environment, these session states should be stored in a shared database or cache
#    with distributed locks.
active_games: dict[str, chess.Board] = {}
active_game_colors: dict[str, str] = {}

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
    
    # Validate that the session was created through /api/game/start
    if session_id not in active_games:
        logger.warning(f"Rejected WS connection: session {session_id} does not exist.")
        await websocket.close(code=4003)
        return
        
    if session_id not in active_game_colors:
        logger.warning(f"Rejected WS connection: session {session_id} has no registered player color.")
        await websocket.close(code=4003)
        return
        
    board = active_games[session_id]
    
    # Send initial FEN on connection
    await websocket.send_json({
        "type": "initial_fen",
        "fen": board.fen()
    })

    # Send initial recommendations if it is player's turn at start of game
    if session_id not in active_game_colors:
        raise KeyError(f"Session {session_id} color metadata missing.")
    player_color = active_game_colors[session_id]
    is_white = (board.turn == chess.WHITE)
    is_player_turn = (player_color == "white" and is_white) or (player_color == "black" and not is_white)
    if is_player_turn:
        try:
            recs = recommend_moves(board.fen(), is_white)
            await websocket.send_json({
                "type": "move_result",
                "san": None,
                "label": None,
                "score_before": None,
                "score_after": None,
                "explanation": None,
                "current_fen": board.fen(),
                "recommendations": recs
            })
        except Exception as e:
            logger.error(f"Error calculating initial recommendations: {e}")
    
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "move":
                uci = data.get("uci")
                
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
                
                # Derive authoritative is_white from board state before the move is applied
                is_white = (board.turn == chess.WHITE)

                # Analyze state BEFORE the move is applied
                score_before = None
                try:
                    score_before = get_evaluation(board.fen())
                except Exception as e:
                    logger.error(f"Error evaluating position before move: {e}")
                
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
                score_after = None
                try:
                    score_after = get_evaluation(board.fen())
                except Exception as e:
                    logger.error(f"Error evaluating position after move: {e}")
                
                # Retrieve player color and check if it is opponent's move
                if session_id not in active_game_colors:
                    raise KeyError(f"Session {session_id} color metadata missing.")
                player_color = active_game_colors[session_id]
                is_opponent_move = (player_color == "white" and not is_white) or (player_color == "black" and is_white)

                # Generate final move label and explanation, handling engine failure gracefully
                if score_before is None or score_after is None:
                    label = "Unknown"
                    final_explanation = "Gagal mengevaluasi langkah karena masalah pada engine catur."
                else:
                    label = label_move(score_before, score_after, is_white, is_unexpected)
                    final_explanation = get_move_explanation(label, h, explanation_raw, risk_raw)
                
                # Calculate recommendations if next turn belongs to player
                recs = []
                next_is_white = (board.turn == chess.WHITE)
                is_next_player_turn = (player_color == "white" and next_is_white) or (player_color == "black" and not next_is_white)
                if is_next_player_turn:
                    try:
                        recs = recommend_moves(board.fen(), next_is_white)
                    except Exception as e:
                        logger.error(f"Error calculating recommendations: {e}")
                        recs = []

                # Calculate opponent analysis if this was an opponent's move
                opponent_analysis = None
                if is_opponent_move:
                    threat_str = detect_opponent_threats(board, move, player_color)
                    best_response_str = ""
                    if recs:
                        best_response_str = recs[0]["move_san"]
                    else:
                        try:
                            top_moves = get_top_moves(board.fen(), n=1)
                            if top_moves:
                                best_response_str = top_moves[0]["move_san"]
                        except Exception as e:
                            logger.error(f"Error calculating fallback best response: {e}")
                    
                    opponent_analysis = {
                        "label": label,
                        "explanation": final_explanation,
                        "threat": threat_str,
                        "best_response": best_response_str
                    }

                # Prepare response payload
                response_payload = {
                    "type": "move_result",
                    "san": san,
                    "label": label,
                    "score_before": score_before,
                    "score_after": score_after,
                    "explanation": final_explanation,
                    "current_fen": board.fen(),
                    "recommendations": recs,
                    "opponent_analysis": opponent_analysis
                }

                # Send the response back to client
                await websocket.send_json(response_payload)
                
    except WebSocketDisconnect:
        logger.info(f"Client disconnected from WS game session: {session_id}")
    except Exception as e:
        logger.error(f"Unhandled error in WS game session {session_id}: {e}", exc_info=True)
