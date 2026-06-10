# ShipLocate — Reports Module Implementation Prompt

> This prompt is for Cursor AI to implement the Operations Intelligence Report module
> inside the ShipLocate platform (cloude.shiplocate.com).
> Language: TypeScript + React + Tailwind v4 + shadcn/ui

---

## 1. CONTEXT — What we're building

We need to implement a **Reports / Analytics module** inside ShipLocate.
The prototype HTML report already exists and has been validated with real data from FMS Fresh Produce (our first client).

The report is a **single-page multi-tab dashboard** with:
- Date range picker (Last 7 days / Last 30 days / All data / Custom)
- 6 KPI cards that update dynamically
- 5 tabs: Overview, Customers, Carriers, Zones, Lanes
- All data filtered by `created_date` on `tc_loads`

---

## 2. DATABASE SCHEMA — Tables used

### Core tables

```sql
-- LOADS (main entity)
tc_loads (
  id              BIGINT PRIMARY KEY,
  uniqueid        VARCHAR(128),       -- load number shown to user (e.g. "11516")
  carrierid       BIGINT,             -- FK → tc_carriers.id (our custom carriers table)
  loadstatus      INT,                -- 0=Unknown 1=Created 2=Assigned 3=InTransit 4=Problem 5=Delivered
  createdat       BIGINT,             -- Unix timestamp in milliseconds → divide by 1000 for seconds
  deliveredat     DATETIME,
  attributes      VARCHAR(4000)       -- JSON: {"rate": "2300", "currency": "USD"}
)

-- STOPS (delivery points per load)
tc_stops (
  id              BIGINT PRIMARY KEY,
  loadid          BIGINT,             -- FK → tc_loads.id
  locationid      INT,                -- FK → tc_locations.id
  type            INT,                -- 0=PICKUP, 1=DROP, 2=DROP
  completion      INT,                -- 0=pending, 1=completed
  completedat     DATETIME,
  eta             DATETIME,
  sequence        INT                 -- stop order within load
)

-- LOCATIONS (customer/warehouse directory)
tc_locations (
  id              INT PRIMARY KEY,
  name            VARCHAR(255),       -- e.g. "Produce Junction Swedesboro, NJ"
  type            VARCHAR(64),        -- "Customer" or "Warehouse"
  address         VARCHAR(512),       -- full address
  notes           VARCHAR(1024),
  longitude       DOUBLE,
  latitude        DOUBLE,
  geofenceradius  DOUBLE              -- in meters, default 1000
)

-- CARRIERS (transport companies)
tc_carriers (
  id              BIGINT PRIMARY KEY,
  name            VARCHAR(255),
  dot             VARCHAR(50),
  mc              VARCHAR(50),
  phone           VARCHAR(50),
  email           VARCHAR(255),
  insuranceexpiry DATE,
  memo            VARCHAR(400)
)
```

### Important: Two separate carrier tables exist
- `tc_carriers` — our own carrier directory (used for reports)
- `pc_carriers` — legacy/external carrier data (NOT used for reports)

The `tc_loads.carrierid` references `tc_carriers.id`.

### FMS Sherrington — Owner location (EXCLUDE from delivery reports)
```sql
-- This is FMS Fresh Produce's own facility (the shipper, not a customer)
-- Always exclude from delivery/customer reports:
WHERE tc_stops.locationid != 1
-- locationid = 1 is "FMS - Sherrington QC" (298 Rang Sainte-Mélanie, Sherrington, QC)
```

### Load number filtering — FMS real loads only
```sql
-- FMS uses numeric load numbers. Filter out test/internal loads:
WHERE tc_loads.uniqueid REGEXP '^[0-9]+$'
-- OR in application layer: uniqueid.match(/^\d+$/)
```

---

## 3. KEY RELATIONSHIPS

```
tc_loads ──────────────────── tc_carriers
   │ (carrierid → id)              │
   │                               │
   └──── tc_stops ─────────── tc_locations
          (loadid → id)      (locationid → id)
```

