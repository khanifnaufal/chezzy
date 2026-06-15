from sqlalchemy.orm import Session as DbSession
from backend.analysis.aggregator import get_blunders

def classify_blunder(explanation: str, move_number: int) -> str:
    """
    Mengklasifikasikan blunder/mistake ke dalam salah satu kategori berikut:
    - hanging_piece
    - missed_tactic
    - king_safety
    - time_trouble
    - other
    """
    if not explanation:
        return "other"

    explanation_lower = explanation.lower()

    # 1. King Safety
    if any(k in explanation_lower for k in ["raja", "skak", "check", "rokade", "king", "keselamatan"]):
        return "king_safety"

    # 2. Hanging Piece
    if any(k in explanation_lower for k in ["gantung", "gratis", "free", "tidak terlindungi", "hanging", "material", "membiarkan"]):
        return "hanging_piece"

    # 3. Missed Tactic
    if any(k in explanation_lower for k in ["taktik", "lewatkan", "melewatkan", "fork", "pin", "skewer", "tusukan", "garpu", "tempo"]):
        return "missed_tactic"

    # 4. Time Trouble
    # Jika langkah di atas 35 (endgame) atau ada kata kunci waktu
    if any(k in explanation_lower for k in ["waktu", "terburu-buru", "time", "clock", "krisis"]) or move_number >= 35:
        return "time_trouble"

    return "other"

def analyze_blunder_patterns(db: DbSession):
    """
    Menganalisis pola blunder player dari semua game yang tersimpan.
    Membagi blunder ke dalam kategori taktis dan mengembalikan insight konkret.
    """
    blunders_and_mistakes = get_blunders(db)

    breakdown = {
        "hanging_piece": 0,
        "missed_tactic": 0,
        "king_safety": 0,
        "time_trouble": 0,
        "other": 0
    }

    for m in blunders_and_mistakes:
        cat = classify_blunder(m.explanation, m.move_number)
        breakdown[cat] += 1

    total_blunders = sum(breakdown.values())
    if total_blunders == 0:
        most_common = "none"
        insight = "Luar biasa! Anda tidak melakukan blunder atau mistake dalam game yang dianalisis. Pertahankan permainan solid Anda!"
    else:
        # Urutan prioritas jika jumlah sama
        priority = ["hanging_piece", "missed_tactic", "king_safety", "time_trouble", "other"]
        most_common = max(priority, key=lambda k: breakdown[k])

        # Buat insight konkret dalam bahasa Indonesia
        if most_common == "hanging_piece":
            insight = "Anda paling sering kehilangan perwira secara gratis (hanging piece). Selalu periksa apakah perwira Anda terlindungi dengan aman sebelum memindahkannya."
        elif most_common == "missed_tactic":
            insight = "Anda sering melewatkan peluang taktis atau kalkulasi ancaman lawan (missed tactic). Pertajam insting taktis Anda dengan latihan puzzle catur rutin."
        elif most_common == "king_safety":
            insight = "Keamanan raja (king safety) adalah kelemahan utama Anda. Prioritaskan rokade lebih awal dan waspadai lajur terbuka di sekitar posisi raja Anda."
        elif most_common == "time_trouble":
            insight = "Anda cenderung membuat kesalahan di akhir permainan (time trouble). Latihlah manajemen waktu Anda saat berpikir atau gunakan kontrol waktu yang lebih lambat."
        else:
            insight = "Anda melakukan beberapa kesalahan posisional dan struktural. Cobalah meninjau kembali game Anda untuk memahami rencana permainan jangka panjang."

    return {
        "breakdown": breakdown,
        "most_common": most_common,
        "insight": insight
    }
