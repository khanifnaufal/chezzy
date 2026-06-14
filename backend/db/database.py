from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from backend.config import DATABASE_URL
from backend.db.models import Base
import logging

logger = logging.getLogger("chess_analyzer")

# ---------------------------------------------------------------------------
# Engine & Session Factory
# ---------------------------------------------------------------------------
# Jika DATABASE_URL belum dikonfigurasi, gunakan SQLite in-memory sebagai fallback
# agar server tetap bisa berjalan tanpa PostgreSQL.
_effective_url = DATABASE_URL if DATABASE_URL else "sqlite:///./chess_dev.db"

if not DATABASE_URL:
    logger.warning(
        "DATABASE_URL not set in .env — falling back to SQLite (chess_dev.db). "
        "Data will NOT be persisted across restarts in a reliable way."
    )

engine = create_engine(
    _effective_url,
    # pool_pre_ping agar koneksi stale tidak dipakai kembali
    pool_pre_ping=True,
    # Untuk SQLite perlu flag khusus karena tidak mendukung multi-thread check
    connect_args={"check_same_thread": False} if _effective_url.startswith("sqlite") else {},
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