### How to get delivery locations for a load:
```sql
SELECT
  l.id as load_id,
  l.uniqueid as load_number,
  l.carrierid,
  c.name as carrier_name,
  l.loadstatus,
  l.createdat,
  s.id as stop_id,
  s.type as stop_type,    -- 0=PICKUP, 1=DROP, 2=DROP
  s.locationid,
  loc.name as location_name,
  loc.address as location_address,
  loc.type as location_type
FROM tc_loads l
LEFT JOIN tc_carriers c ON l.carrierid = c.id
LEFT JOIN tc_stops s ON s.loadid = l.id
LEFT JOIN tc_locations loc ON s.locationid = loc.id
WHERE
  l.uniqueid REGEXP '^[0-9]+$'
  AND s.type IN (1, 2)           -- delivery stops only (not pickup)
  AND s.locationid != 1          -- exclude FMS Sherrington
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
ORDER BY l.id, s.sequence
```

---

## 4. DATE HANDLING

`createdat` is stored as **Unix timestamp in milliseconds**.

```sql
-- Convert to date:
FROM_UNIXTIME(l.createdat / 1000)

-- Filter by date range:
FROM_UNIXTIME(l.createdat / 1000) BETWEEN :date_from AND :date_to

-- Group by month:
DATE_FORMAT(FROM_UNIXTIME(l.createdat / 1000), '%Y-%m') as month

-- Group by week:
YEARWEEK(FROM_UNIXTIME(l.createdat / 1000), 1) as week

-- Day of week:
DAYNAME(FROM_UNIXTIME(l.createdat / 1000)) as day_of_week
```

In TypeScript:
```typescript
const createdDate = new Date(load.createdat) // createdat already in ms
// OR if stored as number:
const createdDate = new Date(Number(load.createdat))
```

---

## 5. ZONE MAPPING

Zone is derived from `tc_locations.address` using pattern matching.
This is done in **application layer** (not in SQL) because it requires regex.

```typescript
const ZONE_RATES: Record<string, number> = {
  '🇺🇸 New York': 2300,
  '🇺🇸 New England — MA': 2000,
  '🇺🇸 New England — CT': 2000,
  '🇺🇸 New England — RI': 2000,
  '🇺🇸 New England — ME/VT': 2000,
  '🇺🇸 NJ North': 2100,
  '🇺🇸 NJ South': 2200,
  '🇺🇸 Pennsylvania': 2200,
  '🇺🇸 Maryland / DC': 2300,
  '🇨🇦 Ontario': 750,
  '🇨🇦 Quebec': 750,
  // Others (FL, OH, TX, etc.) = null (no pricing yet)
}

function getZone(address: string, name: string): string {
  const t = (address + ' ' + name).toUpperCase()

  // Canada
  if (/,\s*(ON|ONTARIO|TORONTO|MISSISSAUGA|BRAMPTON|ETOBICOKE|OTTAWA|SCARBOROUGH)/.test(t)) return '🇨🇦 Ontario'
  if (/,\s*(QC|QUEBEC|MONTREAL|LAVAL|SHERRINGTON)/.test(t)) return '🇨🇦 Quebec'
  if (/WINNIPEG|,\s*MB/.test(t)) return '🇨🇦 Manitoba'
  if (/,\s*PE\b|KINKORA/.test(t)) return '🇨🇦 PEI'

  // New York
  if (/BRONX|BROOKLYN|QUEENS|GARDEN CITY|FARMINGDALE|RIVERHEAD|BOHEMIA|BLAUVELT|COLONIE|BUFFALO|ROCHESTER|SYRACUSE|NEWBURGH/.test(t)) return '🇺🇸 New York'
  if (/,\s*NY\b/.test(t)) return '🇺🇸 New York'

  // New England
  if (/,\s*MA\b|NEEDHAM|EVERETT|MILFORD|ANDOVER|CHICOPEE|NEW BEDFORD|TAUNTON|CHELSEA,?\s*MA/.test(t)) return '🇺🇸 New England — MA'
  if (/,\s*CT\b|WATERBURY|HARTFORD|ORANGE CT|BRANFORD/.test(t)) return '🇺🇸 New England — CT'
  if (/,\s*RI\b|CRANSTON|WARWICK/.test(t)) return '🇺🇸 New England — RI'
  if (/,\s*(ME|VT)\b|MAINE|VERMONT|SPRINGFIELD VT/.test(t)) return '🇺🇸 New England — ME/VT'

  // NJ
  if (/ENGLEWOOD NJ|NORTH BERGEN|NEWARK,?\s*NJ|ELIZABETH,?\s*NJ|HILLSIDE,?\s*NJ|MAHWAH|CLIFTON,?\s*NJ/.test(t)) return '🇺🇸 NJ North'
  if (/VINELAND|SWEDESBORO|EGG HARBOR|CEDARVILLE|EDISON,?\s*NJ/.test(t)) return '🇺🇸 NJ South'
  if (/,\s*NJ\b/.test(t)) return '🇺🇸 NJ North'

  // PA
  if (/,\s*PA\b|PHILADELPHIA|ALLENTOWN|BETHLEHEM|WILKES.BARRE|HARRISBURG|PITTSBURGH/.test(t)) return '🇺🇸 Pennsylvania'

  // DE
  if (/,\s*DE\b|WILMINGTON DE|NEW CASTLE,?\s*DE/.test(t)) return '🇺🇸 Delaware'

  // MD
  if (/,\s*MD\b|JESSUP|LAUREL,?\s*MD|LANHAM|WHITE MARSH|EASTON,?\s*MD|NEW WINDSOR MD/.test(t)) return '🇺🇸 Maryland / DC'

  // VA
  if (/,\s*VA\b|CHANTILLY/.test(t)) return '🇺🇸 Virginia'

  // Carolinas
  if (/,\s*(NC|SC)\b|MORRISVILLE|CHARLOTTE|GREENSBORO|GREENVILLE SC|ENOREE/.test(t)) return '🇺🇸 Carolinas'

  // Southeast
  if (/,\s*GA\b|ATLANTA|REIDSVILLE|SPARKS GA|NORMAN PARK/.test(t)) return '🇺🇸 Southeast — GA'
  if (/,\s*FL\b|MIAMI|POMPANO|JACKSONVILLE|GAINESVILLE|SARASOTA|FORT MYERS|HIALEAH|KISSIMMEE/.test(t)) return '🇺🇸 Florida'
  if (/,\s*(AL|TN)\b|HOMEWOOD AL|NASHVILLE/.test(t)) return '🇺🇸 Southeast — AL/TN'

  // Midwest
  if (/,\s*OH\b|CLEVELAND|COLUMBUS OH|AKRON|DAYTON|VALLEY VIEW|CINCINNATI/.test(t)) return '🇺🇸 Midwest — OH'
  if (/,\s*MI\b|DETROIT|HUDSONVILLE/.test(t)) return '🇺🇸 Midwest — MI'
  if (/,\s*IL\b|CHICAGO/.test(t)) return '🇺🇸 Midwest — IL'
  if (/,\s*(IN|MO|MN)\b|INDIANAPOLIS|KANSAS CITY|BROOKLYN PARK/.test(t)) return '🇺🇸 Midwest — Other'

  // Texas
  if (/,\s*TX\b|MCALLEN|PHARR|LAREDO/.test(t)) return '🇺🇸 Texas'

  // West
  if (/,\s*(CA|AZ|OR|WA|ID)\b/.test(t)) return '🇺🇸 West'

  return 'Unknown'
}
```

