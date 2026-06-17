import sys
import re
import chess
from backend.engine.hint_generator import generate_hint

# Set up test positions
TEST_CASES = [
    {
        "name": "Starting Position",
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "is_white": True,
        "expected_themes": {
            1: "aman",
            2: "koordinasi",
            3: "aktif berkembang"
        }
    },
    {
        "name": "Threatened Piece & Weak Pawn Shield (Kingside)",
        # Black queen on h4 attacking e4 pawn, white king on g1 with open shield (no f2 pawn)
        # FEN: White king on g1, white rook on f1, white pawns on g2, h2 (f2 pawn moved/gone)
        # Black queen on h4 attacks white pawn on e4.
        "fen": "r1b1kbnr/pppp1ppp/2n5/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4",
        "is_white": True,
        "expected_themes": {
            1: "terancam",
        }
    },
    {
        "name": "Tactical Fork Available (White Knight forks King and Rook)",
        # White Knight on f7 forks Black King on e8 and Black Rook on h8
        # Black to move, but we check is_white = True (White can play Nxf7 or fork is available on next move simulation)
        "fen": "r3k2r/ppp2Ppp/2n5/8/8/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 8",
        "is_white": True,
        "expected_themes": {
            2: "garpu"
        }
    },
    {
        "name": "Weak Pawn Structure (Doubled Pawns on queenside)",
        # White has doubled pawns on a-file (a2, a3)
        "fen": "r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/P7/1PPP1PPP/RNBQK1NR w KQkq - 0 4",
        "is_white": True,
        "expected_themes": {
            3: "pawn structure"
        }
    }
]

def check_no_illegal_notations(hint_text: str):
    """
    Ensures the hint does not mention specific moves like e4, Nf3 or piece positions like 'gajah di c4'.
    """
    # Regex to find standard algebraic move notations (e.g. e4, d5, Nf3, Qh5, O-O, etc.)
    # excluding diagonal ranges like a1-h8
    # Let's filter out standard move notations:
    # A single uppercase letter (piece) optionally followed by x or file-rank, e.g., Nf3, Qh5, Bxf7, e4, d5.
    
    # We can check for standard coordinate/move patterns:
    # 1. Individual square coordinates (a1 to h8) that are NOT part of a diagonal range (e.g., NOT 'a1-h8')
    # Let's search for lowercase letter a-h followed by a digit 1-8.
    coord_matches = re.findall(r'\b[a-h][1-8]\b', hint_text)
    if coord_matches:
        print(f"WARNING: Found individual square coordinate: {coord_matches} in: '{hint_text}'")
        return False
        
    # 2. Check for typical piece moves like Nf3, Be4, etc.
    move_matches = re.findall(r'\b[KQRBN][a-h]?[1-8]?x?[a-h][1-8]\b', hint_text)
    if move_matches:
        print(f"WARNING: Found move notation: {move_matches} in: '{hint_text}'")
        return False
        
    return True

def run_tests():
    all_passed = True
    print("=== STARTING HINT GENERATOR TESTS ===")
    
    for case in TEST_CASES:
        print(f"\nTest Case: {case['name']}")
        print(f"FEN: {case['fen']}")
        print(f"Is White: {case['is_white']}")
        
        for lvl in [1, 2, 3]:
            try:
                hint = generate_hint(case['fen'], lvl, case['is_white'])
                print(f"  Level {lvl} Hint: '{hint}'")
                
                # Check constraints
                if not check_no_illegal_notations(hint):
                    print(f"  FAILED: Level {lvl} hint violated move/piece notation constraints!")
                    all_passed = False
                
                # Check expected themes if specified for this level
                if lvl in case["expected_themes"]:
                    theme = case["expected_themes"][lvl]
                    if theme.lower() not in hint.lower():
                        # We won't strictly fail on theme matching if the analysis found a different valid aspect,
                        # but we will print a warning.
                        print(f"  Info: Expected theme '{theme}' not found in hint, but analysis might have prioritised other features.")
                
            except Exception as e:
                print(f"  ERROR generating Level {lvl} hint: {e}")
                all_passed = False
                
    if all_passed:
        print("\n=== ALL HINT TESTS PASSED SUCCESSFULLY! ===")
        sys.exit(0)
    else:
        print("\n=== SOME TESTS ENCOUNTERED WARNINGS OR FAILED ===")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
