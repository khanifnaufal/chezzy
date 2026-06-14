import chess
from backend.engine.evaluator import get_top_moves
from backend.engine.labeler import get_phase

# Pemetaan tipe perwira ke bahasa Indonesia
PIECE_NAMES = {
    chess.PAWN: "pion",
    chess.KNIGHT: "kuda",
    chess.BISHOP: "gajah",
    chess.ROOK: "benteng",
    chess.QUEEN: "menteri",
    chess.KING: "raja"
}

def analyze_move_heuristics(board: chess.Board, move: chess.Move, is_white: bool, phase: str) -> dict:
    """
    Menganalisis langkah catur menggunakan python-chess untuk mengekstrak data heuristik.
    """
    is_capture = board.is_capture(move)
    
    # Cek skak dengan menyimulasikan push langkah tersebut
    board.push(move)
    is_check = board.is_check()
    board.pop()
    
    is_castling = board.is_castling(move)
    
    piece = board.piece_at(move.from_square)
    piece_type = piece.piece_type if piece else None
    
    # Cek pengembangan perwira (hanya untuk Kuda/Gajah dari petak asal mereka)
    is_development = False
    if piece_type in (chess.KNIGHT, chess.BISHOP):
        if is_white:
            is_development = move.from_square in (chess.B1, chess.G1, chess.C1, chess.F1)
        else:
            is_development = move.from_square in (chess.B8, chess.G8, chess.C8, chess.F8)
            
    # Cek kontrol pusat (landing di petak D4, E4, D5, E5)
    center_squares = (chess.D4, chess.E4, chess.D5, chess.E5)
    lands_on_center = move.to_square in center_squares
    
    # Cek kondisi awal sebelum melangkah
    was_in_check = board.is_check()
    
    # Cek apakah perwira yang dipindahkan sedang di bawah ancaman lawan
    was_under_attack = board.is_attacked_by(not board.turn, move.from_square)
    
    # Klasifikasi tipe langkah
    if phase == "endgame":
        move_type = "Endgame"
    elif was_in_check or is_castling or (was_under_attack and piece_type != chess.PAWN):
        move_type = "Defensive"
    elif is_capture or is_check:
        move_type = "Taktik"
    else:
        move_type = "Posisional"
        
    return {
        "is_capture": is_capture,
        "is_check": is_check,
        "is_castling": is_castling,
        "is_development": is_development,
        "lands_on_center": lands_on_center,
        "was_in_check": was_in_check,
        "was_under_attack": was_under_attack,
        "piece_name": PIECE_NAMES.get(piece_type, "perwira"),
        "from_sq": chess.square_name(move.from_square),
        "to_sq": chess.square_name(move.to_square),
        "move_type": move_type
    }

