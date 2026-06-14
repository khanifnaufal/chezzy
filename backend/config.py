import os
from dotenv import load_dotenv

# Load environmental variables from .env
load_dotenv()

# STOCKFISH_PATH: Path to the Stockfish executable binary
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "").strip().strip('"').strip("'")

# STOCKFISH_DEPTH: Kedalaman pencarian analisis engine Stockfish (Default: 15)
try:
    STOCKFISH_DEPTH = int(os.getenv("STOCKFISH_DEPTH", 15))
except (ValueError, TypeError):
    STOCKFISH_DEPTH = 15

# DATABASE_URL: PostgreSQL connection URL (e.g., postgresql://user:password@localhost:5432/db)
DATABASE_URL = os.getenv("DATABASE_URL", "").strip().strip('"').strip("'")
