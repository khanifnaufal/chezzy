import os
from dotenv import load_dotenv

# Load environmental variables from .env
load_dotenv()

# STOCKFISH_PATH: Can override via .env, default is empty string/None (will fallback to PATH search)
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "").strip().strip('"').strip("'")

# STOCKFISH_DEPTH: Can override via .env, default is 15
try:
    STOCKFISH_DEPTH = int(os.getenv("STOCKFISH_DEPTH", 15))
except (ValueError, TypeError):
    STOCKFISH_DEPTH = 15

# DB_PATH: Can override via .env, default is <project_root>/data/games.db
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(PROJECT_ROOT, "data", "games.db")
DB_PATH = os.getenv("DB_PATH", DEFAULT_DB_PATH).strip().strip('"').strip("'")
