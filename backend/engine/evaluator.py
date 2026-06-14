import os
import chess
import chess.engine
from backend.config import STOCKFISH_PATH

def get_engine() -> chess.engine.SimpleEngine:
    """
    Menginisialisasi dan menghubungkan ke executable Stockfish.
    Mengangkat FileNotFoundError jika path tidak valid atau Stockfish tidak ditemukan.
    """
    if not STOCKFISH_PATH:
        raise FileNotFoundError("Stockfish path is not configured. Please check STOCKFISH_PATH in your .env config.")
    
    if not os.path.exists(STOCKFISH_PATH):
        raise FileNotFoundError(f"Stockfish engine binary was not found at configured path: {STOCKFISH_PATH}")
    
    try:
        # Membuka koneksi ke Stockfish menggunakan popen_uci
        return chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    except Exception as e:
        raise RuntimeError(f"Error starting Stockfish engine: {str(e)}")

def get_evaluation(fen: str, depth: int = 15) -> int:
    """
    Mengembalikan nilai evaluasi centipawn (relatif terhadap White).
    Untuk mate, mengembalikan nilai ekuivalen centipawn tinggi (e.g. 10000 / -10000).
    """
    board = chess.Board(fen)
    with get_engine() as engine:
        info = engine.analyse(board, chess.engine.Limit(depth=depth))
        # Mendapatkan skor dari sudut pandang White
        white_score = info["score"].white()
        # Jika mate, representasikan dengan nilai centipawn 10000
        return white_score.score(mate_score=10000)

def get_top_moves(fen: str, n: int = 3, depth: int = 15) -> list:
    """
    Mengembalikan daftar top n moves beserta informasi uci, san, score, dan mate_in.
    Format return:
    [
        {
            "move_uci": str,
            "move_san": str,
            "score": int,
            "mate_in": int | None
        },
        ...
    ]
    """
    board = chess.Board(fen)
    with get_engine() as engine:
        # Menganalisis dengan multipv untuk mendapatkan n pilihan langkah terbaik
        info = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=n)
        
        # python-chess mengembalikan list untuk multipv yang diurutkan dari yang terbaik
        top_moves = []
        for entry in info:
            if "pv" not in entry or not entry["pv"]:
                continue
            
            # Langkah pertama pada variasi/PV ini
            move = entry["pv"][0]
            move_uci = move.uci()
            move_san = board.san(move)
            
            pov_score = entry["score"].white()
            score = pov_score.score(mate_score=10000)
            mate_in = pov_score.mate() # integer (positive if white mates, negative if black mates) or None
            
            top_moves.append({
                "move_uci": move_uci,
                "move_san": move_san,
                "score": score,
                "mate_in": mate_in
            })
            
        return top_moves
