import io
import chess
import chess.pgn
from parser.pgn_parser import parse_pgn
from engine.evaluator import get_evaluation

def _convert_score_to_cp(score: dict) -> float:
    """
    Helper function to convert a score dictionary (cp or mate) to a numerical centipawn value.
    Mate is represented as a high centipawn value.
    """
    if not isinstance(score, dict) or "type" not in score or "value" not in score:
        raise ValueError(f"Invalid score structure: {score}")
        
    if score["type"] == "mate":
        mate_val = score["value"]
        if mate_val > 0:
            # White mates in mate_val moves. Faster mate = higher value.
            return 10000 - mate_val * 100
        elif mate_val < 0:
            # Black mates in abs(mate_val) moves. Faster mate = more negative.
            return -10000 - mate_val * 100
        else:
            return 0
            
    return float(score["value"])

def is_sacrifice_or_promotion(board: chess.Board, move: chess.Move) -> bool:
    """
    Heuristically checks if a move is a sacrifice or a pawn promotion.
    
    A sacrifice is defined as:
    1. Moving a piece to a square where it is attacked by an opponent piece of lower value.
    2. Moving a piece to a square where it is attacked and undefended.
    
    Pawn promotion is also considered a rare move.
    """
    if move.promotion:
        return True
        
    piece_values = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 20000
    }
    
    from_square = move.from_square
    to_square = move.to_square
    
    moving_piece = board.piece_at(from_square)
    if not moving_piece:
        return False
        
    moving_val = piece_values.get(moving_piece.piece_type, 0)
    captured_piece = board.piece_at(to_square)
    captured_val = piece_values.get(captured_piece.piece_type, 0) if captured_piece else 0
    
    # Handle en passant capture value
    if board.is_en_passant(move):
        captured_val = 100
        
    # If capturing a piece of equal/higher value, it's a trade, not a sacrifice
    if captured_val >= moving_val:
        return False
        
    # Check if the moved piece is under threat at the destination
    board_copy = board.copy()
    board_copy.push(move)
    
    opponent_color = board_copy.turn
    attackers = board_copy.attackers(opponent_color, to_square)
    
    if attackers:
        # If the lowest value attacker is less than the moved piece value, it's a sacrifice
        min_attacker_val = min(
            piece_values.get(board_copy.piece_at(sq).piece_type, 0) 
            for sq in attackers 
            if board_copy.piece_at(sq)
        )
        if min_attacker_val < moving_val:
            return True
            
        # If the piece is undefended, it's a sacrifice
        defenders = board_copy.attackers(not opponent_color, to_square)
        if not defenders:
            return True
            
    return False

def label_move(score_before: dict, score_after: dict, is_white: bool, is_rare: bool = False) -> str:
    """
    Labels a chess move based on evaluation differences (centipawn loss) and rarity.
    
    Args:
        score_before (dict): Score dictionary before the move {"type": "cp"|"mate", "value": int}
        score_after (dict): Score dictionary after the move {"type": "cp"|"mate", "value": int}
        is_white (bool): True if White played the move, False if Black played the move
        is_rare (bool): True if the move is considered rare/special (sacrifice or promotion)
        
    Returns:
        str: "Brilliant", "Good", "Inaccuracy", "Mistake", or "Blunder"
    """
    before_cp = _convert_score_to_cp(score_before)
    after_cp = _convert_score_to_cp(score_after)
    
    # Calculate difference (centipawn loss) from the active player's perspective
    if is_white:
        loss = before_cp - after_cp
    else:
        loss = after_cp - before_cp
        
    gain = -loss  # Positive change in active player's favor
    
    # Brilliant: rare move + positive difference > 50 cp
    if is_rare and gain > 50:
        return "Brilliant"
        
    # Other standard move categories
    if loss > 300:
        return "Blunder"
    elif 100 <= loss <= 300:
        return "Mistake"
    elif 20 <= loss < 100:
        return "Inaccuracy"
    else:
        return "Good"

def analyze_game(pgn_text: str, depth: int = 15, progress_callback=None) -> list:
    """
    Combines parser, evaluator, and labeler to analyze an entire chess game.
    
    Args:
        pgn_text (str): The PGN string of the game to analyze.
        depth (int): Stockfish depth for analysis.
        progress_callback (callable): Optional callback taking (current_move, total_moves)
        
    Returns:
        list of dict: A list of move analyses, each containing:
            - "move": SAN string of the move
            - "score_before": Score dict before the move
            - "score_after": Score dict after the move
            - "label": The move classification label
    """
    pgn_io = io.StringIO(pgn_text.strip())
    game = chess.pgn.read_game(pgn_io)
    
    if game is None:
        raise ValueError("Invalid PGN format: Could not read a chess game.")
        
    if game.errors:
        error_msgs = "; ".join(str(err) for err in game.errors)
        raise ValueError(f"PGN validation errors: {error_msgs}")
        
    # Count total moves first for progress tracking
    total_moves = 0
    temp_node = game
    while not temp_node.is_end():
        total_moves += 1
        temp_node = temp_node.next()
        
    board = game.board()
    results = []
    
    # Get initial board evaluation
    current_score = get_evaluation(board, depth=depth)
    
    node = game
    while not node.is_end():
        next_node = node.next()
        move = next_node.move
        is_white = board.turn == chess.WHITE
        move_san = board.san(move)
        
        # Check if the move is rare (sacrifice or promotion)
        is_rare = is_sacrifice_or_promotion(board, move)
        
        # Apply the move
        board.push(move)
        
        # Evaluate the resulting position
        score_after = get_evaluation(board, depth=depth)
        
        # Determine the label
        label = label_move(current_score, score_after, is_white, is_rare)
        
        results.append({
            "move": move_san,
            "score_before": current_score,
            "score_after": score_after,
            "label": label
        })
        
        if progress_callback:
            progress_callback(len(results), total_moves)
            
        # Reuse evaluation for the next move
        current_score = score_after
        node = next_node
        
    return results
