# ShipLocate Reports & Analytics Dashboard

Interactive analytical dashboard for tracking transportation metrics, carrier capacity, customer dwell times, lanes rate seasonality, and compliance funnels.

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
Run the data extraction script to query the database, perform cleaning/normalization, and generate `reports-frontend/src/lib/real-data.json`:
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
To create an optimized production build:
```bash
npm run build
```
The static files will be output to `reports-frontend/dist/`, ready to be served by any web server (Nginx, Apache) or integrated into a Node.js project.

---

## 📂 Active Navigation Tabs
1. **📊 Overview**: High-level KPIs, monthly/daily volume combos, day-of-week heatmaps, and top rankings.
2. **📍 Location**: Detailed receiver/shipper dwell times, detention risk calculations, physical point-of-delivery copyable address grids, and interactive states heatmap.
3. **🚛 Carrier**: Detailed carrier list, volume splits (TL vs LTL), drops tracking, and OTD check-in delay distribution.
4. **🛣️ Lanes**: Route spend, average rate, market leakage analysis, carrier volume share, and MoM rate seasonality curves.
5. **⏱️ Transit**: On-time arrival (OTA) check-in grace audits, on-time delivery (OTD) completion audits, and hourly/weekday delay analysis charts.
6. **📱 Drivers**: Driver app adoption funnels, Compliance logs, and compliance ranking metrics.
7. **🎯 Risks**: Carrier/customer concentrations, expired insurance alerts, and exposure tracking.

---

## ⚙️ Business Logic & Data Calculations

### On-Time Arrival (OTA) vs On-Time Delivery (OTD)
- **On-Time Arrival (OTA)**: Driver check-in is considered on-time if it occurs within **30 minutes** of the scheduled appointment time (`planned_at`).
- **On-Time Delivery (OTD)**: Delivery is considered on-time if check-out/completion is finished within **2 hours** of the planned time.
- **Facility Dwell & Detention Risk**: Average time spent at a facility (Check-Out minus Check-In). Detention risk represents the percentage of visits that exceed the **2-hour free buffer** (calculated as `dwell_mins > 120`).

### Driver Close Funnel (Self Close vs Manual Close)
- **driver_self (Self-Close)**: If the driver manually pressed "Delivered" inside the mobile app (creating a `DRIVER_DELIVERED` event log) prior to system close.
- **office_manual (Manual Close)**: If the driver forgot to use the app or has no phone number, forcing the office/dispatcher to complete the load manually in the system.
- **office_auto (Auto Close)**: If the driver had a phone number and was assigned but did not accept the load, resulting in automatic system/office check-out.

### Regional Zone Mapping (ZIP-3)
Zones are classified based on the first 3 digits of the destination ZIP code or provincial codes:
- **Canada East (Quebec)**: QC / **Ontario**: ON
- **NYC / Long Island**: ZIP 100-119
- **Upstate NY**: ZIP 120-149
- **Northern NJ**: ZIP 070-079, 088-089
- **Southern NJ**: ZIP 080-087
- **Eastern PA**: ZIP 170-196
- **Western PA**: ZIP 150-169
- **Capital Region / Mid-Atlantic**: MD, DE, DC, Northern VA (ZIP 201, 220-223)

---

## 🎨 UI & Design Standards (Tailwind CSS v4)
- **Shared Brand HSL Colors**:
  - Blue (`--brand-blue`): Primary actions and spend highlights.
  - Green (`--brand-green`): Positive growth, high OTA, and single-stop (TL) indicators.
  - Yellow (`--brand-yellow`): Multi-stop (LTL) and warning/caution indicators.
  - Red (`--brand-red`): Risk, high detention, and insurance expiration alerts.
- **Theme Variables**: Defined in `src/index.css` under `@theme`. Supports dark mode using the `.dark` class.
- **Global Typography Rule**: Every font weight has been set to regular (`font-weight: 400 !important` globally in `index.css`) to enforce a clean, uniform design.
- **SafeHeaderTooltip**: Dynamic tooltips configured on headers rendering downwards (`top-full mt-1.5`) with side-aware shifts (`left` alignment for leftmost columns, `center` for middle columns, `right` for rightmost columns) to prevent clipping.

---

## ⚡ Integration Guide (Hand-off to Devs)
To connect this React-Vite front-end directly to a live production backend/REST API:
1. **API Integration**: Replace the `mockData` / `real-data.json` imports in `App.tsx` with a `fetch` or `react-query` call to your backend.
2. **Data Structure**: The front-end expects a single JSON payload matching the schema in `real-data.json`. Ensure your endpoint output conforms to this structure or map the JSON fields in `App.tsx` directly.
3. **Authentication**: Wrap the `App` component inside your own OAuth2/JWT context wrapper.
