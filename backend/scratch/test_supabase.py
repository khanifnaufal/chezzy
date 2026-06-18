import sys
import os
import jwt
import time

# Add root folder to sys.path so we can import backend packages
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.auth.supabase_client import verify_token, supabase
from backend.config import STOCKFISH_PATH, STOCKFISH_DEPTH, DATABASE_URL, SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET

def run_tests():
    print("=== Supabase Connection & Helper Verification ===")
    
    # 1. Verify environment variables are loaded
    print(f"STOCKFISH_PATH: {STOCKFISH_PATH}")
    print(f"STOCKFISH_DEPTH: {STOCKFISH_DEPTH}")
    print(f"DATABASE_URL: {DATABASE_URL}")
    print(f"SUPABASE_URL: {SUPABASE_URL}")
    print(f"SUPABASE_KEY (new secret key format is NOT JWT): {SUPABASE_KEY}")
    print(f"SUPABASE_JWT_SECRET: {'***' if SUPABASE_JWT_SECRET else 'Empty'}")
    
    # 2. Check supabase client status
    if supabase is not None:
        print("Supabase client initialized successfully (client is not None).")
    else:
        print("Supabase client is not initialized (expected if credentials are empty).")
        
    # 3. Test JWT verification
    test_secret = SUPABASE_JWT_SECRET or "test_secret_for_mock_jwt"
    print(f"\nTesting JWT Verification using secret: {test_secret}")
    
    # Generate a mock token
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    payload = {
        "sub": user_id,
        "email": "player@chessanalyzer.com",
        "role": "authenticated",
        "exp": int(time.time()) + 3600  # Expires in 1 hour
    }
    
    mock_token = jwt.encode(payload, test_secret, algorithm="HS256")
    print(f"Generated Mock Token: {mock_token}")
    
    # Verify the mock token
    # We temporarily inject test_secret into backend.auth.supabase_client module configuration if it's empty
    import backend.auth.supabase_client as client_module
    original_secret = client_module.SUPABASE_JWT_SECRET
    if not original_secret:
        client_module.SUPABASE_JWT_SECRET = test_secret
        
    try:
        decoded_user_id = verify_token(mock_token)
        print(f"Verification Success! Decoded User ID: {decoded_user_id}")
        assert decoded_user_id == user_id, "Decoded user ID does not match!"
        print("JWT Verification logic is fully correct!")
    except Exception as e:
        print(f"Verification Failed! Error: {e}")
    finally:
        client_module.SUPABASE_JWT_SECRET = original_secret
        
    # 4. Test invalid token
    if not original_secret:
        client_module.SUPABASE_JWT_SECRET = test_secret
        
    try:
        verify_token("invalid.token.here")
        print("Error: Invalid token passed verification!")
    except ValueError as e:
        print(f"Invalid token correctly rejected. Reason: {e}")
    finally:
        client_module.SUPABASE_JWT_SECRET = original_secret

        
    # 5. Test expired token
    expired_payload = {
        "sub": user_id,
        "exp": int(time.time()) - 3600  # Expired 1 hour ago
    }
    expired_token = jwt.encode(expired_payload, test_secret, algorithm="HS256")
    
    if not original_secret:
        client_module.SUPABASE_JWT_SECRET = test_secret
        
    try:
        verify_token(expired_token)
        print("Error: Expired token passed verification!")
    except ValueError as e:
        print(f"Expired token correctly rejected. Reason: {e}")
    finally:
        client_module.SUPABASE_JWT_SECRET = original_secret

if __name__ == "__main__":
    run_tests()
