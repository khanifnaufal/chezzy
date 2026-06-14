import chess
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.engine.evaluator import get_evaluation, get_top_moves
from backend.engine.recommender import recommend_moves

app = FastAPI(
    title="Chess Analyzer API",
    description="Backend service for Chess Analyzer using Stockfish engine and python-chess.",
    version="1.0.0"
)

# Menambahkan CORS Middleware agar bisa diakses oleh Next.js frontend nantinya
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
        # Mendapatkan evaluasi saat ini (centipawns)
        evaluation = get_evaluation(fen)
        
        # Mendapatkan top 3 move menggunakan evaluator
        top_moves = get_top_moves(fen, n=3)
        
        return {
            "evaluation": evaluation,
            "top_moves": top_moves
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Konfigurasi engine gagal: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan saat memproses analisis: {str(e)}"
        )

@app.get("/api/recommendations")
def get_recommendations(
    fen: str = Query(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        description="FEN string posisi catur untuk mendapatkan rekomendasi langkah"
    )
):
    """
    Endpoint tambahan untuk menguji fungsi recommender.py yang menghasilkan tipe langkah,
    penjelasan heuristik, dan risiko dalam bahasa Indonesia.
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
        raise HTTPException(
            status_code=500,
            detail=f"Konfigurasi engine gagal: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Terjadi kesalahan: {str(e)}"
        )