---

## 6. ESTIMATED SPEND CALCULATION

```typescript
/**
 * Estimated spend per load based on zone pricing.
 *
 * Rules:
 * 1. Get all delivery stop zones for this load
 * 2. Base rate = highest rate among all zones
 * 3. Add $100 for each additional stop beyond the first
 * 4. If no priced zone → return null (N/A)
 *
 * Examples:
 *   - Single stop in New York → $2,300
 *   - 3 stops in New England MA → $2,000 + (3-1)*100 = $2,200
 *   - 2 stops: NJ North + Maryland → max($2,100, $2,300) + 1*100 = $2,400
 *   - 1 stop in Florida → null (no pricing)
 */
function calcEstimatedSpend(
  deliveryStopZones: string[],
  deliveryStopCount: number
): number | null {
  const rates = deliveryStopZones
    .map(z => ZONE_RATES[z])
    .filter((r): r is number => r != null)

  if (rates.length === 0) return null

  const baseRate = Math.max(...rates)
  const extraStops = Math.max(0, deliveryStopCount - 1)
  return baseRate + extraStops * 100
}
```

---

## 7. MAIN DATA QUERIES

### Query 1: Load + Stops + Carriers (main dataset)

```sql
SELECT
  l.id,
  l.uniqueid,
  l.loadstatus,
  l.carrierid,
  c.name            AS carrier_name,
  c.insuranceexpiry AS carrier_insurance,
  FROM_UNIXTIME(l.createdat / 1000) AS created_date,
  DATE_FORMAT(FROM_UNIXTIME(l.createdat / 1000), '%Y-%m') AS month,
  DAYNAME(FROM_UNIXTIME(l.createdat / 1000)) AS day_of_week,
  l.deliveredat,
  JSON_UNQUOTE(JSON_EXTRACT(l.attributes, '$.rate'))     AS rate,
  JSON_UNQUOTE(JSON_EXTRACT(l.attributes, '$.currency')) AS currency,
  -- Delivery stop count (for trip type)
  (
    SELECT COUNT(*)
    FROM tc_stops s2
    WHERE s2.loadid = l.id
      AND s2.type IN (1, 2)
      AND s2.locationid != 1
  ) AS delivery_stop_count
FROM tc_loads l
LEFT JOIN tc_carriers c ON l.carrierid = c.id
WHERE
  l.uniqueid REGEXP '^[0-9]+$'
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
ORDER BY l.createdat DESC
```

