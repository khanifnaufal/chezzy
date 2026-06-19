from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from backend.config import DATABASE_URL
from backend.db.models import Base
import logging

logger = logging.getLogger("chess_analyzer")

# ---------------------------------------------------------------------------
# Engine & Session Factory
# ---------------------------------------------------------------------------
_effective_url = DATABASE_URL if DATABASE_URL else "sqlite:///./chess_dev.db"

if not DATABASE_URL:
    logger.warning(
        "DATABASE_URL not set in .env — falling back to SQLite (chess_dev.db). "
        "Data will NOT be persisted across restarts in a reliable way."
    )

# SQLAlchemy's synchronous create_engine requires a synchronous driver (psycopg2)
# while the DATABASE_URL environment variable might specify an asynchronous driver (asyncpg).
if _effective_url.startswith("postgresql+asyncpg://"):
    _engine_url = _effective_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
elif _effective_url.startswith("postgresql://"):
    _engine_url = _effective_url.replace("postgresql://", "postgresql+psycopg2://")
else:
    _engine_url = _effective_url

engine = create_engine(
    _engine_url,
    # pool_pre_ping agar koneksi stale tidak dipakai kembali
    pool_pre_ping=True,
    # Untuk SQLite perlu flag khusus karena tidak mendukung multi-thread check
    connect_args={"check_same_thread": False} if _engine_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def init_db() -> None:
    """Membuat semua tabel yang didefinisikan di models.py jika belum ada."""
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialised (create_all completed).")


def get_db():
    """
    FastAPI dependency yang menyediakan satu database session per request.

    Usage:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_game(
    db: Session,
    game_id: str,
    white_player: str,
    black_player: str,
    result: str = None,
    pgn_raw: str = None,
    white_accuracy: float = None,
    black_accuracy: float = None,
    user_id: str = None
):
    """
    Menyimpan atau memperbarui data game di database.
    Menerima parameter user_id (UUID string) untuk diasosiasikan dengan game.
    """
    from backend.db.models import Game

    game_row = db.query(Game).filter(Game.id == game_id).first()
    if game_row:
        game_row.white_player = white_player
        game_row.black_player = black_player
        if result is not None:
            game_row.result = result
        if pgn_raw is not None:
            game_row.pgn_raw = pgn_raw
        if white_accuracy is not None:
            game_row.white_accuracy = white_accuracy
        if black_accuracy is not None:
            game_row.black_accuracy = black_accuracy
        if user_id is not None:
            game_row.user_id = user_id
    else:
        game_row = Game(
            id=game_id,
            white_player=white_player,
            black_player=black_player,
            result=result,
            pgn_raw=pgn_raw,
            white_accuracy=white_accuracy,
            black_accuracy=black_accuracy,
            user_id=user_id
        )
        db.add(game_row)

    try:
        db.commit()
        db.refresh(game_row)
    except Exception as e:
        db.rollback()
        logger.error(f"Error saving game {game_id} to DB: {e}", exc_info=True)
        raise e

    return game_row

