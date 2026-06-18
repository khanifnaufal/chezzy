import logging
import jwt
from supabase import create_client, Client
from backend.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET

logger = logging.getLogger("chess_analyzer")

# Initialize the Supabase client safely
supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
else:
    logger.warning("Supabase URL or Key is not configured. Supabase client is uninitialized.")


def verify_token(token: str) -> str:
    """
    Verify and decode the user's JWT token using SUPABASE_JWT_SECRET.
    Returns the user_id (sub claim) if valid, raises ValueError if invalid.
    """
    if not SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET is not configured on the server.")
    
    try:
        # Decode JWT using user's process token and the JWT secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Token does not contain user identifier ('sub' claim)")
        return user_id
    except jwt.ExpiredSignatureError:
        raise ValueError("Token has expired")
    except jwt.InvalidSignatureError:
        raise ValueError("Token signature is invalid")
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")
