from fastapi import Request, HTTPException, status
from backend.auth.supabase_client import verify_token

def get_current_user(request: Request) -> str:
    """
    FastAPI dependency to extract and verify the JWT token from the Authorization header.
    Returns the user_id if valid, raises HTTPException 401 otherwise.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header Authorization tidak ditemukan."
        )
    
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Format header Authorization harus berupa Bearer <token>."
        )
    
    token = parts[1]
    try:
        user_id = verify_token(token)
        return user_id
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
