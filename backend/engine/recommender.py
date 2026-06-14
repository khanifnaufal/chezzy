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

# Bobot nilai perwira untuk kalkulasi ancaman
PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 100
}

def analyze_move_heuristics(board: chess.Board, move: chess.Move, phase: str) -> dict:
    """
    Menganalisis langkah catur menggunakan python-chess untuk mengekstrak data heuristik.
    """
    is_capture = board.is_capture(move)
    is_white = board.turn == chess.WHITE
    
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
        h = analyze_move_heuristics(board, move, phase)
        
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

def detect_opponent_threats(board: chess.Board, last_move: chess.Move, player_color_str: str) -> str:
    """
    Mendeteksi ancaman yang dibuat oleh langkah terakhir lawan berdasarkan:
    1. Skak terhadap Raja (King in danger)
    2. Fork (Cabang/Garpu terhadap >= 2 perwira berharga)
    3. Pin (Perwira ter-pin ke Raja)
    4. Skewer (Perwira berharga tinggi terancam, dengan perwira bernilai sama/rendah di belakangnya)
    5. Ancaman langsung terhadap perwira yang tidak terlindungi atau bernilai tinggi
    """
    player_color = chess.WHITE if player_color_str == "white" else chess.BLACK
    
    # 1. Cek apakah king kamu dalam bahaya (skak)
    if board.is_check():
        checkers = board.checkers()
        if checkers:
            checker_names = []
            for sq in checkers:
                p = board.piece_at(sq)
                if p:
                    checker_names.append(f"{PIECE_NAMES.get(p.piece_type, 'perwira')} di {chess.square_name(sq)}")
            if checker_names:
                return f"Raja Anda terancam skak oleh {', '.join(checker_names)}"
            return "Raja Anda dalam bahaya skak!"
            
    # 2. Cek apakah lawan membuat fork (garpu) menggunakan piece yang baru saja bergerak
    opp_sq = last_move.to_square
    opp_piece = board.piece_at(opp_sq)
    if opp_piece:
        attacked_squares = board.attacks(opp_sq)
        player_pieces_attacked = []
        for sq in attacked_squares:
            piece = board.piece_at(sq)
            if piece and piece.color == player_color:
                player_pieces_attacked.append((sq, piece))
        
        # Garpu terjadi jika menyerang minimal 2 perwira
        if len(player_pieces_attacked) >= 2:
            piece_strs = [f"{PIECE_NAMES.get(p.piece_type, 'perwira')} di {chess.square_name(sq)}" for sq, p in player_pieces_attacked]
            opp_name = PIECE_NAMES.get(opp_piece.piece_type, "perwira")
            return f"Garpu (fork) oleh {opp_name} terhadap {', '.join(piece_strs[:-1])} dan {piece_strs[-1]}"
            
    # 3. Cek apakah lawan membuat pin menggunakan piece yang baru saja bergerak
    pinned_pieces_by_last_move = []
    for sq in chess.SQUARES:
        piece = board.piece_at(sq)
        if piece and piece.color == player_color:
            if board.is_pinned(player_color, sq):
                if sq in board.attacks(opp_sq):
                    pinned_pieces_by_last_move.append((sq, piece))
    if pinned_pieces_by_last_move:
        pinned_strs = [f"{PIECE_NAMES.get(p.piece_type, 'perwira')} di {chess.square_name(sq)}" for sq, p in pinned_pieces_by_last_move]
        opp_name = PIECE_NAMES.get(opp_piece.piece_type, "perwira") if opp_piece else "perwira"
        return f"Pin terhadap {', '.join(pinned_strs)} oleh {opp_name} di {chess.square_name(opp_sq)}"

    # 4. Cek apakah lawan membuat skewer (tusukan) menggunakan piece yang baru saja bergerak (sliding piece)
    if opp_piece and opp_piece.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        attacked_squares = board.attacks(opp_sq)
        for sq_A in attacked_squares:
            piece_A = board.piece_at(sq_A)
            if piece_A and piece_A.color == player_color:
                # Simulasikan jika piece A disingkirkan dari papan
                board.remove_piece_at(sq_A)
                new_attacks = board.attacks(opp_sq)
                board.set_piece_at(sq_A, piece_A) # Kembalikan segera
                
                for sq_B in new_attacks:
                    if sq_B != sq_A and sq_B not in attacked_squares:
                        piece_B = board.piece_at(sq_B)
                        if piece_B and piece_B.color == player_color:
                            val_A = PIECE_VALUES.get(piece_A.piece_type, 0)
                            val_B = PIECE_VALUES.get(piece_B.piece_type, 0)
                            # Skewer menyerang perwira bernilai lebih tinggi/sama di depan perwira bernilai lebih rendah/sama
                            if val_A >= val_B:
                                opp_name = PIECE_NAMES.get(opp_piece.piece_type, "perwira")
                                return f"Skewer terhadap {PIECE_NAMES.get(piece_A.piece_type)} di {chess.square_name(sq_A)} dan {PIECE_NAMES.get(piece_B.piece_type)} di {chess.square_name(sq_B)} oleh {opp_name} di {chess.square_name(opp_sq)}"

    # 5. Cek apakah setelah move lawan ada piece kamu yang terancam langsung
    if opp_piece:
        attacked_squares = board.attacks(opp_sq)
        threatened_pieces = []
        for sq in attacked_squares:
            piece = board.piece_at(sq)
            if piece and piece.color == player_color:
                # Evaluasi apakah perwira ini benar-benar terancam (tidak terlindungi atau diserang perwira bernilai lebih rendah)
                is_defended = len(board.attackers(player_color, sq)) > 0
                val_attacker = PIECE_VALUES.get(opp_piece.piece_type, 0)
                val_target = PIECE_VALUES.get(piece.piece_type, 0)
                if not is_defended or (val_attacker < val_target):
                    if piece.piece_type != chess.KING:
                        threatened_pieces.append((sq, piece))
        if threatened_pieces:
            # Urutkan berdasarkan nilai perwira tertinggi terlebih dahulu
            threatened_pieces.sort(key=lambda x: PIECE_VALUES.get(x[1].piece_type, 0), reverse=True)
            best_threat_sq, best_threat_piece = threatened_pieces[0]
            is_defended = len(board.attackers(player_color, best_threat_sq)) > 0
            defended_str = "tidak terlindungi" if not is_defended else "terlindungi"
            opp_name = PIECE_NAMES.get(opp_piece.piece_type, "perwira")
            return f"{PIECE_NAMES.get(best_threat_piece.piece_type, 'perwira').capitalize()} Anda di {chess.square_name(best_threat_sq)} terancam oleh {opp_name} di {chess.square_name(opp_sq)} ({defended_str})"
            
    return ""
