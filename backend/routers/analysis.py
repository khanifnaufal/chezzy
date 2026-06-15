from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DbSession
import logging

from backend.db.database import get_db
from backend.analysis.aggregator import get_game_count, get_accuracy_trend
from backend.analysis.phase_analyzer import analyze_phase_weakness
from backend.analysis.blunder_analyzer import analyze_blunder_patterns

logger = logging.getLogger("chess_analyzer")

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

@router.get("/patterns")
def get_patterns(db: DbSession = Depends(get_db)):
    """
    Endpoint untuk mendapatkan hasil gabungan analisis pola permainan.
    Jika total game < 10, hanya mengembalikan game_count agar frontend bisa menampilkan banner pengunci.
    """
    try:
        game_count = get_game_count(db)

        if game_count < 10:
            return {
                "game_count": game_count,
                "phase_weakness": None,
                "blunder_patterns": None,
                "accuracy_trend": None
            }

        phase_weakness = analyze_phase_weakness(db)
        blunder_patterns = analyze_blunder_patterns(db)
        accuracy_trend = get_accuracy_trend(db)

        return {
            "game_count": game_count,
            "phase_weakness": phase_weakness,
            "blunder_patterns": blunder_patterns,
            "accuracy_trend": accuracy_trend
        }
    except Exception as e:
        logger.error(f"Failed to generate chess patterns analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal menghasilkan analisis pola permainan catur.")
