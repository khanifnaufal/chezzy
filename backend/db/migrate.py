import sys
import os
from sqlalchemy import inspect, text

# Add the project root to python path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db.database import engine

def migrate():
    print("Running migration...")
    inspector = inspect(engine)
    
    # Check if games table exists
    if not inspector.has_table('games'):
        print("Table 'games' does not exist. Please run init_db() first or start the server.")
        return

    columns = [col['name'] for col in inspector.get_columns('games')]
    
    if 'user_id' not in columns:
        print("Column 'user_id' not found in 'games' table. Adding it...")
        dialect_name = engine.dialect.name
        print(f"Detected database dialect: {dialect_name}")
        
        if dialect_name == 'postgresql':
            # Add column as UUID to match Supabase auth.users.id
            query = "ALTER TABLE games ADD COLUMN user_id UUID NULL;"
        else:
            # SQLite fallback
            query = "ALTER TABLE games ADD COLUMN user_id VARCHAR(255) NULL;"
            
        with engine.begin() as conn:
            conn.execute(text(query))
        print("Column 'user_id' added successfully.")
    else:
        print("Column 'user_id' already exists in 'games' table.")

    # Explicitly set user_id to NULL for any existing records where it might not be NULL
    print("Ensuring existing records have NULL user_id...")
    with engine.begin() as conn:
        conn.execute(text("UPDATE games SET user_id = NULL WHERE user_id IS NOT NULL;"))
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate()
