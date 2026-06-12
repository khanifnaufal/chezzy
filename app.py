import io
import os
import json
import chess
import chess.svg
import streamlit as st
from dotenv import load_dotenv

from db.database import init_db, save_game, get_all_games, get_moves_by_game
from engine.labeler import analyze_game
from parser.pgn_parser import parse_pgn

# Load env variables and init database
load_dotenv()
init_db()

# Page configuration
st.set_page_config(
    page_title="Chezzy - Chess Analyzer",
    layout="wide",
    page_icon="♟️"
)

# Custom fonts and general CSS formatting
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    /* Apply Outfit font globally */
    html, body, [class*="css"], .stMarkdown, .stText, p, h1, h2, h3, h4, h5, h6 {
        font-family: 'Outfit', sans-serif !important;
    }
    
    /* Styled headings */
    .app-title {
        font-size: 32px;
        font-weight: 700;
        color: #FFF;
        margin-bottom: 2px;
    }
    
    .app-subtitle {
        font-size: 15px;
        color: #888;
        margin-bottom: 25px;
    }
</style>
""", unsafe_allow_html=True)

# Default demonstration PGN (Opera Game by Paul Morphy)
DEFAULT_PGN = """[Event "Paris Opera"]
[Site "Paris"]
[Date "1858.??.??"]
[Round "1"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0"""

from datetime import datetime

def clean_game_meta(meta: dict) -> dict:
    """Replaces default PGN question marks with cleaner, user-friendly fallbacks."""
    cleaned = dict(meta)
    if not cleaned.get("white") or cleaned["white"].strip() == "?":
        cleaned["white"] = "White"
    if not cleaned.get("black") or cleaned["black"].strip() == "?":
        cleaned["black"] = "Black"
    if not cleaned.get("date") or "?" in cleaned["date"]:
        cleaned["date"] = datetime.now().strftime("%Y.%m.%d")
    if not cleaned.get("result") or cleaned["result"].strip() == "*":
        cleaned["result"] = "Casual"
    return cleaned

# Initialize session state variables
if "analysis_results" not in st.session_state:
    # Try loading the latest game from database as default
    games = get_all_games()
    if games:
        latest_game = games[0]
        moves = get_moves_by_game(latest_game["id"])
        st.session_state.analysis_results = moves
        st.session_state.game_metadata = clean_game_meta({
            "id": latest_game["id"],
            "white": latest_game["white"],
            "black": latest_game["black"],
            "date": latest_game["date"],
            "result": latest_game["result"],
            "pgn_raw": latest_game["pgn_raw"]
        })
        st.session_state.active_move_index = -1
        st.session_state.pgn_text = latest_game["pgn_raw"]
    else:
        st.session_state.analysis_results = None
        st.session_state.game_metadata = None
        st.session_state.active_move_index = -1
        st.session_state.pgn_text = DEFAULT_PGN
elif "pgn_text" not in st.session_state:
    st.session_state.pgn_text = DEFAULT_PGN


def format_score(score: dict) -> str:
    """Formats the score dictionary for display (e.g. +1.25 or M3)."""
    if not score:
        return "0.00"
    if score.get("type") == "mate":
        val = score.get("value")
        return f"M{val}" if val is not None else "M?"
    else:
        val = score.get("value")
        if val is None:
            return "0.00"
        pawn_val = val / 100.0
        return f"+{pawn_val:.2f}" if pawn_val > 0 else f"{pawn_val:.2f}"


def generate_moves_table_html(moves: list, active_index: int) -> str:
    """Generates a styled, scrollable HTML moves table with Javascript auto-scroll."""
    html_content = """
    <html>
    <head>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        body {
            font-family: 'Outfit', sans-serif;
            background-color: #0E1117;
            color: #E0E0E0;
            margin: 0;
            padding: 0;
        }
        .table-container {
            height: 388px;
            overflow-y: auto;
            border: 1px solid #333;
            border-radius: 8px;
            background-color: #151922;
        }
        .moves-table {
            width: 100%;
            border-collapse: collapse;
        }
        .moves-table th {
            background-color: #1F2633;
            color: #AAAAAA;
            padding: 10px;
            position: sticky;
            top: 0;
            text-align: left;
            font-size: 13px;
            border-bottom: 1px solid #333;
            z-index: 10;
        }
        .moves-table td {
            padding: 10px;
            border-bottom: 1px solid #1E2530;
            font-size: 14px;
        }
        .active-row {
            background-color: rgba(155, 93, 229, 0.25) !important;
            font-weight: 600;
            border-left: 4px solid #9B5DE5;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
        }
        .badge-brilliant { background-color: #9B5DE5; color: white; }
        .badge-good { background-color: #2ECC71; color: white; }
        .badge-inaccuracy { background-color: #F1C40F; color: #1A1A1A; }
        .badge-mistake { background-color: #E67E22; color: white; }
        .badge-blunder { background-color: #E74C3C; color: white; }
    </style>
    </head>
    <body>
    <div class="table-container" id="moves-container">
        <table class="moves-table">
            <thead>
                <tr>
                    <th style="width: 15%;">No</th>
                    <th style="width: 25%;">Move</th>
                    <th style="width: 35%;">Label</th>
                    <th style="width: 25%;">Score</th>
                </tr>
            </thead>
            <tbody>
    """
    
    for i, m in enumerate(moves):
        is_active = (i == active_index)
        row_class = " class='active-row'" if is_active else ""
        
        move_num_val = (i // 2) + 1
        no_str = f"{move_num_val}." if (i % 2 == 0) else f"{move_num_val}..."
        
        lbl = m.get("label", "Good")
        badge_class = f"badge-{lbl.lower()}"
        
        # Display the score after the move
        score_dict = m.get("score_after")
        score_str = format_score(score_dict)
        
        html_content += f"""
                <tr{row_class}>
                    <td>{no_str}</td>
                    <td>{m.get("move")}</td>
                    <td><span class="badge {badge_class}">{lbl}</span></td>
                    <td>{score_str}</td>
                </tr>
        """
        
    html_content += """
            </tbody>
        </table>
    </div>
    <script>
        window.addEventListener('DOMContentLoaded', (event) => {
            const container = document.getElementById('moves-container');
            const activeRow = container.querySelector('.active-row');
            if (activeRow) {
                activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    </script>
    </body>
    </html>
    """
    return html_content


# --- Sidebar ---
with st.sidebar:
    st.markdown('<div class="app-title">Chezzy ♟️</div>', unsafe_allow_html=True)
    st.markdown('<div class="app-subtitle">Chess Game Analyzer</div>', unsafe_allow_html=True)
    
    # PGN Input text area
    pgn_input = st.text_area(
        "PGN Input",
        value=st.session_state.pgn_text,
        height=220,
        placeholder="Paste your PGN game here..."
    )
    # Sync with session state
    st.session_state.pgn_text = pgn_input
    
    # Engine search depth
    depth_val = st.slider(
        "Stockfish Depth",
        min_value=5,
        max_value=18,
        value=15,
        step=1,
        help="Higher values are more precise but take longer."
    )
    
    # Analyze Button
    if st.button("Analyze Game", type="primary", use_container_width=True):
        if not pgn_input.strip():
            st.error("Please paste a PGN string to analyze.")
        else:
            # Parse PGN first to validate format
            parsed_meta = None
            try:
                parsed_meta = parse_pgn(pgn_input)
            except ValueError as err:
                st.error(f"PGN Error: {str(err)}")
                
            if parsed_meta:
                parsed_meta = clean_game_meta(parsed_meta)
                try:
                    # Create analysis loading layout
                    progress_container = st.empty()
                    with progress_container.container():
                        st.write("### Analyzing game moves...")
                        progress_bar = st.progress(0.0)
                        status_text = st.empty()
                        
                        def update_progress(current, total):
                            percent = float(current) / float(total)
                            progress_bar.progress(percent)
                            status_text.text(f"Evaluated move {current} of {total} plies...")
                        
                        # Run the stockfish analysis loop
                        results = analyze_game(pgn_input, depth=depth_val, progress_callback=update_progress)
                        
                    progress_container.empty()
                    
                    # Persist game and moves in database
                    with st.spinner("Saving game analysis to database..."):
                        game_data = {
                            "white": parsed_meta["white"],
                            "black": parsed_meta["black"],
                            "date": parsed_meta["date"],
                            "result": parsed_meta["result"],
                            "pgn_raw": pgn_input
                        }
                        game_id = save_game(game_data, results)
                        
                    # Update active session state
                    st.session_state.analysis_results = results
                    st.session_state.game_metadata = clean_game_meta({
                        "id": game_id,
                        "white": parsed_meta["white"],
                        "black": parsed_meta["black"],
                        "date": parsed_meta["date"],
                        "result": parsed_meta["result"],
                        "pgn_raw": pgn_input
                    })
                    st.session_state.active_move_index = -1
                    st.toast("Game successfully analyzed and saved!", icon="✅")
                    st.rerun()
                    
                except Exception as err:
                    st.error(f"Analysis Failed: {str(err)}")
                    
    st.markdown("---")
    
    # Game History Selector
    st.subheader("Game History")
    games_history = get_all_games()
    if games_history:
        game_options = {}
        for g in games_history:
            cleaned_g = clean_game_meta(g)
            game_options[g["id"]] = f"{cleaned_g['white']} vs {cleaned_g['black']} ({cleaned_g['date']})"
            
        game_ids = list(game_options.keys())
        game_labels = list(game_options.values())
        
        # Find index of currently loaded game to set as selectbox default
        active_game_id = st.session_state.game_metadata.get("id") if st.session_state.game_metadata else None
        default_idx = 0
        if active_game_id in game_ids:
            default_idx = game_ids.index(active_game_id)
            
        selected_game_label = st.selectbox(
            "Select a game to load:",
            options=game_labels,
            index=default_idx
        )
        
        selected_game_id = game_ids[game_labels.index(selected_game_label)]
        
        # Load the selected game from history if changed
        if active_game_id != selected_game_id:
            loaded_game = next(g for g in games_history if g["id"] == selected_game_id)
            moves = get_moves_by_game(selected_game_id)
            
            st.session_state.analysis_results = moves
            st.session_state.game_metadata = clean_game_meta({
                "id": selected_game_id,
                "white": loaded_game["white"],
                "black": loaded_game["black"],
                "date": loaded_game["date"],
                "result": loaded_game["result"],
                "pgn_raw": loaded_game["pgn_raw"]
            })
            st.session_state.active_move_index = -1
            st.session_state.pgn_text = loaded_game["pgn_raw"]
            st.rerun()
    else:
        st.info("No games in history database.")


# --- Main Area ---
if st.session_state.analysis_results is None:
    # Welcome card if no game is loaded or analyzed
    st.markdown("""
    <div style="text-align: center; margin-top: 80px;">
        <h1 style="font-size: 52px; font-weight: 700; color: #FFF; margin-bottom: 5px;">Chezzy ♟️</h1>
        <p style="font-size: 18px; color: #888; margin-bottom: 35px;">Premium Chess Game Analyzer & Replayer</p>
        <div style="background-color: #151922; padding: 25px 35px; border-radius: 12px; display: inline-block; border: 1px solid #2B3547; max-width: 550px; text-align: left; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <p style="color: #DDD; font-size: 16px; margin: 0 0 12px 0; font-weight: bold; border-bottom: 1px solid #2B3547; padding-bottom: 8px;">🚀 Quick Start Guide</p>
            <ol style="color: #BBB; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.7;">
                <li style="margin-bottom: 8px;">Paste a PGN game in the sidebar text box.</li>
                <li style="margin-bottom: 8px;">Choose your desired <strong>Stockfish Depth</strong> (default 15).</li>
                <li style="margin-bottom: 8px;">Press the <strong>Analyze Game</strong> button.</li>
                <li style="margin-bottom: 8px;">Alternatively, select any previously analyzed game from the <strong>Game History</strong> list.</li>
            </ol>
        </div>
    </div>
    """, unsafe_allow_html=True)
else:
    meta = st.session_state.game_metadata
    results = st.session_state.analysis_results
    active_idx = st.session_state.active_move_index
    total_moves = len(results)
    
    # Metadata Title Card
    st.markdown(f"""
    <div style="background-color: #151922; padding: 18px 22px; border-radius: 8px; border: 1px solid #2B3547; margin-bottom: 25px; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
        <h2 style="margin: 0; font-size: 26px; color: #FFF; font-weight: 600; letter-spacing: -0.5px;">{meta['white']} vs {meta['black']}</h2>
        <p style="margin: 6px 0 0 0; color: #8C9BB4; font-size: 14px; font-weight: 500;">📅 Date: {meta['date']} &nbsp;|&nbsp; 🏆 Result: {meta['result']}</p>
    </div>
    """, unsafe_allow_html=True)
    
    # 2 Column layout
    col_board, col_table = st.columns([1.1, 0.9], gap="large")
    
    # Left Column: Chess Board & Replay controls
    with col_board:
        # Construct chess.Board up to the active move index
        board = chess.Board()
        for i in range(active_idx + 1):
            board.push_san(results[i]["move"])
            
        last_move = board.peek() if active_idx >= 0 else None
        
        # Highlight king square if in check
        is_check = board.is_check()
        check_square = board.king(board.turn) if is_check else None
        
        # Generate SVG string
        svg_data = chess.svg.board(
            board=board,
            lastmove=last_move,
            check=check_square,
            size=388
        )
        
        # Center board inside an iframe
        board_html = f"""
        <div style="display: flex; justify-content: center; align-items: center; background-color: #0E1117; height: 388px; width: 388px; margin: auto;">
            {svg_data}
        </div>
        """
        st.components.v1.html(board_html, height=388, width=388)
        
        # Centered Replay Navigation Buttons
        st.markdown("<div style='margin-top: 15px;'></div>", unsafe_allow_html=True)
        btn_prev, btn_lbl, btn_next = st.columns([1, 2, 1])
        
        with btn_prev:
            if st.button("←", use_container_width=True, disabled=(active_idx <= -1)):
                st.session_state.active_move_index -= 1
                st.rerun()
                
        with btn_lbl:
            if active_idx == -1:
                move_txt = "Start Position"
            else:
                m_info = results[active_idx]
                m_num = (active_idx // 2) + 1
                player = "White" if active_idx % 2 == 0 else "Black"
                move_txt = f"{m_num}{'.' if player == 'White' else '...'} {m_info['move']} ({player})"
            st.markdown(f"<p style='text-align: center; margin-top: 5px; font-weight: 600; font-size: 15px; color: #FFF;'>{move_txt}</p>", unsafe_allow_html=True)
            
        with btn_next:
            if st.button("→", use_container_width=True, disabled=(active_idx >= total_moves - 1)):
                st.session_state.active_move_index += 1
                st.rerun()
                
        # Game review label counts card
        labels = [r["label"] for r in results]
        brilliant_cnt = labels.count("Brilliant")
        good_cnt = labels.count("Good")
        inacc_cnt = labels.count("Inaccuracy")
        mistake_cnt = labels.count("Mistake")
        blunder_cnt = labels.count("Blunder")
        
        st.markdown(f"""
        <div style="display: flex; gap: 8px; justify-content: space-between; margin-top: 25px; background-color: #151922; padding: 15px; border-radius: 8px; border: 1px solid #2B3547; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <div style="text-align: center; flex: 1;">
                <div style="color: #9B5DE5; font-size: 20px; font-weight: 700;">{brilliant_cnt}</div>
                <div style="color: #8C9BB4; font-size: 11px; font-weight: 600; margin-top: 2px;">Brilliant</div>
            </div>
            <div style="text-align: center; flex: 1; border-left: 1px solid #2B3547;">
                <div style="color: #2ECC71; font-size: 20px; font-weight: 700;">{good_cnt}</div>
                <div style="color: #8C9BB4; font-size: 11px; font-weight: 600; margin-top: 2px;">Good</div>
            </div>
            <div style="text-align: center; flex: 1; border-left: 1px solid #2B3547;">
                <div style="color: #F1C40F; font-size: 20px; font-weight: 700;">{inacc_cnt}</div>
                <div style="color: #8C9BB4; font-size: 11px; font-weight: 600; margin-top: 2px;">Inaccuracy</div>
            </div>
            <div style="text-align: center; flex: 1; border-left: 1px solid #2B3547;">
                <div style="color: #E67E22; font-size: 20px; font-weight: 700;">{mistake_cnt}</div>
                <div style="color: #8C9BB4; font-size: 11px; font-weight: 600; margin-top: 2px;">Mistake</div>
            </div>
            <div style="text-align: center; flex: 1; border-left: 1px solid #2B3547;">
                <div style="color: #E74C3C; font-size: 20px; font-weight: 700;">{blunder_cnt}</div>
                <div style="color: #8C9BB4; font-size: 11px; font-weight: 600; margin-top: 2px;">Blunder</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
    # Right Column: Move Analysis Table
    with col_table:
        table_html = generate_moves_table_html(results, active_idx)
        st.components.v1.html(table_html, height=390)
