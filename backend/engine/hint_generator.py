import chess
from typing import Optional

# Value maps for threats calculations
PIECE_VALUES = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
    chess.KING: 1000
}

def get_square_area(square: chess.Square) -> str:
    """
    Get Indonesian name for the area of a square (queenside, kingside, or center).
    """
    file = chess.square_file(square)
    if file in (0, 1, 2):  # A, B, C
        return "sisi queenside"
    elif file in (3, 4):  # D, E
        return "pusat papan"
    else:  # F, G, H
        return "sisi kingside"

def get_diagonal_name(sq1: chess.Square, sq2: chess.Square) -> Optional[str]:
    """
    Get the name of the diagonal connecting two squares, formatted like 'diagonal a1-h8'.
    """
    f1, r1 = chess.square_file(sq1), chess.square_rank(sq1)
    f2, r2 = chess.square_file(sq2), chess.square_rank(sq2)
    if abs(f1 - f2) == abs(r1 - r2):
        df = 1 if f2 > f1 else -1
        dr = 1 if r2 > r1 else -1
        
        # Trace backwards to start
        curr_f, curr_r = f1, r1
        while 0 <= curr_f - df < 8 and 0 <= curr_r - dr < 8:
            curr_f -= df
            curr_r -= dr
        start_sq = chess.square(curr_f, curr_r)
        
        # Trace forwards to end
        curr_f, curr_r = f1, r1
        while 0 <= curr_f + df < 8 and 0 <= curr_r + dr < 8:
            curr_f += df
            curr_r += dr
        end_sq = chess.square(curr_f, curr_r)
        
        sq_names = sorted([chess.square_name(start_sq), chess.square_name(end_sq)])
        return f"diagonal {sq_names[0]}-{sq_names[1]}"
    return None

def get_line_description(sq1: chess.Square, sq2: chess.Square) -> Optional[str]:
    """
    Get a description of the line (diagonal, file, or rank) connecting two squares.
    """
    diag = get_diagonal_name(sq1, sq2)
    if diag:
        return diag
    
    f1, r1 = chess.square_file(sq1), chess.square_rank(sq1)
    f2, r2 = chess.square_file(sq2), chess.square_rank(sq2)
    if f1 == f2:
        return f"lajur {chr(97 + f1)}"
    if r1 == r2:
        return f"baris ke-{r1 + 1}"
    return None


