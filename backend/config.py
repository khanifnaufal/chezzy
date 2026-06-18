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

# SUPABASE_URL: URL of Supabase project
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().strip('"').strip("'")

# SUPABASE_KEY: Secret key (service_role format or sb_secret_xxx)
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip().strip('"').strip("'")

# SUPABASE_JWT_SECRET: Secret key for decoding user JWT
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip().strip('"').strip("'")

