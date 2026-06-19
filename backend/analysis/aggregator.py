from sqlalchemy.orm import Session as DbSession
from backend.db.models import Game, MoveRecord, Session as SessionModel

def get_all_moves(db: DbSession, user_id: str, player_color: str = None):
    """
    Mengambil semua moves dari semua game milik user_id tertentu.
    Jika player_color ditentukan ('white' atau 'black'),
    hanya mengambil moves yang dimainkan oleh warna tersebut.
    """
    query = db.query(MoveRecord).join(Game).filter(Game.user_id == user_id)
    if player_color:
        is_white_val = (player_color.lower() == "white")
        query = query.filter(MoveRecord.is_white == is_white_val)
    return query.all()

def get_player_moves(db: DbSession, user_id: str):
    """
    Helper untuk mengambil semua moves yang dimainkan oleh HUMAN player (bukan Bot) dari semua game milik user_id.
    Mendeteksi warna pemain dari tabel Session atau fallback dari nama pemain.
    Menggunakan batch query untuk menghindari masalah N+1 query.
    """
    games = db.query(Game).filter(Game.user_id == user_id).all()
    if not games:
        return []

    sessions = db.query(SessionModel).join(Game).filter(Game.user_id == user_id).all()
    game_player_colors = {s.game_id: s.player_color for s in sessions if s.game_id}

    game_white_flags = {}
    for game in games:
        player_color = game_player_colors.get(game.id)
        if not player_color:
            # Fallback berdasarkan nama player vs bot
            if "bot" in game.white_player.lower():
                player_color = "black"
            elif "bot" in game.black_player.lower():
                player_color = "white"
            else:
                player_color = "white"
        game_white_flags[game.id] = (player_color == "white")

    # Ambil semua moves untuk game-game ini dalam 1 kueri tunggal
    game_ids = list(game_white_flags.keys())
    all_moves = db.query(MoveRecord).filter(MoveRecord.game_id.in_(game_ids)).all()

    # Filter move milik player di memori
    player_moves = [
        m for m in all_moves
        if m.is_white == game_white_flags.get(m.game_id)
    ]

    return player_moves

def get_moves_by_phase(db: DbSession, user_id: str, phase: str):
    """
    Mengambil semua moves yang dimainkan oleh player pada fase tertentu (opening/middlegame/endgame) milik user_id.
    """
    player_moves = get_player_moves(db, user_id)
    return [m for m in player_moves if m.phase == phase]

def get_blunders(db: DbSession, user_id: str):
    """
    Mengambil semua moves yang dimainkan oleh player dengan label Mistake atau Blunder milik user_id.
    """
    player_moves = get_player_moves(db, user_id)
    return [m for m in player_moves if m.label in ("Mistake", "Blunder")]

def get_accuracy_trend(db: DbSession, user_id: str):
    """
    Mengambil daftar akurasi game player urut berdasarkan tanggal game (lama ke baru) milik user_id.
    """
    games = db.query(Game).filter(Game.user_id == user_id).order_by(Game.date.asc()).all()
    sessions = db.query(SessionModel).join(Game).filter(Game.user_id == user_id).all()
    game_player_colors = {s.game_id: s.player_color for s in sessions if s.game_id}

    trend = []
    for game in games:
        player_color = game_player_colors.get(game.id)
        if not player_color:
            if "bot" in game.white_player.lower():
                player_color = "black"
            elif "bot" in game.black_player.lower():
                player_color = "white"
            else:
                player_color = "white"

        accuracy = game.white_accuracy if player_color == "white" else game.black_accuracy
        if accuracy is None:
            accuracy = 100.0

        trend.append({
            "date": game.date.isoformat() if game.date else None,
            "game_id": game.id,
            "accuracy": accuracy
          })
    return trend

def get_game_count(db: DbSession, user_id: str):
    """
    Mengambil total game yang tersimpan di database milik user_id.
    """
    return db.query(Game).filter(Game.user_id == user_id).count()
