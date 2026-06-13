import os
import json
import sqlite3
import sys

# Add parent directory to sys.path to allow config import when run as a standalone script
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)

from config import DB_PATH

DB_DIR = os.path.dirname(DB_PATH)
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def _get_connection() -> sqlite3.Connection:
    """
    Helper function to establish connection to the SQLite database.
    Creates the data directory if it doesn't exist, enables Foreign Key constraints,
    and configures the connection row factory to return Row objects.
    """
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """
    Initializes the database by creating all necessary tables from schema.sql.
    Does nothing if the tables already exist.
    """
    conn = _get_connection()
    try:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
            schema_sql = f.read()
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()


def save_game(game_data: dict, moves_data: list) -> int:
    """
    Saves a game and all its moves to the database as a single transaction.
    If any operation fails, the transaction is rolled back.

    Args:
        game_data (dict): Dictionary containing game metadata:
            - "white": Player playing White (str)
            - "black": Player playing Black (str)
            - "date": Date of the game (str)
            - "result": Result of the game (str)
            - "pgn_raw": The complete raw PGN text (str)
        moves_data (list): List of move dictionaries, where each dict has:
            - "move": SAN move string (str)
            - "label": Analysis label (str)
            - "score_before": Score dictionary before the move (dict)
            - "score_after": Score dictionary after the move (dict)
            - "move_number": Optional move number (int)
            - "is_white": Optional flag for whether move was played by White (bool)

    Returns:
        int: The game ID of the newly saved game.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        # Insert game metadata
        cursor.execute(
            """
            INSERT INTO games (white, black, date, result, pgn_raw)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                game_data.get("white"),
                game_data.get("black"),
                game_data.get("date"),
                game_data.get("result"),
                game_data.get("pgn_raw")
            )
        )
        game_id = cursor.lastrowid
        
        # Insert each move
        for i, move_info in enumerate(moves_data):
            # Infer move_number if not provided
            move_number = move_info.get("move_number")
            if move_number is None:
                move_number = (i // 2) + 1
                
            # Infer is_white if not provided
            is_white_val = move_info.get("is_white")
            if is_white_val is None:
                # Chess starts with White (index 0 is white, 1 is black, etc.)
                is_white_int = 1 if (i % 2 == 0) else 0
            else:
                is_white_int = 1 if is_white_val else 0

            # Serialize score objects to JSON strings
            score_before = move_info.get("score_before")
            if isinstance(score_before, (dict, list)):
                score_before_str = json.dumps(score_before)
            else:
                score_before_str = str(score_before) if score_before is not None else "{}"

            score_after = move_info.get("score_after")
            if isinstance(score_after, (dict, list)):
                score_after_str = json.dumps(score_after)
            else:
                score_after_str = str(score_after) if score_after is not None else "{}"

            cursor.execute(
                """
                INSERT INTO moves (game_id, move_number, move, label, score_before, score_after, is_white)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    game_id,
                    move_number,
                    move_info.get("move"),
                    move_info.get("label"),
                    score_before_str,
                    score_after_str,
                    is_white_int
                )
            )
            
        conn.commit()
        return game_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def get_all_games() -> list:
    """
    Retrieves all games from the database.

    Returns:
        list of dict: A list of games where each game is represented as a dictionary.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, white, black, date, result, pgn_raw, created_at FROM games ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def get_moves_by_game(game_id: int) -> list:
    """
    Retrieves all moves analyzed for a specific game.

    Args:
        game_id (int): The ID of the game.

    Returns:
        list of dict: A list of move dictionaries with deserialized score fields.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT id, game_id, move_number, move, label, score_before, score_after, is_white 
            FROM moves 
            WHERE game_id = ? 
            ORDER BY id ASC
            """,
            (game_id,)
        )
        rows = cursor.fetchall()
        
        result_moves = []
        for row in rows:
            move_dict = dict(row)
            
            # Deserialize score fields from JSON text to dicts
            try:
                move_dict["score_before"] = json.loads(move_dict["score_before"])
            except (json.JSONDecodeError, TypeError):
                pass
                
            try:
                move_dict["score_after"] = json.loads(move_dict["score_after"])
            except (json.JSONDecodeError, TypeError):
                pass
                
            # Convert 1/0 to Python boolean
            move_dict["is_white"] = bool(move_dict["is_white"])
            result_moves.append(move_dict)
            
        return result_moves
    finally:
        conn.close()


def game_already_exists(white: str, black: str, date: str) -> bool:
    """
    Checks if a game between the same players on the same date already exists.

    Args:
        white (str): Name of the player playing White.
        black (str): Name of the player playing Black.
        date (str): Date of the game (usually in PGN format YYYY.MM.DD).

    Returns:
        bool: True if a matching game exists, False otherwise.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM games WHERE white = ? AND black = ? AND date = ? LIMIT 1",
            (white, black, date)
        )
        row = cursor.fetchone()
        return row is not None
    finally:
        conn.close()
