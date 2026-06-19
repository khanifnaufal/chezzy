import sqlite3
import os

db_path = "D:/kuliah/Project-After-Lulus/chess-analyzer/chess_dev.db"
print("DB Path exists:", os.path.exists(db_path))
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='games'")
        table_exists = cursor.fetchone()
        print("games table exists:", bool(table_exists))
        if table_exists:
            cursor.execute("SELECT COUNT(*) FROM games")
            print("games count:", cursor.fetchone()[0])
            cursor.execute("SELECT COUNT(*) FROM moves")
            print("moves count:", cursor.fetchone()[0])
            cursor.execute("SELECT COUNT(*) FROM sessions")
            print("sessions count:", cursor.fetchone()[0])
    except Exception as e:
        print("Error:", e)
    finally:
        conn.close()
