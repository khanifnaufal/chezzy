import chess
import chess.pgn
import logging
import io
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session as DbSession

from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.labeler import label_move, get_phase
from backend.engine.recommender import (
    analyze_move_heuristics,
    generate_explanation_and_risk,
    recommend_moves,
    detect_opponent_threats,
)
from backend.db.database import SessionLocal
from backend.db.models import Game, MoveRecord, Session as SessionModel

logger = logging.getLogger("chess_analyzer")

router = APIRouter()

# ---------------------------------------------------------------------------
# CONCURRENCY & MEMORY NOTES:
#   - Designed for single-user interactive analysis; one WebSocket per session_id.
#   - active_games keeps Board objects in-memory to survive browser reloads.
#   - active_game_colors stores the human player's color per session.
#   - active_move_counts tracks ply count (half-moves) per session for DB records.
# ---------------------------------------------------------------------------
active_games: dict[str, chess.Board] = {}
active_game_colors: dict[str, str] = {}
active_move_counts: dict[str, int] = {}   # counts half-moves (plies)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_db() -> DbSession:
    """Open a new DB session (caller must close it)."""
    return SessionLocal()


def _accuracy_from_moves(move_records: list) -> tuple[float, float]:
    """
    Compute white & black accuracy (0-100) from stored MoveRecord rows.

    Formula (same as Chess.com approximation):
        accuracy = 100 * (1 - avg_centipawn_loss / 1000)  clamped [0, 100]

    Centipawn loss per move = max(0, score_after_opponent_perspective - score_before_opponent_perspective)
    i.e. how much the position worsened from the mover's point of view.
    """
    white_losses: list[float] = []
    black_losses: list[float] = []

    for m in move_records:
        if m.score_before is None or m.score_after is None:
            continue
        if m.is_white:
            # White wants higher scores; loss = drop in score (from white's PoV)
            loss = max(0.0, m.score_before - m.score_after)
            white_losses.append(loss)
        else:
            # Black wants lower scores; loss = rise in score (from white's PoV → bad for black)
            loss = max(0.0, m.score_after - m.score_before)
            black_losses.append(loss)

    def _acc(losses: list[float]) -> float:
        if not losses:
            return 100.0
        avg = sum(losses) / len(losses)
        return max(0.0, min(100.0, 100.0 - avg / 10.0))

    return _acc(white_losses), _acc(black_losses)


def _build_pgn(board_history_moves: list[str], result: str = "*") -> str:
    """
    Build a minimal PGN string from a list of UCI move strings.
    board_history_moves is applied to a fresh Board in order.
    """
    game = chess.pgn.Game()
    game.headers["Event"] = "Chezzy Analysis"
    game.headers["Date"] = datetime.now(timezone.utc).strftime("%Y.%m.%d")
    game.headers["Result"] = result

    node = game
    board = chess.Board()
    for uci in board_history_moves:
        try:
            move = chess.Move.from_uci(uci)
            node = node.add_variation(move)
            board.push(move)
        except Exception:
            break

    game.headers["Result"] = result
    exporter = chess.pgn.StringExporter(headers=True, variations=False, comments=False)
    return game.accept(exporter)