def generate_hint(fen: str, level: int, is_white: bool) -> str:
    """
    Generates a Chess Hint in Indonesian language based on the FEN, hint level, and active player side.
    
    Level 1: Threat Awareness
    Level 2: Tactical Hint
    Level 3: Strategic Hint
    """
    board = chess.Board(fen)
    player_color = chess.WHITE if is_white else chess.BLACK
    opponent_color = not player_color
    
    # Save original turn, set board turn to player's turn to analyze from their perspective
    original_turn = board.turn
    board.turn = player_color

    if level == 1:
        # --- Level 1: Threat Awareness ---
        # 1. King Safety
        if board.is_check():
            return "Raja Anda sedang diserang (skak), perhatikan posisi pertahanan Raja."
            
        # Pawn shield check
        king_sq = board.king(player_color)
        if king_sq is not None:
            king_file = chess.square_file(king_sq)
            king_rank = chess.square_rank(king_sq)
            expected_rank = 0 if player_color == chess.WHITE else 7
            
            if king_rank == expected_rank:
                shield_rank = 1 if player_color == chess.WHITE else 6
                # If king is on kingside (f, g, h)
                if king_file >= 5:
                    pawns = [board.piece_at(chess.square(f, shield_rank)) for f in (5, 6, 7)]
                    friendly_pawns = sum(1 for p in pawns if p and p.piece_type == chess.PAWN and p.color == player_color)
                    if friendly_pawns < 2:
                        return f"King kamu mulai terbuka, perhatikan baris ke-{expected_rank + 1}"
                # If king is on queenside (a, b, c)
                elif king_file <= 2:
                    pawns = [board.piece_at(chess.square(f, shield_rank)) for f in (0, 1, 2)]
                    friendly_pawns = sum(1 for p in pawns if p and p.piece_type == chess.PAWN and p.color == player_color)
                    if friendly_pawns < 2:
                        return f"King kamu mulai terbuka, perhatikan baris ke-{expected_rank + 1}"

        # 2. Direct Threats
        threatened_areas = []
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if piece and piece.color == player_color and piece.piece_type != chess.KING:
                attackers = board.attackers(opponent_color, sq)
                if attackers:
                    # Check if undefended
                    defenders = board.attackers(player_color, sq)
                    is_threat = False
                    if not defenders:
                        is_threat = True
                    else:
                        # Or if attacker has lower value than piece
                        val_target = PIECE_VALUES.get(piece.piece_type, 0)
                        min_attacker_val = min(PIECE_VALUES.get(board.piece_at(a_sq).piece_type, 0) for a_sq in attackers if board.piece_at(a_sq))
                        if min_attacker_val < val_target:
                            is_threat = True
                            
                    if is_threat:
                        area = get_square_area(sq)
                        threatened_areas.append(area)
        
        if threatened_areas:
            # Return hint about the first threatened area detected
            return f"Ada perwira Anda di {threatened_areas[0]} yang sedang terancam oleh lawan"

        # 3. Hanging Pieces (Not defended and not necessarily attacked right now)
        hanging_areas = []
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if piece and piece.color == player_color and piece.piece_type != chess.KING:
                defenders = board.attackers(player_color, sq)
                if not defenders:
                    hanging_areas.append(get_square_area(sq))
                    
        if hanging_areas:
            return f"Ada piece di {hanging_areas[0]} yang tidak terjaga"
            
        return "Raja Anda aman dan tidak ada perwira yang terancam langsung saat ini."

    elif level == 2:
        # --- Level 2: Tactical Hint ---
        tactics = []
        
        # Run tactical motif check on all legal moves
        for move in list(board.legal_moves):
            # Checkmate in 1
            board.push(move)
            if board.is_checkmate():
                board.pop()
                area = get_square_area(move.to_square)
                return f"Ada peluang taktik mat dalam satu langkah di sekitar {area}"
            board.pop()
            
            # Simulated attacks / Pins / Forks / Skewers
            is_capture = board.is_capture(move)
            
            board.push(move)
            # Fork check: check if the moved piece attacks multiple valuable enemy pieces
            to_sq = move.to_square
            opp_attacked = []
            for sq in board.attacks(to_sq):
                p = board.piece_at(sq)
                if p and p.color == opponent_color and p.piece_type != chess.KING:
                    opp_attacked.append((sq, p))
            
            if len(opp_attacked) >= 2:
                # Confirm it's a meaningful fork (attacking at least one minor/major piece)
                if any(p.piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN) for sq, p in opp_attacked):
                    area = get_square_area(to_sq)
                    tactics.append(("fork", f"Ada kemungkinan taktik garpu (fork) di sekitar {area}"))
            
            # Pin check: check if a piece was pinned after this move
            for sq in chess.SQUARES:
                p = board.piece_at(sq)
                if p and p.color == opponent_color and p.piece_type != chess.KING:
                    if board.is_pinned(opponent_color, sq):
                        # Find the pinning piece among player's attackers
                        pinning_pieces = board.attackers(player_color, sq)
                        if pinning_pieces:
                            pinning_sq = list(pinning_pieces)[0]
                            line_desc = get_line_description(pinning_sq, sq)
                            if line_desc:
                                tactics.append(("pin", f"Ada kemungkinan taktik pin di sekitar {line_desc}"))
            
            # Skewer check: sliding piece attacks a higher-value piece, exposing a lower/equal value one behind
            moved_piece = board.piece_at(to_sq)
            if moved_piece and moved_piece.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
                for target_sq in board.attacks(to_sq):
                    p_target = board.piece_at(target_sq)
                    if p_target and p_target.color == opponent_color and p_target.piece_type != chess.KING:
                        # Trace ray from to_sq through target_sq
                        f1, r1 = chess.square_file(to_sq), chess.square_rank(to_sq)
                        f2, r2 = chess.square_file(target_sq), chess.square_rank(target_sq)
                        step_f = 1 if f2 > f1 else (-1 if f2 < f1 else 0)
                        step_r = 1 if r2 > r1 else (-1 if r2 < r1 else 0)
                        
                        curr_f = f2 + step_f
                        curr_r = r2 + step_r
                        while 0 <= curr_f < 8 and 0 <= curr_r < 8:
                            next_sq = chess.square(curr_f, curr_r)
                            p_next = board.piece_at(next_sq)
                            if p_next:
                                if p_next.color == opponent_color:
                                    val_target = PIECE_VALUES.get(p_target.piece_type, 0)
                                    val_behind = PIECE_VALUES.get(p_next.piece_type, 0)
                                    if val_target >= val_behind:
                                        line_desc = get_line_description(to_sq, target_sq)
                                        if line_desc:
                                            tactics.append(("skewer", f"Ada kemungkinan taktik skewer di sekitar {line_desc}"))
                                break
                            curr_f += step_f
                            curr_r += step_r
            
            # Discovered attack check
            # Look at player's sliding pieces. Check if any are now attacking a high-value piece that wasn't attacked before
            board.pop() # Back to pre-move board
            
            # Attacking states before move
            pre_attacks = {}
            for sq in chess.SQUARES:
                p = board.piece_at(sq)
                if p and p.color == player_color and p.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN) and sq != move.from_square:
                    pre_attacks[sq] = set(board.attacks(sq))
            
            board.push(move)
            # Attacking states after move
            for sq, pre_ats in pre_attacks.items():
                post_ats = board.attacks(sq)
                newly_attacked = post_ats - pre_ats
                for target_sq in newly_attacked:
                    p_target = board.piece_at(target_sq)
                    if p_target and p_target.color == opponent_color and p_target.piece_type in (chess.ROOK, chess.QUEEN, chess.KING):
                        area = get_square_area(target_sq)
                        tactics.append(("discovered", f"Ada kemungkinan taktik discovered attack (serangan tersembunyi) di sekitar {area}"))
            
            board.pop()
            
        if tactics:
            # Prioritize checkmate, then fork, pin, skewer, discovered
            for t_type, t_hint in tactics:
                if t_type == "fork":
                    return t_hint
            for t_type, t_hint in tactics:
                if t_type == "pin":
                    return t_hint
            for t_type, t_hint in tactics:
                if t_type == "skewer":
                    return t_hint
            for t_type, t_hint in tactics:
                if t_type == "discovered":
                    return t_hint
            return tactics[0][1]

        return "Perhatikan koordinasi antara minor piece kamu untuk mencari peluang penempatan perwira yang lebih baik."

    elif level == 3:
        # --- Level 3: Strategic Hint ---
        
        # Restore turn for proper legal moves & checks
        board.turn = original_turn
        
        # 1. Rooks on open files
        open_files = []
        for f in range(8):
            has_pawn = any(board.piece_at(chess.square(f, r)) and board.piece_at(chess.square(f, r)).piece_type == chess.PAWN for r in range(8))
            if not has_pawn:
                open_files.append(f)
                
        if open_files:
            has_rook_on_open_file = False
            for f in open_files:
                for r in range(8):
                    p = board.piece_at(chess.square(f, r))
                    if p and p.color == player_color and p.piece_type == chess.ROOK:
                        has_rook_on_open_file = True
                        break
            if not has_rook_on_open_file:
                return f"Ini momen bagus untuk membuka file dan memposisikan benteng Anda di lajur {chr(97 + open_files[0])} yang terbuka"

        # 2. Undeveloped minor pieces
        undeveloped = []
        starting_squares = [chess.B1, chess.C1, chess.F1, chess.G1] if player_color == chess.WHITE else [chess.B8, chess.C8, chess.F8, chess.G8]
        for sq in starting_squares:
            p = board.piece_at(sq)
            if p and p.color == player_color and p.piece_type in (chess.KNIGHT, chess.BISHOP):
                undeveloped.append(sq)
        if len(undeveloped) >= 2:
            return "Beberapa perwira minor Anda belum aktif berkembang dari baris belakang, prioritaskan mobilisasi mereka."

        # 3. Pawn structure
        # Check doubled pawns
        for f in range(8):
            pawns_on_file = [r for r in range(8) if board.piece_at(chess.square(f, r)) and board.piece_at(chess.square(f, r)).piece_type == chess.PAWN and board.piece_at(chess.square(f, r)).color == player_color]
            if len(pawns_on_file) >= 2:
                area = "queenside" if f <= 2 else ("kingside" if f >= 5 else "pusat")
                return f"Pawn structure kamu lemah di {area} karena memiliki pion tumpuk (doubled pawn)"
                
        # Check isolated pawns
        for f in range(8):
            pawns_on_file = [r for r in range(8) if board.piece_at(chess.square(f, r)) and board.piece_at(chess.square(f, r)).piece_type == chess.PAWN and board.piece_at(chess.square(f, r)).color == player_color]
            if pawns_on_file:
                # Check adjacent files
                adj_files = []
                if f > 0:
                    adj_files.append(f - 1)
                if f < 7:
                    adj_files.append(f + 1)
                
                has_adj_pawn = False
                for af in adj_files:
                    if any(board.piece_at(chess.square(af, r)) and board.piece_at(chess.square(af, r)).piece_type == chess.PAWN and board.piece_at(chess.square(af, r)).color == player_color for r in range(8)):
                        has_adj_pawn = True
                        break
                if not has_adj_pawn:
                    area = "queenside" if f <= 2 else ("kingside" if f >= 5 else "pusat")
                    return f"Pawn structure kamu lemah di {area} karena ada pion terisolasi"

        # 4. Center control
        center_squares = [chess.D4, chess.E4, chess.D5, chess.E5]
        player_control = sum(len(board.attackers(player_color, sq)) for sq in center_squares)
        opponent_control = sum(len(board.attackers(opponent_color, sq)) for sq in center_squares)
        if opponent_control > player_control + 1:
            return "Lawan mengontrol pusat papan dengan lebih aktif, cobalah merebut kembali petak pusat papan."

        return "Fokus pada peningkatan aktivitas perwira Anda dan menjaga soliditas struktur pion."

    return "Tidak ada saran khusus untuk posisi ini."
