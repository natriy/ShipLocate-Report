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
Run the data extraction script to query the database (or fall back to local JSON arrays in `database-json/` if database connection parameters are missing), perform cleaning/normalization, and generate `reports-frontend/src/lib/real-data.json`:
```bash
# By default, filters for FMS Fresh Produce (organizationid = 2)
python prepare_frontend_data.py

# To generate report data for a different organization (e.g., organizationid = 5)
ORG_ID=5 python prepare_frontend_data.py
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

## ⚡ Integration Guide & Database SQL Specification (Hand-off to Devs)

This dashboard is designed to run in a multi-tenant environment. When integrating it into the main project, the backend API should query the PostgreSQL database dynamically based on the logged-in user's context.

### ⚠️ Critical Rule: Dynamic Multi-Tenancy
> [!IMPORTANT]
> **Do not hardcode `organizationid = 2`.**
> `organizationid = 2` corresponds to the development tenant *FMS Fresh Produce*. In production, you must resolve the active organization ID dynamically from the user's session context or JWT token and filter all database queries using:
> `WHERE organizationid = :current_user_org_id`

---

### 💻 Frontend Architecture & Client-Side Aggregation

The React frontend utilizes **React 19**, **Tailwind CSS v4 (with `@tailwindcss/vite` compiler)**, and **Recharts** for visualizations.

#### 1. State Flow and Calculations
- **`App.tsx`** is the master coordinator. It imports the raw payload (`real-data.json` or live REST response) and performs the date filtering, range selection, and metrics calculations inside a single memoized function `getAggregatedData`.
- The aggregated metrics (`carrMap`, `custMap`, `zonesMap`, `lanesMap`, `globalCompliance`, etc.) are passed down as props to the modular tab components in `src/components/`.

#### 2. Scaling Recommendation (API vs Client-Side)
- **Small-to-Medium Tenants**: Keeping aggregation client-side is ideal since it enables instant filtering by date range, switching currencies, and checking concentrations in milliseconds without hitting the database.
- **Enterprise-Scale Tenants**: If a tenant has tens of thousands of loads, loading all load records onto the client will impact performance. The developer should refactor the data flow to move these aggregation functions (`getAggregatedData` logic) to backend database queries (e.g. running Group By aggregations directly in Postgres) and load tab-specific data on-demand.

#### 3. Currency Conversion (USD ➔ CAD)
- All spend values in the database should be logged in a base currency (typically USD).
- The frontend supports a dynamic exchange rate switch (e.g. 1.36 CAD/USD). When CAD is selected, `App.tsx` automatically scales all spend shares client-side. The API endpoint does not need to return CAD converted values.

#### 4. Year-over-Year (YoY) Comparison Logic
- YoY comparison metrics (rendered on the Overview tab) are computed dynamically by calling `getAggregatedData` on the same date range shifted back by the offset years (e.g. `startDate.year - offset`).

---

### 🗄️ Database Schema & Entities

The dashboard aggregates metrics from the following core PostgreSQL tables:
1. **`tc_loads`**: Main load records.
   - `id` (integer, PK): Unique load ID.
   - `uniqueid` (varchar): External reference identifier.
   - `organizationid` (integer): Tenant identifier.
   - `loadstatus` (integer): Current state (5 = Closed/Completed, 0/1/3/4 = Active).
   - `carrierid` (integer): Links to `tc_carriers`.
   - `phone` (varchar): Driver's phone number.
   - `attributes` (jsonb/text): Contains the carrier rate (e.g., `{"rate": "1500.00"}`).
2. **`tc_carriers`**: Carrier directory.
   - `id` (integer, PK): Unique carrier ID.
   - `name` (varchar): Carrier company name.
   - `organizationid` (integer): Tenant identifier.
   - `insuranceexpiry` (timestamp): Cargo/auto insurance expiration date.
   - `deleted` (boolean): Soft-delete flag.
3. **`tc_locations`**: Facility locations (Shippers and Receivers).
   - `id` (integer, PK): Unique facility ID.
   - `name` (varchar): Facility name.
   - `address` (varchar): Physical address.
4. **`tc_stops`**: Stops mapped to loads.
   - `id` (integer, PK): Unique stop ID.
   - `loadid` (integer): Links to `tc_loads`.
   - `locationid` (integer): Links to `tc_locations`.
   - `stopindex` (integer): Execution sequence (0-indexed).
   - `type` (integer): Stop role (`0` = Pickup, `1` or `2` = Delivery/Drop).
   - `date` (timestamp): Scheduled appointment date/time (UTC).
   - `enteredat` (timestamp): Actual driver check-in timestamp (UTC).
   - `completedat` (timestamp): Stop completion timestamp (UTC).
   - `exitedat` (timestamp): Actual driver check-out timestamp (UTC).
5. **`tc_load_progress_events`**: Detailed logs of driver interactions inside the mobile app.
   - `id` (integer, PK): Unique event log ID.
   - `loadid` (integer): Links to `tc_loads`.
   - `type` (varchar): Event action type (e.g., `SMS_DELIVERY_SENT`, `DRIVER_LOGGED_IN`, `DRIVER_ACCEPTED`, `DRIVER_DELIVERED`).
   - `createdat` (timestamp): Event trigger timestamp (UTC).
6. **`tc_load_status_changes`**: Historical trail of status transitions.
   - `id` (integer, PK): Unique change log ID.
   - `loadid` (integer): Links to `tc_loads`.
   - `status` (integer): Target load status state.
   - `createdat` (timestamp): Transition timestamp.

---

### ⏱️ Timezone Normalization & Date Alignment
All timestamps inside the database are stored in UTC. For accurate daily, weekday, and monthly aggregations, you must normalize dates to the local shipping office's business day.
- Apply a timezone offset (e.g. **-8 hours** or **-4 hours** depending on the tenant's configuration) when formatting the origin stop's planned date.
- Example SQL adjustment:
  ```sql
  (s.date AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date AS shipping_date
  ```

---

### 🔍 Core Calculation Queries

Below are standard SQL queries and calculations to build the REST API endpoints:

#### 1. Trip Type Classification (TL vs LTL)
A load is classified as **TL** (Truckload - single delivery) if it has exactly 1 delivery stop, or **LTL** (Less-Than-Truckload - multi-stop delivery) if it has 2 or more delivery stops.
```sql
SELECT 
    l.id AS load_id,
    CASE 
        -- Count stops with type 1 or 2 (deliveries)
        WHEN COUNT(s.id) FILTER (WHERE s.type IN (1, 2)) > 1 THEN 'LTL'
        ELSE 'TL'
    END AS trip_type
FROM tc_loads l
LEFT JOIN tc_stops s ON l.id = s.loadid
WHERE l.organizationid = :tenant_id
GROUP BY l.id;
```

#### 2. Spend Allocation Per Customer/Stop
Load cost is stored inside the JSONB `attributes` column under the key `rate`. For LTL loads, the total rate is split evenly among all delivery locations (stops with `type IN (1,2)`).
```sql
SELECT 
    l.id AS load_id,
    COALESCE((l.attributes::jsonb->>'rate')::numeric, 0.00) AS total_spend,
    COUNT(s.id) FILTER (WHERE s.type IN (1, 2)) AS delivery_count,
    CASE 
        WHEN COUNT(s.id) FILTER (WHERE s.type IN (1, 2)) > 0 
        THEN COALESCE((l.attributes::jsonb->>'rate')::numeric, 0.00) / COUNT(s.id) FILTER (WHERE s.type IN (1, 2))
        ELSE 0.00
    END AS spend_per_stop
FROM tc_loads l
LEFT JOIN tc_stops s ON l.id = s.loadid
WHERE l.organizationid = :tenant_id
GROUP BY l.id;
```

#### 3. On-Time Arrival (OTA) and On-Time Delivery (OTD)
- **OTA**: Check-in (`enteredat`) must be within **30 minutes** (before or after) of the scheduled appointment time (`date`).
- **OTD**: Check-out (`exitedat` or `completedat`) must be within **2 hours** after the scheduled appointment time (`date`).
- **Dwell Time**: Duration between check-in (`enteredat`) and check-out. If the driver checked in early, the dwell calculation should start from the planned appointment time (`GREATEST(enteredat, date)`).
- **Detention Risk**: Flags visits where dwell time exceeds **120 minutes**.

```sql
SELECT 
    s.id AS stop_id,
    s.loadid,
    s.date AS planned_time,
    s.enteredat AS actual_checkin,
    COALESCE(s.exitedat, s.completedat) AS actual_checkout,
    
    -- OTA calculation (within 30 minutes buffer)
    CASE 
        WHEN s.enteredat IS NOT NULL AND s.date IS NOT NULL
        AND ABS(EXTRACT(EPOCH FROM (s.enteredat - s.date)) / 60) <= 30 THEN TRUE
        ELSE FALSE
    END AS is_ota,
    
    -- OTD calculation (completed within 2 hours of planned time)
    CASE 
        WHEN COALESCE(s.exitedat, s.completedat) IS NOT NULL AND s.date IS NOT NULL
        AND EXTRACT(EPOCH FROM (COALESCE(s.exitedat, s.completedat) - s.date)) / 3600 <= 2 THEN TRUE
        ELSE FALSE
    END AS is_otd,
    
    -- Dwell Time (minutes) using GREATEST(enteredat, planned_date)
    CASE 
        WHEN s.enteredat IS NOT NULL AND COALESCE(s.exitedat, s.completedat) IS NOT NULL
        THEN GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(s.exitedat, s.completedat) - GREATEST(s.enteredat, s.date))) / 60)::integer
        ELSE NULL
    END AS dwell_mins
