import sys
import os
import uuid

# Add the project root to python path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db.database import SessionLocal, save_game
from backend.db.models import Game

def test():
    db = SessionLocal()
    test_game_id = str(uuid.uuid4())
    dummy_user_id = str(uuid.uuid4())
    
    print(f"Testing save_game with game_id: {test_game_id} and user_id: {dummy_user_id}")
    
    try:
        # Save new game
        game = save_game(
            db=db,
            game_id=test_game_id,
            white_player="TestWhite",
            black_player="TestBlack",
            result="1-0",
            pgn_raw="1. e4 e5 2. Nf3",
            white_accuracy=95.5,
            black_accuracy=88.2,
            user_id=dummy_user_id
        )
        
        print(f"Saved game successfully. user_id in returned object: {game.user_id}")
        assert str(game.user_id) == dummy_user_id, f"Expected {dummy_user_id}, got {game.user_id}"
        
        # Query from DB to ensure persistence
        db.expire_all()
        queried_game = db.query(Game).filter(Game.id == test_game_id).first()
        print(f"Queried game from database. user_id in DB: {queried_game.user_id}")
        assert str(queried_game.user_id) == dummy_user_id, f"Expected {dummy_user_id} in DB, got {queried_game.user_id}"
        
        # Clean up
        db.delete(queried_game)
        db.commit()
        print("Cleanup successful. Test passed!")
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test()
