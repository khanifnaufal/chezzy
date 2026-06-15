# ♟️ Chezzy - Chess Analyzer

Chezzy adalah platform interaktif bertenaga AI untuk menganalisis permainan catur Anda secara mendalam menggunakan engine **Stockfish**, mendeteksi kelemahan taktis Anda secara statistik melalui grafik yang modern, serta menyediakan analisis taktis dan heuristik move demi move secara real-time.

---

## 🎨 Screenshot Fitur Utama

### 1. Game & Real-time Analysis
Bermain catur melawan bot atau menganalisis langkah sendiri secara solo. Dilengkapi dengan evaluasi centipawn, deteksi ancaman lawan secara cerdas, dan rekomendasi langkah terbaik dari Stockfish dalam bahasa Indonesia.
![Game & Real-time Analysis](images/gameplay.png)

### 2. Dashboard Analisis Pattern
Analisis mendalam mengenai kelemahan fase catur Anda (Opening, Middlegame, Endgame), klasifikasi tipe blunder (seperti perwira gantung, taktik terlewat, keamanan raja), dan tren akurasi catur menggunakan moving average 3-game.
![Dashboard Analisis Pattern](images/dashboard.png)

### 3. Replay Histori Game
Lihat kembali game-game yang sudah selesai dimainkan beserta akurasi akhir masing-masing pemain. Navigasi move demi move disinkronkan langsung dengan papan catur, grafik evaluasi, dan catatan analisis dari Stockfish.
![Replay Histori Game](images/history.png)

---

## 🛠️ Persyaratan System & Instalasi

### 1. Instalasi PostgreSQL

Chezzy memerlukan database PostgreSQL untuk menyimpan data permainan, move catur, dan metadata sesi.

#### **Windows**
1. Unduh installer PostgreSQL dari [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. Jalankan installer, ikuti instruksi, dan tentukan password untuk pengguna default `postgres`.
3. Setelah instalasi selesai, buka **pgAdmin** atau gunakan command-line `psql` untuk membuat database baru bernama `chezzy`:
   ```sql
   CREATE DATABASE chezzy;
   ```

#### **macOS**
Gunakan Homebrew untuk instalasi dan menjalankan service PostgreSQL:
```bash
brew install postgresql@15
brew services start postgresql@15
createdb chezzy
```

#### **Linux (Ubuntu/Debian)**
Gunakan apt package manager:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE chezzy;"
```

---

### 2. Instalasi Stockfish

Chezzy menggunakan Stockfish engine untuk melakukan evaluasi posisional catur.

#### **Windows**
1. Unduh binary resmi Stockfish dari [stockfishchess.org/download](https://stockfishchess.org/download/).
2. Ekstrak file ZIP yang diunduh ke folder lokal pilihan Anda (misalnya `C:/chess/stockfish/`).
3. Catat lokasi file executable `.exe` tersebut untuk dimasukkan ke konfigurasi `.env`.

#### **macOS / Linux**
Instal Stockfish secara global menggunakan package manager:
```bash
# macOS
brew install stockfish

# Ubuntu/Debian
sudo apt update && sudo apt install stockfish
```

---

## ⚙️ Setup File Konfigurasi `.env`

Buat file bernama `.env` di dalam folder `backend/` dengan mencontoh template dari `.env.example`. Masukkan path Stockfish dan URL koneksi database PostgreSQL Anda:

```env
# Path ke executable Stockfish (gunakan forward slash / pada path)
STOCKFISH_PATH="C:/chess/stockfish/stockfish-windows-x86-64-avx2.exe"

# Kedalaman pencarian analisis engine Stockfish (Default: 15)
STOCKFISH_DEPTH=15

# URL Database PostgreSQL (Format: postgresql://username:password@host:port/database)
DATABASE_URL="postgresql://postgres:password_kamu@localhost:5432/chezzy"
```

> [!WARNING]
> Jangan pernah meng-upload file `.env` ke repositori publik Anda untuk menjaga keamanan kredensial database lokal.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Jalankan Backend (FastAPI)

Pastikan virtual environment telah diaktifkan, dependensi di `backend/requirements.txt` sudah terinstal, lalu jalankan server FastAPI:

```bash
# Aktifkan virtual environment (jika belum)
.venv\Scripts\activate

# Jalankan backend dari root directory
uvicorn backend.main:app --reload
```

Server backend akan aktif di [http://localhost:8000](http://localhost:8000). Anda dapat mengakses dokumentasi API otomatis (Swagger UI) di [http://localhost:8000/docs](http://localhost:8000/docs).

### 2. Jalankan Frontend (Next.js)

Masuk ke folder `frontend/`, instal dependensi, lalu jalankan server developer Next.js:

```bash
cd frontend
npm install
npm run dev
```

Server frontend akan berjalan di [http://localhost:3000](http://localhost:3000).

---

## 💡 Cara Verifikasi & Testing Fitur Reconnect

Untuk memverifikasi fungsionalitas ketahanan koneksi WebSocket:
1. Mulai game baru (VS Bot atau Solo Analisis) di halaman utama.
2. Lakukan beberapa langkah agar koneksi aktif terjalin.
3. Matikan uvicorn backend di terminal Anda.
4. Anda akan melihat **banner merah** berdenyut bertuliskan `"Koneksi terputus, mencoba reconnect..."` dengan status counter percobaan (maksimal 5 kali) di bagian atas papan catur, serta notifikasi toast `"Koneksi terputus"`.
5. Nyalakan kembali server uvicorn backend Anda sebelum percobaan reconnect berakhir.
6. Halaman catur akan tersambung kembali secara otomatis tanpa perlu merefresh halaman web, banner merah akan hilang, dan notifikasi toast hijau `"Koneksi tersambung kembali"` akan muncul.