FROM tc_stops s
JOIN tc_loads l ON s.loadid = l.id
WHERE l.organizationid = :tenant_id AND s.type IN (1, 2);
```

#### 4. Driver Close Funnel (Self Close vs Manual Close)
For closed loads (`loadstatus = 5`), we audit driver performance using events inside `tc_load_progress_events`:
- **Self Close (`driver_self`)**: The driver pressed "Delivered" inside the app, generating a `DRIVER_DELIVERED` event.
- **Manual Close (`office_manual`)**: Driver did not complete the load in the app (requiring dispatcher action) despite having a phone number and logging in/accepting the assignment. Or driver has no phone number.
- **Auto Close (`office_auto`)**: Driver had a phone number and SMS invitation was sent, but the driver did not accept the load, leading to a system auto-close.

```sql
WITH load_events AS (
    SELECT 
        loadid,
        bool_or(type = 'DRIVER_DELIVERED') AS has_driver_delivered,
        bool_or(type = 'DRIVER_ACCEPTED') AS has_driver_accepted,
        bool_or(type LIKE 'SMS_%') AS has_sms_sent
    FROM tc_load_progress_events
    GROUP BY loadid
)
SELECT 
    l.id AS load_id,
    l.phone,
    CASE 
        WHEN l.loadstatus != 5 THEN 'still_open'
        WHEN le.has_driver_delivered = TRUE THEN 'driver_self'
        WHEN (l.phone IS NOT NULL AND l.phone != '') AND le.has_driver_accepted = TRUE THEN 'office_manual'
        WHEN (l.phone IS NOT NULL AND l.phone != '') AND COALESCE(le.has_driver_accepted, FALSE) = FALSE THEN 'office_auto'
        ELSE 'office_manual' -- No phone/app usage at all
    END AS close_method,
    CASE 
        WHEN le.has_driver_delivered = TRUE THEN FALSE
        ELSE TRUE -- Needs dispatcher involvement
    END AS manual_close
FROM tc_loads l
LEFT JOIN load_events le ON l.id = le.loadid
WHERE l.organizationid = :tenant_id;
```

---

### 🌐 API Endpoint Integration
1. **Fetch Dashboard Payload**: Implement an API endpoint `/api/v1/reports/dashboard` that returns:
   ```json
   {
     "loads": [...],
     "active_loads": [...],
     "insurance": {
       "expired": [...],
       "expiring_soon": [...],
       "total_expired": 0,
       "total_expiring": 0
     }
   }
   ```
2. **Replace Static Imports**: In [App.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/App.tsx), replace:
   ```typescript
   import rawData from './lib/real-data.json';
   ```
   with standard state loading via an API call using `fetch` or `react-query`.
