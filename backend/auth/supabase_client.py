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
    Verify the user's JWT token using the Supabase API, or fallback to decoding locally with PyJWT.
    Returns the user_id (sub claim) if valid, raises ValueError if invalid.
    """
    # 1. Try verifying using Supabase client API (supports ES256, RS256, HS256 automatically)
    if supabase:
        try:
            # get_user takes the access token and returns the user object if valid
            response = supabase.auth.get_user(token)
            if response and response.user:
                return response.user.id
            else:
                raise ValueError("Supabase did not return user details for this token.")
        except Exception as e:
            logger.info(f"Supabase client verification failed, falling back to local decode: {e}")

    # 2. Local decoding fallback (requires HS256 and SUPABASE_JWT_SECRET)
    if not SUPABASE_JWT_SECRET:
        raise ValueError("SUPABASE_JWT_SECRET is not configured on the server.")
    
    try:
        # Decode JWT using user's process token and the JWT secret
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256", "RS256", "ES256"],
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