def generate_explanation_and_risk(h: dict) -> tuple[str, str]:
    """
    Menghasilkan penjelasan 1-2 kalimat (explanation) dan potensi risiko (risk)
    berdasarkan hasil analisis heuristik langkah catur.
    """
    piece_name = h["piece_name"]
    to_sq = h["to_sq"]
    from_sq = h["from_sq"]
    
    # 1. Tipe Akhir Permainan (Endgame)
    if h["move_type"] == "Endgame":
        if h["is_capture"]:
            explanation = f"Langkah akhir permainan yang penting untuk memukul perwira lawan di {to_sq} dan menyederhanakan posisi papan."
            risk = "Mempercepat pertukaran perwira yang dapat menguntungkan struktur pion lawan jika tidak dihitung dengan teliti."
        elif h["is_check"]:
            explanation = f"Memberikan skak dengan {piece_name} ke {to_sq} untuk membatasi ruang gerak raja lawan di fase akhir permainan."
            risk = "Dapat memberikan tempo kepada raja lawan untuk bergerak menuju petak yang lebih aktif."
        else:
            explanation = f"Langkah krusial untuk menempatkan {piece_name} ke {to_sq} guna mengontrol ruang atau mendukung promosi pion Anda."
            risk = "Kehilangan tempo di fase akhir catur bisa sangat fatal dan mengubah jalannya permainan secara drastis."
            
    # 2. Tipe Bertahan (Defensive)
    elif h["move_type"] == "Defensive":
        if h["is_castling"]:
            explanation = "Mengamankan raja ke sudut papan melalui rokade sekaligus menghubungkan kedua benteng untuk koordinasi pertahanan."
            risk = "Langkah yang sangat aman, hampir tidak memiliki risiko taktis langsung."
        elif h["was_in_check"]:
            explanation = f"Menyelamatkan raja dari skak dengan memindahkan raja atau menghalangi serangan lawan menggunakan {piece_name} ke {to_sq}."
            risk = "Membatasi pilihan penempatan perwira Anda yang digunakan sebagai pelindung di area lainnya."
        else:
            explanation = f"Memindahkan {piece_name} yang terancam dari petak {from_sq} ke {to_sq} untuk menjaga keselamatan material Anda."
            risk = "Fokus pada langkah defensif ini mungkin mengurangi tekanan ofensif Anda terhadap pertahanan lawan."
            
    # 3. Tipe Taktik (Taktik)
    elif h["move_type"] == "Taktik":
        if h["is_capture"]:
            explanation = f"Langkah taktis memukul perwira lawan di {to_sq} untuk memenangkan material atau merusak struktur pertahanan lawan."
            risk = f"Membuka lajur atau diagonal baru di {to_sq} yang berpotensi dimanfaatkan oleh perwira lawan untuk menyerang balik."
        elif h["is_check"]:
            explanation = f"Melakukan skak dengan {piece_name} ke {to_sq} untuk merusak kenyamanan raja lawan dan merebut inisiatif serangan."
            risk = "Memindahkan perwira ini dapat melemahkan pertahanan di bagian papan yang Anda tinggalkan."
        else:
            explanation = f"Langkah taktis tajam menggunakan {piece_name} ke {to_sq} untuk menciptakan ancaman ganda atau kombinasi serangan."
            risk = "Langkah agresif ini membutuhkan akurasi tinggi; jika kalkulasi meleset, dapat berujung pada serangan balik musuh."
            
    # 4. Tipe Posisional (Posisional)
    else:
        if h["is_development"]:
            explanation = f"Mengembangkan perwira {piece_name} ke petak aktif {to_sq} untuk mengontrol ruang tengah dan mempersiapkan serangan."
            risk = f"Perwira di {to_sq} dapat menjadi sasaran pengusiran oleh pion lawan jika tidak didukung dengan baik."
        elif h["lands_on_center"]:
            explanation = f"Menempatkan {piece_name} di petak pusat {to_sq} untuk mendominasi kontrol ruang di tengah papan catur."
            risk = f"Petak pusat yang terbuka membuat {piece_name} Anda rentan terhadap tekanan tidak langsung dari perwira jarak jauh lawan."
        else:
            explanation = f"Langkah posisional solid untuk menempatkan {piece_name} di {to_sq} guna meningkatkan aktivitas dan koordinasi perwira Anda."
            risk = f"Langkah posisional yang relatif lambat, memberikan lawan waktu untuk merespons atau menyusun rencana pertahanan."
            
    return explanation, risk

def recommend_moves(fen: str, is_white: bool) -> list:
    """
    Mengambil top 3 langkah terbaik dari evaluator, kemudian menambahkan analisis tipe langkah,
    penjelasan heuristik (Indonesian), risiko, dan flag is_best.
    """
    # Ambil 3 pilihan langkah terbaik dari Stockfish (depth=15)
    top_moves = get_top_moves(fen, n=3, depth=15)
    
    board = chess.Board(fen)
    move_number = board.fullmove_number
    phase = get_phase(move_number)
    
    recommended = []
    for idx, move_dict in enumerate(top_moves):
        move_uci = move_dict["move_uci"]
        move = chess.Move.from_uci(move_uci)
        
        # Menganalisis heuristik langkah
        h = analyze_move_heuristics(board, move, is_white, phase)
        
        # Generate penjelasan dan risiko dalam bahasa Indonesia
        explanation, risk = generate_explanation_and_risk(h)
        
        recommended.append({
            "move_uci": move_uci,
            "move_san": move_dict["move_san"],
            "score": move_dict["score"],
            "mate_in": move_dict["mate_in"],
            "type": h["move_type"],
            "explanation": explanation,
            "risk": risk,
            "is_best": (idx == 0)  # Langkah pertama dengan evaluasi tertinggi dianggap terbaik
        })
        
    return recommended
