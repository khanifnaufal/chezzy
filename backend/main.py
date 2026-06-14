import chess
import logging
import asyncio
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.recommender import recommend_moves
from backend.routers import ws
from backend.routers import game as game_router
from backend.db.database import init_db

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


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Welcome to Chess Analyzer API"}


@app.get("/api/test-engine")
def test_engine(
    fen: str = Query(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string posisi catur yang akan dianalisis"
    )
):
    """
    Endpoint sementara untuk memverifikasi fungsionalitas engine Stockfish.
    Menerima parameter FEN, mengevaluasi posisi tersebut, dan mengembalikan evaluasi numerik
    (centipawn) serta top 3 langkah terbaik.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Format FEN tidak valid. Silakan periksa kembali string FEN Anda."
        )

    try:
        evaluation = get_evaluation(fen, timeout=10.0)
        top_moves = get_top_moves(fen, n=3, timeout=10.0)
        return {"evaluation": evaluation, "top_moves": top_moves}
    except FileNotFoundError:
        logger.error("Stockfish binary not found or configuration failure", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen internal tidak tersedia."
        )
    except Exception:
        logger.error("Error occurred during chess analysis in test_engine", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat memproses analisis posisi catur."
        )


@app.get("/api/recommendations")
def get_recommendations(
    fen: str = Query(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string posisi catur untuk mendapatkan rekomendasi langkah"
    )
):
    """
    Endpoint untuk mendapatkan rekomendasi langkah lengkap dengan penjelasan
    heuristik (type, explanation, risk, is_best) dalam bahasa Indonesia.
    """
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(status_code=400, detail="Format FEN tidak valid.")

    try:
        is_white = board.turn == chess.WHITE
        recommendations = recommend_moves(fen, is_white)
        return {"fen": fen, "turn": "white" if is_white else "black", "recommendations": recommendations}
    except FileNotFoundError:
        logger.error("Stockfish binary not found or configuration failure", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen internal tidak tersedia."
        )
    except Exception:
        logger.error("Error occurred during chess recommendations calculation", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat memproses rekomendasi langkah."
        )


# Include routers
app.include_router(ws.router)
app.include_router(game_router.router)
