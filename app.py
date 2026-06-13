import io
import os
import json
import chess
import chess.svg
import streamlit as st
import plotly.graph_objects as go
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


def convert_score_to_cp(score: dict) -> float:
    """Converts a score dictionary (cp or mate) to a numerical centipawn value.
    Mate is represented as a high centipawn value.
    """
    if not isinstance(score, dict) or "type" not in score or "value" not in score:
        return 0.0
        
    if score["type"] == "mate":
        mate_val = score["value"]
        if mate_val > 0:
            # White mates in mate_val moves. Faster mate = higher value.
            return 10000.0 - mate_val * 100.0
        elif mate_val < 0:
            # Black mates in abs(mate_val) moves. Faster mate = more negative.
            return -10000.0 - mate_val * 100.0
        else:
            return 0.0
            
    return float(score["value"])


def calculate_game_stats(results: list) -> dict:
    """Calculates accuracies, move classifications, and the worst move of the game."""
    white_losses = []
    black_losses = []
    
    worst_move = None
    max_loss = -float('inf')
    
    white_counts = {"Brilliant": 0, "Good": 0, "Inaccuracy": 0, "Mistake": 0, "Blunder": 0}
    black_counts = {"Brilliant": 0, "Good": 0, "Inaccuracy": 0, "Mistake": 0, "Blunder": 0}
    
    for idx, m in enumerate(results):
        is_white = (idx % 2 == 0)
        
        # Convert scores to centipawns
        before_cp = convert_score_to_cp(m.get("score_before"))
        after_cp = convert_score_to_cp(m.get("score_after"))
        
        # Centipawn loss (from player's perspective)
        if is_white:
            loss = before_cp - after_cp
        else:
            loss = after_cp - before_cp
            
        # For accuracy, use capped losses at 0
        capped_loss = max(0.0, loss)
        
        if is_white:
            white_losses.append(capped_loss)
            lbl = m.get("label", "Good")
            if lbl in white_counts:
                white_counts[lbl] += 1
        else:
            black_losses.append(capped_loss)
            lbl = m.get("label", "Good")
            if lbl in black_counts:
                black_counts[lbl] += 1
                
        # Track worst move (largest raw centipawn loss)
        if loss > max_loss:
            max_loss = loss
            move_num = (idx // 2) + 1
            player_str = "White" if is_white else "Black"
            move_label = f"{move_num}. {m['move']}" if is_white else f"{move_num}... {m['move']}"
            worst_move = {
                "move": move_label,
                "player": player_str,
                "loss": loss
            }
            
    # Calculate accuracies: 100 - average_centipawn_loss
    # Cap individual losses at 300 to prevent a single blunder from dropping accuracy to 0%
    def get_accuracy(losses):
        if not losses:
            return 100.0
        capped_losses = [min(300.0, l) for l in losses]
        avg_loss = sum(capped_losses) / len(capped_losses)
        return max(0.0, min(100.0, 100.0 - avg_loss))
        
    white_acc = get_accuracy(white_losses)
    black_acc = get_accuracy(black_losses)
    
    return {
        "white_accuracy": white_acc,
        "black_accuracy": black_acc,
        "white_counts": white_counts,
        "black_counts": black_counts,
        "worst_move": worst_move
    }


def generate_evaluation_chart(results: list) -> go.Figure:
    """Generates an interactive Plotly evaluation line chart."""
    x_moves = ["Start"]
    # Build y evaluations. Start position evaluation:
    start_score = results[0]["score_before"] if results else {"type": "cp", "value": 0}
    
    def get_graph_score(score: dict) -> float:
        if not score:
            return 0.0
        if score.get("type") == "mate":
            val = score.get("value")
            if val is None:
                return 0.0
            # Represent mate as 10.0 or -10.0 pawns
            return 10.0 if val > 0 else -10.0
        else:
            val = score.get("value")
            if val is None:
                return 0.0
            # Cap centipawn score to [-1000, 1000] and convert to pawns
            return max(-10.0, min(10.0, float(val) / 100.0))
            
    y_evals = [get_graph_score(start_score)]
    hover_texts = [f"<b>Start Position</b><br>Evaluation: {format_score(start_score)}"]
    
    for idx, m in enumerate(results):
        move_num = (idx // 2) + 1
        player = "White" if idx % 2 == 0 else "Black"
        move_label = f"{move_num}. {m['move']}" if idx % 2 == 0 else f"{move_num}... {m['move']}"
        
        score_after = m.get("score_after")
        score_str = format_score(score_after)
        lbl = m.get("label", "Good")
        
        x_moves.append(move_label)
        y_evals.append(get_graph_score(score_after))
        hover_texts.append(
            f"<b>Move: {move_label}</b> ({player})<br>"
            f"Evaluation: {score_str}<br>"
            f"Label: {lbl}"
        )
        
    # Determine dynamic Y-axis range (minimum [-2.0, 2.0] pawns)
    min_val = min(y_evals)
    max_val = max(y_evals)
    y_min_margin = min(-2.0, min_val - 0.5)
    y_max_margin = max(2.0, max_val + 0.5)
    
    # Create the Plotly figure
    fig = go.Figure()
    
    # 1. Add bottom baseline trace to fill against (transparent line at y_min_margin)
    fig.add_trace(go.Scatter(
        x=x_moves,
        y=[y_min_margin] * len(y_evals),
        mode='lines',
        line=dict(color='rgba(0,0,0,0)'),
        showlegend=False,
        hoverinfo='skip'
    ))
    
    # 2. Add main evaluation trace that fills to the baseline trace (tonexty)
    fig.add_trace(go.Scatter(
        x=x_moves,
        y=y_evals,
        mode='lines+markers',
        line=dict(color='#9B5DE5', width=3),
        marker=dict(size=6, color='#9B5DE5', symbol='circle'),
        fill='tonexty',
        fillcolor='rgba(21, 25, 34, 0.95)', # Dark/black background for below curve
        name='Evaluation',
        hoverinfo='text',
        hovertext=hover_texts
    ))
    
    # 3. Add horizontal dashed line at Y=0 (equal position)
    fig.add_hline(
        y=0,
        line_dash="dash",
        line_color="rgba(128, 128, 128, 0.4)",
        line_width=1.5
    )
    
    # Update layout to style the chart
    fig.update_layout(
        margin=dict(l=40, r=20, t=20, b=40),
        height=380,
        hovermode='x unified',
        plot_bgcolor='rgba(240, 240, 240, 0.95)', # Soft off-white for above curve
        paper_bgcolor='#0E1117', # Matches streamlit's dark theme
        xaxis=dict(
            title="Moves",
            color="#8C9BB4",
            gridcolor="rgba(255, 255, 255, 0.05)",
            showgrid=True,
            tickangle=-45,
            tickfont=dict(size=10)
        ),
        yaxis=dict(
            title="Score (Pawns)",
            color="#8C9BB4",
            gridcolor="rgba(255, 255, 255, 0.05)",
            showgrid=True,
            range=[y_min_margin, y_max_margin]
        ),
        showlegend=False
    )
    
    return fig



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

    # --- Post-Game Summary & Evaluation Graph (Below board and table) ---
    stats = calculate_game_stats(results)
    
    st.markdown("<hr style='border-color: #2B3547; margin: 30px 0;'/>", unsafe_allow_html=True)
    st.markdown("<h3 style='color: #FFF; font-weight: 600; margin-bottom: 20px;'>📊 Post-Game Summary</h3>", unsafe_allow_html=True)
    
    # Row 1: Key Metrics (Accuracies & Worst Move)
    col_acc1, col_acc2, col_worst = st.columns([1, 1, 2])
    with col_acc1:
        st.metric(label="White Accuracy", value=f"{stats['white_accuracy']:.1f}%")
    with col_acc2:
        st.metric(label="Black Accuracy", value=f"{stats['black_accuracy']:.1f}%")
    with col_worst:
        w_move = stats.get("worst_move")
        if w_move:
            pawn_loss = w_move['loss'] / 100.0
            if w_move['loss'] >= 9000.0:
                delta_str = "Mate Blunder"
            else:
                delta_str = f"-{pawn_loss:.2f} pawns"
            st.metric(label=f"Worst Move ({w_move['player']})", value=w_move['move'], delta=delta_str, delta_color="normal")
        else:
            st.metric(label="Worst Move", value="None")
            
    # Row 2: Detailed Move Classification Counts
    st.markdown("<div style='margin-top: 25px;'></div>", unsafe_allow_html=True)
    col_w, col_b = st.columns(2, gap="large")
    
    with col_w:
        st.markdown(f"<p style='color: #E0E0E0; font-weight: 600; margin-bottom: 12px;'>⚪ {meta['white']} (White) Breakdowns</p>", unsafe_allow_html=True)
        w_cols = st.columns(5)
        w_cols[0].metric("Brilliant", stats['white_counts']['Brilliant'])
        w_cols[1].metric("Good", stats['white_counts']['Good'])
        w_cols[2].metric("Inaccuracy", stats['white_counts']['Inaccuracy'])
        w_cols[3].metric("Mistake", stats['white_counts']['Mistake'])
        w_cols[4].metric("Blunder", stats['white_counts']['Blunder'])
        
    with col_b:
        st.markdown(f"<p style='color: #E0E0E0; font-weight: 600; margin-bottom: 12px;'>⚫ {meta['black']} (Black) Breakdowns</p>", unsafe_allow_html=True)
        b_cols = st.columns(5)
        b_cols[0].metric("Brilliant", stats['black_counts']['Brilliant'])
        b_cols[1].metric("Good", stats['black_counts']['Good'])
        b_cols[2].metric("Inaccuracy", stats['black_counts']['Inaccuracy'])
        b_cols[3].metric("Mistake", stats['black_counts']['Mistake'])
        b_cols[4].metric("Blunder", stats['black_counts']['Blunder'])
        
    st.markdown("<hr style='border-color: #2B3547; margin: 30px 0;'/>", unsafe_allow_html=True)
    st.markdown("<h3 style='color: #FFF; font-weight: 600; margin-bottom: 15px;'>📈 Position Evaluation Graph</h3>", unsafe_allow_html=True)
    
    fig = generate_evaluation_chart(results)
    st.plotly_chart(fig, use_container_width=True)

