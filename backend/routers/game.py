import chess
import uuid
import logging
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DbSession

from backend.db.database import get_db
from backend.db.models import Game, Session as SessionModel
from backend.routers import ws as ws_module

logger = logging.getLogger("chess_analyzer")

router = APIRouter(prefix="/api/game", tags=["game"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class StartGameRequest(BaseModel):
    playerColor: Literal["white", "black"] = "white"
    whitePlayer: str = "Player"
    blackPlayer: str = "Bot"


class ResignRequest(BaseModel):
    session_id: str


# ---------------------------------------------------------------------------
# POST /api/game/start
# ---------------------------------------------------------------------------

@router.post("/start")
def start_game(request: StartGameRequest, db: DbSession = Depends(get_db)):
    """
    Buat session baru, inisialisasi board in-memory, dan simpan record ke DB.
    Returns session_id yang digunakan untuk koneksi WebSocket.
    """
    session_id = str(uuid.uuid4())

    # Inisialisasi in-memory state (dipakai oleh ws.py)
    ws_module.active_games[session_id] = chess.Board()
    ws_module.active_game_colors[session_id] = request.playerColor
    ws_module.active_move_counts[session_id] = 0

    # Simpan Game record ke DB
    game_row = Game(
        id=session_id,
        white_player=request.whitePlayer if request.playerColor == "white" else request.blackPlayer,
        black_player=request.blackPlayer if request.playerColor == "white" else request.whitePlayer,
        result=None,
    )
    db.add(game_row)

    # Simpan Session record ke DB
    session_row = SessionModel(
        id=session_id,
        game_id=session_id,
        player_color=request.playerColor,
        current_fen=chess.Board().fen(),
        is_active=True,
    )
    db.add(session_row)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist new session to DB: {e}", exc_info=True)
        # Tetap kembalikan response agar game bisa dimainkan meski DB error
        # (akan fallback ke in-memory only)

    logger.info(f"New game session created: {session_id} ({request.playerColor})")

    return {
        "session_id": session_id,
        "id": session_id,
        "fen": chess.Board().fen(),
        "playerColor": request.playerColor,
        "moves": [],
        "status": "active",
    }


# ---------------------------------------------------------------------------
# POST /api/game/resign
# ---------------------------------------------------------------------------

@router.post("/resign")
def resign_game(request: ResignRequest, db: DbSession = Depends(get_db)):
    """
    Akhiri game dengan menyerah (resign).
    ws.py menangani penyimpanan game_over, endpoint ini hanya meneruskan sinyal
    resign ke board in-memory (jika ws belum menanganinya) dan mengembalikan
    konfirmasi ke klien.
    """
    session_id = request.session_id

    board = ws_module.active_games.get(session_id)
    player_color = ws_module.active_game_colors.get(session_id)

    if not board or not player_color:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan atau sudah selesai.")

    result = "0-1" if player_color == "white" else "1-0"

    # Simpan game ke DB via helper di ws.py
    ws_module._finish_game(session_id, result, board)

    # Hitung akurasi dari DB
    from backend.db.models import MoveRecord as MoveRecordModel
    move_records = db.query(MoveRecordModel).filter(MoveRecordModel.game_id == session_id).all()
    white_acc, black_acc = ws_module._accuracy_from_moves(move_records)

    return {
        "session_id": session_id,
        "result": result,
        "reason": "resign",
        "white_accuracy": round(white_acc, 2),
        "black_accuracy": round(black_acc, 2),
    }


# ---------------------------------------------------------------------------
# GET /api/games & GET /api/games/{game_id}
# ---------------------------------------------------------------------------

games_router = APIRouter(prefix="/api/games", tags=["games"])


@games_router.get("")
def list_games(db: DbSession = Depends(get_db)):
    """
    List semua game yang tersimpan di database, diurutkan dari yang terbaru.
    """
    try:
        games = db.query(Game).order_by(Game.date.desc()).all()
        return [
            {
                "game_id": g.id,
                "white": g.white_player,
                "black": g.black_player,
                "date": g.date.isoformat() if g.date else None,
                "result": g.result,
                "white_accuracy": g.white_accuracy,
                "black_accuracy": g.black_accuracy,
            }
            for g in games
        ]
    except Exception as e:
        logger.error(f"Error listing games: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal mengambil daftar game.")


@games_router.get("/{game_id}")
def get_game_detail(game_id: str, db: DbSession = Depends(get_db)):
    """
    Detail satu game beserta daftar moves-nya.
    """
    try:
        game = db.query(Game).filter(Game.id == game_id).first()
        if not game:
            raise HTTPException(status_code=404, detail="Game tidak ditemukan.")

        from backend.db.models import MoveRecord
        moves = db.query(MoveRecord).filter(MoveRecord.game_id == game_id).order_by(MoveRecord.id.asc()).all()

        return {
            "game_id": game.id,
            "white": game.white_player,
            "black": game.black_player,
            "date": game.date.isoformat() if game.date else None,
            "result": game.result,
            "white_accuracy": game.white_accuracy,
            "black_accuracy": game.black_accuracy,
            "moves": [
                {
                    "move_number": m.move_number,
                    "san": m.san,
                    "label": m.label,
                    "score_before": m.score_before,
                    "score_after": m.score_after,
                    "explanation": m.explanation,
                    "is_white": m.is_white,
                    "uci": m.uci,
                }
                for m in moves
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching game detail for {game_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal mengambil detail game.")