def _finish_game(session_id: str, result: str, board: chess.Board) -> None:
    """
    Persist a completed game + all its moves to the DB and mark the session inactive.
    Called when checkmate, stalemate, draw, or resign is detected.
    """
    db = _get_db()
    try:
        # Fetch accumulated move records for this session
        move_records = db.query(MoveRecord).filter(MoveRecord.game_id == session_id).all()

        white_acc, black_acc = _accuracy_from_moves(move_records)

        # Build PGN from the board's move stack
        uci_moves = [m.uci() for m in board.move_stack]
        pgn_text = _build_pgn(uci_moves, result)

        player_color = active_game_colors.get(session_id, "white")

        # Upsert Game row (it may have been created at session start)
        game_row = db.query(Game).filter(Game.id == session_id).first()
        if game_row:
            game_row.result = result
            game_row.pgn_raw = pgn_text
            game_row.white_accuracy = round(white_acc, 2)
            game_row.black_accuracy = round(black_acc, 2)
        else:
            game_row = Game(
                id=session_id,
                white_player="Player" if player_color == "white" else "Bot",
                black_player="Bot" if player_color == "white" else "Player",
                result=result,
                pgn_raw=pgn_text,
                white_accuracy=round(white_acc, 2),
                black_accuracy=round(black_acc, 2),
            )
            db.add(game_row)

        # Mark session inactive
        session_row = db.query(SessionModel).filter(SessionModel.id == session_id).first()
        if session_row:
            session_row.is_active = False
            session_row.current_fen = board.fen()

        db.commit()
        logger.info(
            f"Game {session_id} saved — result={result} "
            f"white_acc={white_acc:.1f}% black_acc={black_acc:.1f}%"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save finished game {session_id}: {e}", exc_info=True)
    finally:
        db.close()


def _save_move_to_db(
    session_id: str,
    move_number: int,
    san: str,
    uci: str,
    label: str,
    score_before: float | None,
    score_after: float | None,
    is_white: bool,
    phase: str,
    explanation: str,
) -> None:
    """Persist a single move record (fire-and-forget; errors are logged but not raised)."""
    db = _get_db()
    try:
        record = MoveRecord(
            game_id=session_id,
            move_number=move_number,
            san=san,
            uci=uci,
            label=label,
            score_before=score_before,
            score_after=score_after,
            is_white=is_white,
            phase=phase,
            explanation=explanation,
        )
        db.add(record)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save move to DB for session {session_id}: {e}", exc_info=True)
    finally:
        db.close()


def _get_game_result(board: chess.Board) -> str | None:
    """Return PGN result string if the game is over, else None."""
    if board.is_checkmate():
        return "0-1" if board.turn == chess.WHITE else "1-0"
    if board.is_stalemate() or board.is_insufficient_material() or board.is_seventyfive_moves() or board.is_fivefold_repetition():
        return "1/2-1/2"
    if board.is_game_over():
        return board.result()
    return None


def get_move_explanation(label: str, h: dict, explanation: str, risk: str) -> str:
    """Generates a context-aware explanation based on the move's label and heuristics."""
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


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/game/{session_id}")
async def websocket_game(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"Client connected to WS game session: {session_id}")

    # Validate session exists
    if session_id not in active_games:
        logger.warning(f"Rejected WS connection: session {session_id} does not exist.")
        await websocket.close(code=4003)
        return

    if session_id not in active_game_colors:
        logger.warning(f"Rejected WS connection: session {session_id} has no registered player color.")
        await websocket.close(code=4003)
        return

    board = active_games[session_id]
    player_color = active_game_colors[session_id]

    # Send initial FEN
    await websocket.send_json({"type": "initial_fen", "fen": board.fen()})

    # Send initial recommendations if it is player's turn
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
                "recommendations": recs,
            })
        except Exception as e:
            logger.error(f"Error calculating initial recommendations: {e}")

    try:
        while True:
            data = await websocket.receive_json()

            # ----------------------------------------------------------------
            # Handle resign
            # ----------------------------------------------------------------
            if data.get("type") == "resign":
                result = "0-1" if player_color == "white" else "1-0"
                _finish_game(session_id, result, board)
                player_color_val = active_game_colors.get(session_id, "white")
                db = _get_db()
                try:
                    move_records = db.query(MoveRecord).filter(MoveRecord.game_id == session_id).all()
                    white_acc, black_acc = _accuracy_from_moves(move_records)
                finally:
                    db.close()

                await websocket.send_json({
                    "type": "game_over",
                    "result": result,
                    "reason": "resign",
                    "white_accuracy": round(white_acc, 2),
                    "black_accuracy": round(black_acc, 2),
                })
                continue

            # ----------------------------------------------------------------
            # Handle normal move
            # ----------------------------------------------------------------
            if data.get("type") != "move":
                continue

            uci = data.get("uci")
            if not uci:
                await websocket.send_json({"type": "error", "message": "UCI move missing"})
                continue

            try:
                move = chess.Move.from_uci(uci)
            except ValueError:
                await websocket.send_json({"type": "error", "message": "Invalid UCI format"})
                continue

            if move not in board.legal_moves:
                await websocket.send_json({"type": "error", "message": "Illegal move"})
                continue

            # Authoritative is_white before the move is applied
            is_white = (board.turn == chess.WHITE)

            # Evaluate BEFORE
            score_before = None
            try:
                score_before = get_evaluation(board.fen())
            except Exception as e:
                logger.error(f"Error evaluating position before move: {e}")

            # Check if unexpected
            is_unexpected = False
            try:
                top_moves = get_top_moves(board.fen(), n=1)
                if top_moves and uci != top_moves[0]["move_uci"]:
                    is_unexpected = True
            except Exception as e:
                logger.error(f"Error checking top recommended move: {e}")

            # Heuristics before push
            phase = get_phase(board.fullmove_number)
            h = analyze_move_heuristics(board, move, phase)
            explanation_raw, risk_raw = generate_explanation_and_risk(h)

            # Apply move
            san = board.san(move)
            board.push(move)

            # Evaluate AFTER
            score_after = None
            try:
                score_after = get_evaluation(board.fen())
            except Exception as e:
                logger.error(f"Error evaluating position after move: {e}")

            # Label & explanation
            player_color = active_game_colors[session_id]
            is_opponent_move = (
                (player_color == "white" and not is_white)
                or (player_color == "black" and is_white)
            )

            if score_before is None or score_after is None:
                label = "Unknown"
                final_explanation = "Gagal mengevaluasi langkah karena masalah pada engine catur."
            else:
                label = label_move(score_before, score_after, is_white, is_unexpected)
                final_explanation = get_move_explanation(label, h, explanation_raw, risk_raw)

            # Track ply count
            ply = active_move_counts.get(session_id, 0) + 1
            active_move_counts[session_id] = ply
            move_number = (ply + 1) // 2   # full-move number

            # Persist move to DB (best-effort)
            _save_move_to_db(
                session_id=session_id,
                move_number=move_number,
                san=san,
                uci=uci,
                label=label,
                score_before=score_before,
                score_after=score_after,
                is_white=is_white,
                phase=phase,
                explanation=final_explanation,
            )

            # Recommendations for next turn
            recs: list = []
            next_is_white = (board.turn == chess.WHITE)
            is_next_player_turn = (
                (player_color == "white" and next_is_white)
                or (player_color == "black" and not next_is_white)
            )
            if is_next_player_turn:
                try:
                    recs = recommend_moves(board.fen(), next_is_white)
                except Exception as e:
                    logger.error(f"Error calculating recommendations: {e}")

            # Opponent analysis
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
                    "best_response": best_response_str,
                }

            # Check game-over
            game_result = _get_game_result(board)
            if game_result:
                _finish_game(session_id, game_result, board)
                db = _get_db()
                try:
                    move_records = db.query(MoveRecord).filter(MoveRecord.game_id == session_id).all()
                    white_acc, black_acc = _accuracy_from_moves(move_records)
                finally:
                    db.close()

                # First send the final move_result so the board updates
                await websocket.send_json({
                    "type": "move_result",
                    "san": san,
                    "label": label,
                    "score_before": score_before,
                    "score_after": score_after,
                    "explanation": final_explanation,
                    "current_fen": board.fen(),
                    "recommendations": recs,
                    "opponent_analysis": opponent_analysis,
                })
                # Then send game_over signal
                reason = "checkmate" if board.is_checkmate() else "draw"
                await websocket.send_json({
                    "type": "game_over",
                    "result": game_result,
                    "reason": reason,
                    "white_accuracy": round(white_acc, 2),
                    "black_accuracy": round(black_acc, 2),
                })
                continue

            # Normal response
            await websocket.send_json({
                "type": "move_result",
                "san": san,
                "label": label,
                "score_before": score_before,
                "score_after": score_after,
                "explanation": final_explanation,
                "current_fen": board.fen(),
                "recommendations": recs,
                "opponent_analysis": opponent_analysis,
            })

    except WebSocketDisconnect:
        logger.info(f"Client disconnected from WS game session: {session_id}")
    except Exception as e:
        logger.error(f"Unhandled error in WS game session {session_id}: {e}", exc_info=True)