### Query 2: Delivery stops per load (join with locations)

```sql
SELECT
  s.loadid,
  s.id         AS stop_id,
  s.type       AS stop_type,
  s.sequence,
  s.completion,
  s.completedat,
  s.eta,
  loc.id       AS location_id,
  loc.name     AS location_name,
  loc.address  AS location_address,
  loc.type     AS location_type,
  loc.latitude,
  loc.longitude
FROM tc_stops s
JOIN tc_locations loc ON s.locationid = loc.id
WHERE
  s.loadid IN (:load_ids)   -- pass load IDs from Query 1
  AND s.type IN (1, 2)      -- delivery stops only
  AND s.locationid != 1     -- exclude FMS Sherrington
ORDER BY s.loadid, s.sequence
```

### Query 3: Overview KPIs (aggregated, no stops join needed)

```sql
SELECT
  COUNT(*)                                                        AS total_loads,
  COUNT(CASE WHEN l.loadstatus = 5 THEN 1 END)                  AS delivered,
  COUNT(CASE WHEN l.loadstatus = 4 THEN 1 END)                  AS problems,
  COUNT(DISTINCT l.carrierid)                                     AS unique_carriers,
  AVG(CASE
    WHEN JSON_UNQUOTE(JSON_EXTRACT(l.attributes, '$.rate')) != ''
    THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(l.attributes, '$.rate')) AS DECIMAL)
  END)                                                            AS avg_actual_rate
FROM tc_loads l
WHERE
  l.uniqueid REGEXP '^[0-9]+$'
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
```

### Query 4: Monthly breakdown

```sql
SELECT
  DATE_FORMAT(FROM_UNIXTIME(l.createdat / 1000), '%Y-%m') AS month,
  COUNT(*)                                                  AS loads,
  COUNT(DISTINCT l.carrierid)                               AS unique_carriers,
  COUNT(CASE WHEN l.loadstatus = 5 THEN 1 END)             AS delivered,
  COUNT(CASE WHEN l.loadstatus = 4 THEN 1 END)             AS problems
FROM tc_loads l
WHERE
  l.uniqueid REGEXP '^[0-9]+$'
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
GROUP BY month
ORDER BY month
```

### Query 5: Carrier performance

```sql
SELECT
  c.id,
  c.name,
  c.insuranceexpiry,
  COUNT(l.id)                                              AS total_loads,
  COUNT(CASE WHEN l.loadstatus = 5 THEN 1 END)            AS delivered,
  COUNT(CASE WHEN l.loadstatus = 4 THEN 1 END)            AS problems,
  ROUND(COUNT(CASE WHEN l.loadstatus = 5 THEN 1 END) /
    COUNT(l.id) * 100, 1)                                 AS delivery_rate_pct
FROM tc_carriers c
JOIN tc_loads l ON l.carrierid = c.id
WHERE
  l.uniqueid REGEXP '^[0-9]+$'
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
GROUP BY c.id, c.name, c.insuranceexpiry
ORDER BY total_loads DESC
```

### Query 6: Customer (location) frequency

```sql
SELECT
  loc.id,
  loc.name,
  loc.address,
  loc.type,
  COUNT(DISTINCT s.loadid)  AS total_loads,
  COUNT(s.id)               AS total_stops
FROM tc_stops s
JOIN tc_locations loc ON s.locationid = loc.id
JOIN tc_loads l ON l.id = s.loadid
WHERE
  s.type IN (1, 2)
  AND s.locationid != 1
  AND l.uniqueid REGEXP '^[0-9]+$'
  AND FROM_UNIXTIME(l.createdat / 1000) >= :date_from
  AND FROM_UNIXTIME(l.createdat / 1000) <= :date_to
GROUP BY loc.id, loc.name, loc.address, loc.type
ORDER BY total_loads DESC
```

