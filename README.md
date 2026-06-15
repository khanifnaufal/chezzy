# ♟️ Chezzy - Advanced Chess Analyzer

Chezzy is an interactive, AI-powered platform designed to analyze your chess games in depth. Powered by the **Stockfish** engine, it automatically evaluates your moves, labels tactical quality (such as *Brilliant, Good, Mistake, or Blunder*), highlights positional weaknesses, and aggregates game data into a modern analytics dashboard.

---

## 🎨 Feature Showcase

### 1. Interactive Gameplay & Real-Time Analysis
Play chess against an adaptive bot or analyze positions in Solo Analysis mode. Get centipawn evaluation, threat detection alerts, and real-time move recommendations with tactical explanations.
![Game & Real-time Analysis](images/gameplay.png)

### 2. Analytics & Weakness Dashboard
Identify your weaknesses across different game phases (Opening, Middlegame, Endgame), classify blunder patterns (hanging pieces, missed tactics, king safety, time trouble), and monitor your performance improvements via an accuracy trend line with a 3-game moving average.
![Dashboard Analisis Pattern](images/dashboard.png)

### 3. Move-by-Move History Replay
Browse all completed games and analyze your stats. The interactive replay lets you step through moves with synchronized chess board positions, evaluation graphs, and detailed annotations.
![Replay Histori Game](images/history.png)

---

## 🛠️ Tech Stack

- **Backend:** Python 3.12, FastAPI, Uvicorn, SQLAlchemy, PostgreSQL
- **Frontend:** Next.js (App Router), React, TailwindCSS, Recharts, React Chessboard, React Hot Toast
- **Chess Engine:** python-chess, Stockfish (Local UCI Executable)

---

## 📦 Installation & Setup

### 1. Install PostgreSQL

Chezzy requires PostgreSQL to persist game sessions, move lists, and analysis profiles.

#### **Windows**
1. Download the installer from [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Run the installer, configure the default user `postgres`, and set a password.
3. Open **pgAdmin** or use `psql` command line to create a database:
   ```sql
   CREATE DATABASE chezzy;
   ```

#### **macOS**
Install and start PostgreSQL service using Homebrew:
```bash
brew install postgresql@15
brew services start postgresql@15
createdb chezzy
```

#### **Linux (Ubuntu/Debian)**
Install via `apt`:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE chezzy;"
```

---

### 2. Install Stockfish Engine

#### **Windows**
1. Download the official executable from [stockfishchess.org/download](https://stockfishchess.org/download/).
2. Extract the ZIP to a directory of your choice (e.g., `C:/chess/stockfish/`).
3. Note down the path to the executable file (e.g., `C:/chess/stockfish/stockfish-windows-x86-64-avx2.exe`) to update the `.env` configuration.

#### **macOS / Linux**
Install Stockfish globally using your package manager:
```bash
# macOS
brew install stockfish

# Ubuntu/Debian
sudo apt update && sudo apt install stockfish
```

---

## ⚙️ Configuration (`.env`)

Create a `.env` file in the `backend/` directory using `.env.example` as a template. Update it with your database connection URL and Stockfish path:

```env
# Path to the Stockfish executable binary (use forward slashes "/" for path separation)
STOCKFISH_PATH="C:/chess/stockfish/stockfish-windows-x86-64-avx2.exe"

# Stockfish search depth (default is 15)
STOCKFISH_DEPTH=15

# PostgreSQL connection URL (Format: postgresql://username:password@host:port/database)
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/chezzy"
```

> [!WARNING]
> Keep your `.env` file secure and never commit it to public repositories.

---

## 🚀 Running the Application

### 1. Run Backend (FastAPI)

Ensure your Python virtual environment is activated and dependencies from `backend/requirements.txt` are installed:

```bash
# Activate virtual environment
.venv\Scripts\activate

# Start backend server from root directory
uvicorn backend.main:app --reload
```

The backend server will run at [http://localhost:8000](http://localhost:8000). You can browse the Swagger API documentation at [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Run Frontend (Next.js)

Navigate to the `frontend/` directory, install package dependencies, and run the developer server:

```bash
cd frontend
npm install
npm run dev
```

The frontend application will run at [http://localhost:3000](http://localhost:3000).

---

## 💡 Verifying WebSocket Resiliency (Testing Connection Recovery)

To verify the WebSocket reconnect feature:
1. Start a new game (VS Bot or Solo Analysis) on the homepage.
2. Make 1-2 moves to establish an active WebSocket session.
3. Shut down the backend by stopping the uvicorn process in your terminal (`Ctrl + C`).
4. You should see a **pulsing red banner** at the top of the chessboard:  
   `⚠️ Koneksi terputus, mencoba reconnect... (Percobaan X/5)`  
   and a red toast notification: `"Koneksi terputus"`.
5. Restart the uvicorn backend server in your terminal.
6. The frontend will automatically reconnect without needing a page refresh. The red banner will disappear, and a green toast notification: `"Koneksi tersambung kembali"` will appear.
