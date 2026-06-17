import chess
import logging
import asyncio
import uuid
from fastapi import FastAPI, Query, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text

from backend.engine.evaluator import get_evaluation, get_top_moves, get_engine
from backend.engine.recommender import recommend_moves
from backend.routers import ws
from backend.routers import game as game_router
from backend.db.database import init_db, get_db

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chess_analyzer")

app = FastAPI(
    title="Chess Analyzer API",
    description="Backend service for Chess Analyzer using Stockfish engine and python-chess.",
    version="1.0.0"
)

# CORS Middleware — allow Next.js frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request-level timeout middleware (prevents thread starvation on hang)
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    try:
        return await asyncio.wait_for(call_next(request), timeout=15.0)
    except asyncio.TimeoutError:
        logger.error(f"Request timeout for endpoint: {request.url.path}")
        return JSONResponse(
            status_code=504,
            content={"detail": "Batas waktu permintaan terlampaui. Server membutuhkan waktu terlalu lama untuk merespons."}
        )


@app.on_event("startup")
def on_startup():
    """Initialise database tables on server start."""
    try:
        init_db()
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}", exc_info=True)
        logger.warning("Server will continue without DB persistence.")


# Pydantic input model for FEN validation
class FenInput(BaseModel):
    fen: str = Field(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string posisi catur yang akan dianalisis"
    )

    @field_validator("fen")
    @classmethod
    def check_fen(cls, v: str) -> str:
        try:
            chess.Board(v)
        except ValueError:
            raise ValueError("Format FEN tidak valid. Silakan periksa kembali string FEN Anda.")
        return v


@app.get("/")
def read_root():
    try:
        return {"status": "ok", "message": "Welcome to Chess Analyzer API"}
    except Exception as e:
        logger.error(f"Error in root endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal pada server.")


@app.get("/api/test-engine")
def test_engine(query: FenInput = Depends()):
    """
    Endpoint untuk memverifikasi fungsionalitas engine Stockfish.
    Menerima parameter FEN (divalidasi dengan Pydantic), mengevaluasi posisi tersebut,
    dan mengembalikan evaluasi serta top 3 langkah terbaik.
    """
    fen = query.fen
    try:
        evaluation = get_evaluation(fen, timeout=10.0)
        top_moves = get_top_moves(fen, n=3, timeout=10.0)
        return {"evaluation": evaluation, "top_moves": top_moves}
    except FileNotFoundError as e:
        logger.error(f"Stockfish binary not found: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen Stockfish tidak tersedia di path."
        )
    except Exception as e:
        logger.error(f"Error occurred during chess analysis in test_engine: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat memproses analisis posisi catur."
        )


@app.get("/api/recommendations")
def get_recommendations(query: FenInput = Depends()):
    """
    Endpoint untuk mendapatkan rekomendasi langkah lengkap dengan penjelasan
    heuristik (type, explanation, risk, is_best) dalam bahasa Indonesia.
    """
    fen = query.fen
    try:
        board = chess.Board(fen)
        is_white = board.turn == chess.WHITE
        recommendations = recommend_moves(fen, is_white)
        return {"fen": fen, "turn": "white" if is_white else "black", "recommendations": recommendations}
    except FileNotFoundError as e:
        logger.error(f"Stockfish binary not found in recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen Stockfish tidak tersedia di path."
        )
    except Exception as e:
        logger.error(f"Error occurred during chess recommendations calculation: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat memproses rekomendasi langkah."
        )


@app.get("/api/health")
def health_check(db = Depends(get_db)):
    """
    Endpoint untuk memeriksa kesehatan sistem (koneksi Database + status Stockfish).
    """
    db_status = "unhealthy"
    db_error = None
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_error = str(e)
        logger.error(f"Health check: DB connection failed: {e}", exc_info=True)

    stockfish_status = "unhealthy"
    stockfish_error = None
    try:
        with get_engine() as engine:
            stockfish_status = "healthy"
    except Exception as e:
        stockfish_error = str(e)
        logger.error(f"Health check: Stockfish engine failed: {e}", exc_info=True)

    if db_status != "healthy" or stockfish_status != "healthy":
        return JSONResponse(
            status_code=500,
            content={
                "status": "unhealthy",
                "database": {"status": db_status, "error": db_error},
                "stockfish": {"status": stockfish_status, "error": stockfish_error}
            }
        )

    return {
        "status": "healthy",
        "database": {"status": db_status},
        "stockfish": {"status": stockfish_status}
    }


# Include routers
from backend.routers import analysis as analysis_router

app.include_router(ws.router)
app.include_router(game_router.router)
app.include_router(game_router.games_router)
app.include_router(game_router.hint_router)
app.include_router(game_router.practice_router)
app.include_router(analysis_router.router)




