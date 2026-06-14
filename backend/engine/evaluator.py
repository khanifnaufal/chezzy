import os
import time
import chess
import chess.engine
from backend.config import STOCKFISH_PATH

class CircuitBreaker:
    """
    Pola Circuit Breaker untuk menghentikan pemanggilan engine Stockfish secara cepat
    jika mengalami kegagalan berturut-turut (misal: timeout atau file tidak ditemukan).
    """
    def __init__(self, failure_threshold: int = 3, recovery_time: float = 30.0):
        self.failure_threshold = failure_threshold
        self.recovery_time = recovery_time
        self.failure_count = 0
        self.state = "CLOSED"  # CLOSED, OPEN, HALF-OPEN
        self.last_state_change = 0.0

    def check_state(self):
        if self.state == "OPEN":
            # Cek apakah masa pendinginan (recovery time) telah terlewati
            if time.time() - self.last_state_change > self.recovery_time:
                self.state = "HALF-OPEN"
                self.last_state_change = time.time()
            else:
                raise RuntimeError(
                    "Circuit breaker sedang OPEN. Engine Stockfish sementara tidak tersedia "
                    "karena kegagalan beruntun."
                )

    def record_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
        self.last_state_change = time.time()

    def record_failure(self):
        self.failure_count += 1
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.last_state_change = time.time()

# Inisialisasi global Circuit Breaker
engine_breaker = CircuitBreaker()

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

def get_evaluation(fen: str, depth: int = 15, timeout: float = 10.0) -> int:
    """
    Mengembalikan nilai evaluasi centipawn (relatif terhadap White).
    Menggunakan limit waktu pencarian (timeout) untuk mencegah hang.
    """
    engine_breaker.check_state()
    board = chess.Board(fen)
    try:
        with get_engine() as engine:
            # Tetapkan limit berdasarkan depth dan timeout
            limit = chess.engine.Limit(time=timeout, depth=depth)
            info = engine.analyse(board, limit)
            
            # Mendapatkan skor dari sudut pandang White
            white_score = info["score"].white()
            score = white_score.score(mate_score=10000)
            
            engine_breaker.record_success()
            return score
    except Exception as e:
        engine_breaker.record_failure()
        raise e

def get_top_moves(fen: str, n: int = 3, depth: int = 15, timeout: float = 10.0) -> list:
    """
    Mengembalikan daftar top n moves beserta informasi uci, san, score, dan mate_in.
    Menggunakan limit waktu pencarian (timeout) untuk mencegah hang.
    """
    engine_breaker.check_state()
    board = chess.Board(fen)
    try:
        with get_engine() as engine:
            # Tetapkan limit berdasarkan depth dan timeout
            limit = chess.engine.Limit(time=timeout, depth=depth)
            info = engine.analyse(board, limit, multipv=n)
            
            top_moves = []
            for entry in info:
                if "pv" not in entry or not entry["pv"]:
                    continue
                
                move = entry["pv"][0]
                move_uci = move.uci()
                move_san = board.san(move)
                
                pov_score = entry["score"].white()
                score = pov_score.score(mate_score=10000)
                mate_in = pov_score.mate()
                
                top_moves.append({
                    "move_uci": move_uci,
                    "move_san": move_san,
                    "score": score,
                    "mate_in": mate_in
                })
                
            engine_breaker.record_success()
            return top_moves
    except Exception as e:
        engine_breaker.record_failure()
        raise e
