import chess
import logging
import asyncio
import uuid
from typing import Literal
from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from pydantic import BaseModel
from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.recommender import recommend_moves
from backend.routers import ws

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chess_analyzer")

app = FastAPI(
    title="Chess Analyzer API",
    description="Backend service for Chess Analyzer using Stockfish engine and python-chess.",
    version="1.0.0"
)

# Menambahkan CORS Middleware agar bisa diakses oleh Next.js frontend nantinya.
# Karena menggunakan allow_credentials=True, origins TIDAK BOLEH bernilai ["*"].
# Kami menggunakan origin spesifik "http://localhost:3000" untuk masa development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware untuk menangani request-level timeout (mencegah thread starvation jika ada proses hang)
@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    try:
        # Enforce a 15-second request timeout limit
        return await asyncio.wait_for(call_next(request), timeout=15.0)
    except asyncio.TimeoutError:
        logger.error(f"Request timeout occurred for endpoint: {request.url.path}")
        return JSONResponse(
            status_code=504,
            content={"detail": "Batas waktu permintaan terlampaui. Server membutuhkan waktu terlalu lama untuk merespons."}
        )

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
    # Validasi format FEN menggunakan python-chess
    try:
        board = chess.Board(fen)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Format FEN tidak valid. Silakan periksa kembali string FEN Anda."
        )

    try:
        # Mendapatkan evaluasi saat ini dengan timeout pencarian 10 detik
        evaluation = get_evaluation(fen, timeout=10.0)
        
        # Mendapatkan top 3 move menggunakan evaluator dengan timeout pencarian 10 detik
        top_moves = get_top_moves(fen, n=3, timeout=10.0)
        
        return {
            "evaluation": evaluation,
            "top_moves": top_moves
        }
    except FileNotFoundError as e:
        logger.error("Stockfish binary not found or configuration failure", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen internal tidak tersedia."
        )
    except Exception as e:
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
        raise HTTPException(
            status_code=400,
            detail="Format FEN tidak valid."
        )

    try:
        # Menentukan turn (apakah giliran Putih yang melangkah)
        is_white = board.turn == chess.WHITE
        
        # Mendapatkan rekomendasi langkah lengkap dengan penjelasan
        recommendations = recommend_moves(fen, is_white)
        
        return {
            "fen": fen,
            "turn": "white" if is_white else "black",
            "recommendations": recommendations
        }
    except FileNotFoundError as e:
        logger.error("Stockfish binary not found or configuration failure", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Konfigurasi engine catur gagal. Komponen internal tidak tersedia."
        )
    except Exception as e:
        logger.error("Error occurred during chess recommendations calculation", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Terjadi kesalahan internal saat memproses rekomendasi langkah."
        )

# Include the WebSocket router
app.include_router(ws.router)

class StartGameRequest(BaseModel):
    playerColor: Literal["white", "black"] = "white"

@app.post("/api/game/start")
def start_game(request: StartGameRequest):
    """
    Endpoint untuk memulai game baru. Menghasilkan session_id unik
    dan menginisialisasi papan catur di in-memory active_games.
    """
    session_id = str(uuid.uuid4())
    ws.active_games[session_id] = chess.Board()
    
    return {
        "session_id": session_id,
        "id": session_id,
        "fen": ws.active_games[session_id].fen(),
        "playerColor": request.playerColor,
        "moves": [],
        "status": "active"
    }