---

## 8. APPLICATION LAYER PROCESSING

After fetching from DB, the following computations happen in TypeScript:

```typescript
interface LoadRecord {
  id: number
  uniqueid: string
  loadstatus: number
  carrier_name: string
  carrier_insurance: string | null
  created_date: Date
  month: string
  day_of_week: string
  delivery_stop_count: number
}

interface StopRecord {
  loadid: number
  location_id: number
  location_name: string
  location_address: string
  zone: string  // computed via getZone()
}

// Step 1: Fetch loads
const loads = await db.query<LoadRecord>(QUERY_1, { date_from, date_to })

// Step 2: Fetch stops for these loads
const loadIds = loads.map(l => l.id)
const stops = await db.query<StopRecord>(QUERY_2, { load_ids: loadIds })

// Step 3: Assign zones to stops
const stopsWithZones = stops.map(s => ({
  ...s,
  zone: getZone(s.location_address, s.location_name)
}))

// Step 4: Group stops by loadid
const stopsByLoad = groupBy(stopsWithZones, 'loadid')

// Step 5: Enrich loads with stop data
const enrichedLoads = loads.map(load => {
  const deliveryStops = stopsByLoad[load.id] || []
  const zones = deliveryStops.map(s => s.zone)
  const spend = calcEstimatedSpend(zones, deliveryStops.length)
  const baseZone = zones.reduce((best, z) => {
    const rate = ZONE_RATES[z] || 0
    const bestRate = ZONE_RATES[best] || 0
    return rate > bestRate ? z : best
  }, zones[0] || 'Unknown')

  return {
    ...load,
    deliveryStops,
    zones,
    baseZone,
    estimatedSpend: spend,
    tripType: deliveryStops.length === 1 ? 'Single' : 'Multi',
    locationNames: deliveryStops.map(s => s.location_name),
  }
})
```

---

## 9. REPORT TABS — What each shows

### Tab 1: Overview
- Monthly loads + spend bar chart (grouped by `month`)
- Weekly volume bar chart (grouped by `week`)
- Day-of-week heatmap (grouped by `day_of_week`)
- Top 5 customers by estimated spend
- Top 5 carriers by estimated spend
- Monthly breakdown table

### Tab 2: Customers
- Group by `location_name`
- Count unique `loadid` per location = loads
- Count `trip_type === 'Single'` per location = single
- Count `trip_type === 'Multi'` per location = multi
- Sum `estimatedSpend` per unique loadid per location = total spend
- Most frequent `carrier_name` per location = top carrier
- All carriers with counts

### Tab 3: Carriers
- Group by `carrier_name`
- Count loads, delivered (status=5), problems (status=4)
- Sum `estimatedSpend` = total spend to this carrier
- Count unique `locationNames` across all loads = unique customers served
- Most frequent `baseZone` = top zone

### Tab 4: Zones
- Group by `baseZone` (highest-rate zone in load)
- Count loads, single, multi
- Sum `estimatedSpend`
- Top carrier per zone

### Tab 5: Lanes
- Always "From: Sherrington, QC" (fixed origin)
- Group by `baseZone` as destination
- Count loads, single, multi
- Sum `estimatedSpend`
- Top carrier per lane
- Sample customer names per lane
- All carriers with frequency

---

## 10. TRIP TYPE LOGIC

```typescript
// A load is Single if it has exactly 1 delivery stop (excluding FMS Sherrington)
// A load is Multi if it has 2+ delivery stops

const tripType = deliveryStops.length === 1 ? 'Single' : 'Multi'

// Delivery stops = tc_stops where:
//   type IN (1, 2)        -- DROP stops only (not PICKUP which is type=0)
//   locationid != 1       -- exclude FMS Sherrington
```

---

## 11. DATE RANGE PRESETS

```typescript
const today = new Date('2026-04-23') // use server date in production

const DATE_RANGES = {
  'last7':    { from: subDays(today, 7),  to: today },
  'last30':   { from: subDays(today, 30), to: today },
  'quarter':  { from: startOfQuarter(today), to: today },
  'all':      { from: new Date('2026-01-01'), to: today },
  'custom':   null  // user picks from/to
}
```

