import io
import chess.pgn

def parse_pgn(pgn_text: str) -> dict:
    """
    Parses a PGN (Portable Game Notation) string and returns key metadata and moves.
    Handles PGNs from chess.com, lichess, and other sources by stripping comments and annotations.
    
    Args:
        pgn_text (str): The PGN string of the chess game.
        
    Returns:
        dict: A dictionary containing:
            - "white": Player playing White (str)
            - "black": Player playing Black (str)
            - "date": Date of the game (str)
            - "result": Result of the game (str)
            - "moves": List of clean SAN moves (list of str)
            
    Raises:
        ValueError: If the PGN text is invalid, empty, or fails syntax validation.
    """
    if not pgn_text or not pgn_text.strip():
        raise ValueError("PGN input cannot be empty.")

    pgn_io = io.StringIO(pgn_text.strip())
    
    try:
        game = chess.pgn.read_game(pgn_io)
    except Exception as e:
        raise ValueError(f"Failed to read PGN: {str(e)}")

    if game is None:
        raise ValueError("Invalid PGN format: No valid chess game could be parsed.")

    # Check for parser errors (e.g., illegal moves, bad formatting)
    if game.errors:
        error_msgs = "; ".join(str(err) for err in game.errors)
        raise ValueError(f"PGN validation errors: {error_msgs}")

    headers = game.headers
    white = headers.get("White", "?").strip()
    black = headers.get("Black", "?").strip()
    date = headers.get("Date", "????.??.??").strip()
    result = headers.get("Result", "*").strip()

    # Extract clean SAN moves
    moves = []
    board = game.board()
    node = game
    
    while not node.is_end():
        next_node = node.next()
        move = next_node.move
        
        # Validate move on the board to prevent parsing errors
        if move not in board.legal_moves:
            raise ValueError(f"Illegal move encountered in PGN: {board.san(move)} on move {board.fullmove_number}")
            
        move_san = board.san(move)
        moves.append(move_san)
        board.push(move)
        node = next_node

    # If there are no moves and no actual chess metadata, the PGN is invalid
    if not moves and white == "?" and black == "?" and result == "*":
        raise ValueError("Invalid PGN: The input contains no valid chess moves or metadata headers.")

    return {
        "white": white,
        "black": black,
        "date": date,
        "result": result,
        "moves": moves
    }
