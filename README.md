# ShipLocate Reports & Analytics Dashboard

Interactive analytical dashboard for tracking transportation metrics, carrier capacity, customer dwell times, lanes rate seasonality, and compliance funnels.

## 🚀 Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts (premium interactive graphs).
- **Data Pipeline**: Python 3 (PostgreSQL connector) with datetime and decimal serialization.
- **Styling Design**: Custom premium dark/light mode layout, glassmorphic card containers, customized harmonious HSL color system, and regular font weights (`400`) for visual elegance.

---

## 📂 Project Structure
- `prepare_frontend_data.py`: Ingestion script that queries the live PostgreSQL database and aggregates raw statistics into a structured JSON.
- `reports-frontend/`: The React-Vite SPA dashboard.
  - `src/components/OverviewTab.tsx`: Key high-level trends, volume MoM/YoY charts, and heatmaps.
  - `src/components/LocationTab.tsx`: Facility dwell times, detention risk audits, and interactive state maps.
  - `src/components/CarriersTab.tsx`: Active carrier statistics, volume distribution (TL vs LTL), and delay profiles.
  - `src/components/LanesTab.tsx`: Rate comparison sheets, seasonality charts, and lane statistics.
  - `src/components/TransitTab.tsx`: On-time arrival (OTA) vs On-time delivery (OTD) audits.
  - `src/components/DriversTab.tsx`: Mobile app adoption funnel tracking and carrier compliance logs.
  - `src/components/RiskTab.tsx`: Exposure mitigation logs (carrier concentration, expired insurance tracking).

---

## 🛠️ Installation & Setup

### 1. Ingest Database Records (Python)
Ensure Python 3 is installed with database connectors:
```bash
pip install psycopg2-binary
```
Create a local `.env` file in the root directory with the database connection credentials:
```env
DB_HOST=167.114.144.196
DB_PORT=5432
DB_NAME=postgres
DB_USER=shiplocate
DB_PASSWORD=your_password
```
Run the data extraction script to generate `/src/lib/real-data.json`:
```bash
python prepare_frontend_data.py
```

### 2. Start Local React Development Server
Go to the frontend directory:
```bash
cd reports-frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Build Production Bundle
To create a optimized production build:
```bash
npm run build
```
The static files will be output to `reports-frontend/dist/`.

---

## 📦 Committing to Git & GitHub
I have already initialized Git, configured remote origin, and made the initial commit.

To push all project files to your GitHub repository:
```bash
git push -u origin main
```
