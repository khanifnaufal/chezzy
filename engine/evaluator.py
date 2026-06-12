import os
import shutil
import chess
import chess.engine
from dotenv import load_dotenv

# Load environmental variables from .env
load_dotenv()

class StockfishNotFoundError(FileNotFoundError):
    """Exception raised when Stockfish binary is not found or is invalid."""
    pass

def _get_stockfish_path() -> str:
    """
    Resolves the path to the Stockfish executable.
    Checks:
    1. STOCKFISH_PATH environment variable (set via environment or .env file)
    2. System PATH (via shutil.which)
    """
    path = os.getenv("STOCKFISH_PATH")
    if path:
        # Check if the configured path actually exists and is a file
        if os.path.isfile(path):
            return path
        # Also check if it's in the current path or system path if just a filename was given
        resolved = shutil.which(path)
        if resolved:
            return resolved
            
    # Search in PATH for standard names
    for name in ["stockfish", "stockfish.exe", "stockfish-windows", "stockfish-macos"]:
        found = shutil.which(name)
        if found:
            return found
            
    return None

def get_evaluation(board: chess.Board, depth: int = 15) -> dict:
    """
    Evaluates the current chess board position using Stockfish.
    
    Args:
        board (chess.Board): The python-chess board object.
        depth (int): The search depth for evaluation (default: 15).
        
    Returns:
        dict: A dictionary containing the score details:
            {
                "type": "cp" | "mate",
                "value": int
            }
            - "cp": Centipawn score from White's perspective (e.g. +100 for white advantage, -50 for black).
            - "mate": Moves to mate from White's perspective (e.g. +3 for White mating in 3, -2 for Black mating in 2).
            
    Raises:
        StockfishNotFoundError: If Stockfish binary is not found or executable.
        RuntimeError: If engine analysis encounters an error.
    """
    path = _get_stockfish_path()
    if not path:
        raise StockfishNotFoundError(
            "Stockfish binary could not be found. Please check your installation and ensure "
            "STOCKFISH_PATH is defined in your environment or .env file, or added to system PATH."
        )
        
    try:
        # Initialize the UCI engine
        with chess.engine.SimpleEngine.popen_uci(path) as engine:
            # Analyse position to the specified depth
            info = engine.analyse(board, chess.engine.Limit(depth=depth))
            
            # Extract score from White's perspective
            score = info["score"].white()
            
            if score.is_mate():
                return {
                    "type": "mate",
                    "value": score.mate()
                }
                
            # Fallback to centipawn score if not mate
            return {
                "type": "cp",
                "value": score.score()
            }
            
    except FileNotFoundError as e:
        raise StockfishNotFoundError(
            f"The specified Stockfish path '{path}' exists but could not be executed: {str(e)}"
        )
    except Exception as e:
        raise RuntimeError(f"Error during Stockfish evaluation: {str(e)}")
