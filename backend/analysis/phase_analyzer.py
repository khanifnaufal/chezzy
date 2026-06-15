from sqlalchemy.orm import Session as DbSession
from backend.analysis.aggregator import get_player_moves

def analyze_phase_weakness(db: DbSession):
    """
    Menganalisis performa player pada setiap fase (opening/middlegame/endgame).
    Mengembalikan statistik akurasi, blunder, mistake, serta fase terlemah dan insight natural language.
    """
    player_moves = get_player_moves(db)

    phases = {
        "opening": {"losses": [], "blunders": 0, "mistakes": 0},
        "middlegame": {"losses": [], "blunders": 0, "mistakes": 0},
        "endgame": {"losses": [], "blunders": 0, "mistakes": 0}
    }

    for m in player_moves:
        phase_name = m.phase.lower() if m.phase else None
        if phase_name not in phases:
            continue

        # Hitung blunder & mistake
        if m.label == "Blunder":
            phases[phase_name]["blunders"] += 1
        elif m.label == "Mistake":
            phases[phase_name]["mistakes"] += 1

        # Kumpulkan kerugian centipawn (cp) untuk akurasi
        if m.score_before is not None and m.score_after is not None:
            if m.is_white:
                loss = max(0.0, m.score_before - m.score_after)
            else:
                loss = max(0.0, m.score_after - m.score_before)
            phases[phase_name]["losses"].append(loss)

    # Hitung akurasi per fase
    result = {}
    for phase_name, data in phases.items():
        losses = data["losses"]
        if not losses:
            accuracy = 100.0
        else:
            avg_loss = sum(losses) / len(losses)
            accuracy = max(0.0, min(100.0, 100.0 - avg_loss / 10.0))

        result[phase_name] = {
            "accuracy": round(accuracy, 1),
            "blunders": data["blunders"],
            "mistakes": data["mistakes"]
        }

    # Cari fase terlemah (akurasi terendah)
    weakest_phase = "opening"
    min_acc = result["opening"]["accuracy"]

    for p in ["middlegame", "endgame"]:
        if result[p]["accuracy"] < min_acc:
            min_acc = result[p]["accuracy"]
            weakest_phase = p

    # Buat kalimat insight konkret
    if weakest_phase == "opening":
        insight = f"Fase Opening adalah kelemahan utama Anda dengan akurasi rata-rata {result['opening']['accuracy']:.1f}%. Anda sering membuat kesalahan di awal permainan. Fokuslah pada pengembangan perwira secara aman dan pelajari teori pembukaan standar untuk mengontrol petak pusat."
    elif weakest_phase == "middlegame":
        insight = f"Fase Middlegame adalah kelemahan utama Anda dengan akurasi rata-rata {result['middlegame']['accuracy']:.1f}%. Banyak blunder taktis terjadi di tengah papan. Pertajam kalkulasi dan taktik Anda dengan rutin menyelesaikan puzzle catur."
    else:
        insight = f"Fase Endgame adalah kelemahan utama Anda dengan akurasi rata-rata {result['endgame']['accuracy']:.1f}%. Anda cenderung kesulitan saat jumlah perwira di papan sudah sedikit. Pelajari prinsip dasar akhir permainan seperti oposisi raja dan promosi pion."

    return {
        "opening": result["opening"],
        "middlegame": result["middlegame"],
        "endgame": result["endgame"],
        "weakest_phase": weakest_phase,
        "insight": insight
    }