All filtering is based on `tc_loads.createdat` (Unix ms → Date).

---

## 12. UI COMPONENT STRUCTURE

```
ReportsPage
├── DateRangePicker (Last 7 / Last 30 / Quarter / All / Custom)
├── KPIRow
│   ├── KPICard (Total Loads)
│   ├── KPICard (Est. Spend)
│   ├── KPICard (Avg/Load)
│   ├── KPICard (Single Stops)
│   ├── KPICard (Multi Stops)
│   └── KPICard (Active Carriers)
└── TabPanel
    ├── Tab: Overview
    │   ├── MonthlyBarChart
    │   ├── WeeklyBarChart
    │   ├── DayOfWeekHeatmap
    │   ├── TopCustomersBar
    │   ├── TopCarriersBar
    │   └── MonthlyTable
    ├── Tab: Customers
    │   ├── SearchInput
    │   ├── FilterButtons (All / USA / Canada / Single / Multi / Priced)
    │   └── SortableTable (with pagination, 25 per page)
    ├── Tab: Carriers
    │   ├── SearchInput
    │   ├── FilterButtons (All / 100% Delivery / Multi-Heavy / Canada)
    │   └── SortableTable
    ├── Tab: Zones
    │   └── SortableTable
    └── Tab: Lanes
        └── SortableTable (From always = "Sherrington, QC")
```

---

## 13. IMPORTANT NOTES FOR IMPLEMENTATION

### Multi-tenancy
ShipLocate is multi-tenant. Each company (organization) has their own data.
The current report was built for **organizationId** (FMS Fresh Produce = org ID 2).
Filter all queries by the current user's organization:

```sql
-- Add to all queries:
AND l.groupid = :organization_id
-- OR however organization scoping is implemented in the codebase
```

Check existing load queries in the codebase to see how org scoping works.

### Performance
With 590 loads and ~1700 stops for one client over 4 months, query times are acceptable.
At scale, consider:
- Index on `tc_loads.createdat`
- Index on `tc_loads.carrierid`
- Index on `tc_stops.loadid`
- Index on `tc_stops.locationid`

### Zone mapping is NOT in SQL
Zone detection happens in the **application layer** via regex on `tc_locations.address`.
Do NOT try to do this in SQL. Fetch location addresses and compute zones in TypeScript.

### Estimated spend is approximate
The spend calculation uses zone-based pricing (not actual rate data).
Most loads have no rate in `tc_loads.attributes`.
Only 31 of 590 FMS loads had actual rates. Always label this as "Estimated Spend" in UI.

### Future: when real rate data is available
When carriers start entering rates per load, replace estimated spend with:
```typescript
const actualRate = load.rate ? parseFloat(load.rate) : null
const spend = actualRate ?? calcEstimatedSpend(zones, stopCount)
```

### Exclude pickup stops
```typescript
// ALWAYS filter: only count delivery stops (type 1 or 2)
// type=0 is PICKUP (usually FMS Sherrington or their warehouse)
// type=1, type=2 are DROP (delivery to customers)
const deliveryStops = allStops.filter(s => s.type === 1 || s.type === 2)
```

---

## 14. VALIDATED DATA NUMBERS (for testing)

Use these to verify your implementation against known-good values:

| Metric | Expected value |
|--------|---------------|
| Total loads Jan-Apr 2026 | 590 |
| Total delivery stops | 1,145 |
| Unique delivery customers | 91 |
| Total estimated spend | $1,166,550 |
| Avg spend per load (priced) | $2,193 |
| FMS Transport loads | 221 (37.5%) |
| Top zone by volume | 🇺🇸 New York (193 loads) |
| Top zone by spend | 🇺🇸 New York ($462,100) |
| Produce Junction Swedesboro NJ loads | 15 |
| The Class Produce Jessup MD loads | 31 |
| Single stop loads | ~36% |
| Multi stop loads | ~64% |
| Peak month loads | March 2026 (209 loads) |
| Busiest day of week | Tuesday (176 loads) |

---

## 15. PROTOTYPE REFERENCE

A working HTML prototype of this report exists at:
`/mnt/user-data/outputs/fms-ops-report-v3.html`

It contains all logic implemented in vanilla JS.
Use it as the reference for data transformations and UI behaviour.
The prototype is self-contained with all 590 loads embedded as JSON.
You can open it in a browser and test all tabs, filters, sorting, and date range changes.
