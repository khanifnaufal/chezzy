def label_move(score_before: int, score_after: int, is_white: bool, is_unexpected: bool = False) -> str:
    """
    Melabeli kualitas langkah berdasarkan skor evaluasi sebelum dan sesudah langkah.
    
    Threshold:
    - Brilliant  : selisih positif > 50cp + move tidak terduga (is_unexpected=True)
    - Good       : selisih kerugian < 20cp
    - Inaccuracy : selisih kerugian 20-100cp
    - Mistake    : selisih kerugian 100-300cp
    - Blunder    : selisih kerugian > 300cp
    """
    # Menghitung keuntungan (gain) dan kerugian (loss) relatif terhadap pemain yang melangkah
    if is_white:
        gain = score_after - score_before
        loss = score_before - score_after
    else:
        gain = score_before - score_after
        loss = score_after - score_before

    # Brilliant: selisih positif > 50cp dan ditandai sebagai langkah tidak terduga
    if gain > 50 and is_unexpected:
        return "Brilliant"
    
    # Excellent: selisih positif > 50cp tetapi bukan langkah tidak terduga
    if gain > 50:
        return "Excellent"
    
    # Blunder: kerugian > 300cp
    if loss > 300:
        return "Blunder"
    # Mistake: kerugian 100-300cp
    elif 100 <= loss <= 300:
        return "Mistake"
    # Inaccuracy: kerugian 20-100cp
    elif 20 <= loss < 100:
        return "Inaccuracy"
    # Good: kerugian < 20cp
    else:
        return "Good"

def get_phase(move_number: int) -> str:
    """
    Mendapatkan fase permainan catur berdasarkan nomor langkah saat ini.
    - opening: 1-15
    - middlegame: 16-35
    - endgame: 36+
    """
    if move_number <= 15:
        return "opening"
    elif move_number <= 35:
        return "middlegame"
    else:
        return "endgame"
