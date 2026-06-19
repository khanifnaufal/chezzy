from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text,
    DateTime, ForeignKey, func
)
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Game(Base):
    """Menyimpan data partai catur yang sudah selesai."""
    __tablename__ = "games"

    id             = Column(String, primary_key=True, index=True)   # sama dengan session_id
    white_player   = Column(String, nullable=False, default="Player")
    black_player   = Column(String, nullable=False, default="Bot")
    date           = Column(DateTime(timezone=True), server_default=func.now())
    result         = Column(String, nullable=True)                  # "1-0" / "0-1" / "1/2-1/2"
    pgn_raw        = Column(Text, nullable=True)
    white_accuracy = Column(Float, nullable=True)
    black_accuracy = Column(Float, nullable=True)
    user_id        = Column(String, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    moves    = relationship("MoveRecord", back_populates="game", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="game", cascade="all, delete-orphan")


class MoveRecord(Base):
    """Menyimpan setiap langkah beserta evaluasi Stockfish."""
    __tablename__ = "moves"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    game_id      = Column(String, ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    move_number  = Column(Integer, nullable=False)
    san          = Column(String, nullable=False)
    uci          = Column(String, nullable=False)
    label        = Column(String, nullable=True)     # Brilliant / Excellent / Good / …
    score_before = Column(Float,  nullable=True)     # centipawn sebelum langkah
    score_after  = Column(Float,  nullable=True)     # centipawn sesudah langkah
    is_white     = Column(Boolean, nullable=False)
    phase        = Column(String, nullable=True)     # opening / middlegame / endgame
    explanation  = Column(Text, nullable=True)

    game = relationship("Game", back_populates="moves")


class Session(Base):
    """Melacak sesi game yang sedang aktif."""
    __tablename__ = "sessions"

    id           = Column(String, primary_key=True, index=True)   # sama dengan session_id
    game_id      = Column(String, ForeignKey("games.id", ondelete="SET NULL"), nullable=True, index=True)
    player_color = Column(String, nullable=False, default="white")
    current_fen  = Column(Text, nullable=True)
    is_active    = Column(Boolean, nullable=False, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    game = relationship("Game", back_populates="sessions")
