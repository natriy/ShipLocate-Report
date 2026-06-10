# ShipLocate — Report Design & Visualization Prompt

> This prompt documents the design system, visual language, and implementation
> approach used for the FMS Fresh Produce Operations Report.
> Use this as reference when building report components inside ShipLocate (React + TS + Tailwind v4).

---

## 1. DESIGN PHILOSOPHY

The report uses **ShipLocate's own design language** — the same dark theme, colors, and typography as the main product (`cloude.shiplocate.com`). The goal: when a client opens the report inside ShipLocate, it feels like a native part of the product, not a bolted-on analytics page.

**Core principles:**
- Dark background, high contrast
- Data-first — no decorative elements, every pixel carries information
- Color is semantic, not decorative (green = good, yellow = warning, red = problem)
- Consistent spacing and border-radius throughout
- No external chart libraries — all charts built with CSS/HTML divs

---

## 2. COLOR SYSTEM

```css
:root {
  /* Brand colors */
  --green:  #51C548;   /* good, delivered, success */
  --blue:   #44AFFE;   /* primary, loads, info */
  --red:    #FE6860;   /* problem, high risk, error */
  --yellow: #FDC53F;   /* warning, spend, multi-stop */
  --gray:   #A6B1C2;   /* neutral, inactive */

  /* Backgrounds */
  --bg:     #0F1623;   /* page background */
  --bg2:    #161E2E;   /* card background */
  --bg3:    #1C2740;   /* input / nested element background */

  /* Structure */
  --border: #1F2B44;   /* all borders */
  --text:   #E8EDF5;   /* primary text */
  --muted:  #A6B1C2;   /* secondary text, labels */
}
```

**Semantic usage:**
| Color | Use case |
|-------|----------|
| `--green` | Delivered, 100% rate, good metric, Single stop badge |
| `--blue` | Loads count, primary data, links, active state |
| `--yellow` | Spend/cost, Multi-stop badge, warnings, medium risk |
| `--red` | Problems, high risk, failures, expired insurance |
| `--gray` | Inactive, N/A, weekend bars in heatmap |
| `--muted` | Labels, sublabels, secondary info |

---

## 3. TYPOGRAPHY

```css
font-family: 'Nunito Sans', sans-serif;
/* Import: https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800 */
```

**Scale:**
```
10px uppercase + letter-spacing  → section labels, table headers
11–12px                          → table data, sublabels, badges
13–14px                          → body text, card content
16px font-weight:700             → card titles
22–30px font-weight:800          → KPI values
28px font-weight:800             → page title h1
```

---

## 4. COMPONENT PATTERNS

### KPI Card
```html
<div class="kpi">
  <div class="kpi-l">Total Loads</div>       <!-- label: 10px uppercase -->
  <div class="kpi-v c-b">590</div>           <!-- value: 22-30px bold, colored -->
  <div class="kpi-s">Jan–Apr 2026</div>      <!-- sublabel: 11px muted -->
  <!-- optional compare delta: -->
  <div class="kpi-cmp up">↑ 18.3%</div>     <!-- up=green, down=red, neutral=muted -->
</div>
```

KPI grid: `grid-template-columns: repeat(N, 1fr)` — typically 5 or 6 columns.

### Card / Panel
```html
<div class="cc">                              <!-- card container -->
  <div class="ctitle">Section Title</div>    <!-- 10px uppercase with blue left border -->
  <!-- content -->
</div>
```

`.ctitle::before` = 3px × 10px blue rectangle — the signature section marker.

### Badge
```html
<span class="b bg">Single</span>   <!-- green -->
<span class="b bb">FMS Transport</span>  <!-- blue -->
<span class="b by">Multi</span>    <!-- yellow -->
<span class="b br">HIGH</span>     <!-- red -->
<span class="b bgr">N/A</span>     <!-- gray -->
```

Badges: `padding: 1px 7px`, `border-radius: 20px`, `font-size: 10px`, `font-weight: 700`.

### Carrier / Customer Pills (for "All Carriers" column)
```html
<div class="pills">
  <span class="pill top">FMS Transport(10)</span>  <!-- top = blue tint -->
  <span class="pill">Rolling Transport(5)</span>
</div>
```

Pills: small, `font-size: 10px`, `border-radius: 10px`, dark bg.

### Horizontal Bar (inline data bar)
```html
<div class="bw">                               <!-- bar wrapper: flex row -->
  <div class="bt">                             <!-- bar track: full width, dark bg -->
    <div class="bf" style="width:75%"></div>   <!-- bar fill: colored -->
  </div>
  <span style="min-width:65px;text-align:right;font-weight:700;color:var(--green)">
    $62,900
  </span>
</div>
```

Used in tables for spend visualization. `height: 5–8px`, `border-radius: 3px`.

### Mini Bar Chart (overview section)
```html
<div class="bar-chart">  <!-- display:flex; align-items:flex-end; height:90-120px -->
  <div class="bcol">     <!-- flex:1; column layout -->
    <div class="bwrap">  <!-- flex:1; bottom-aligned -->
      <div class="bbar" style="height:75%;background:var(--green)"></div>
      <!-- optional prev period bar: -->
      <div class="bbar" style="height:60%;background:var(--blue);opacity:.5"></div>
    </div>
    <div class="bval">199</div>     <!-- value label above bar -->
    <div class="blabel">Feb</div>   <!-- month label below -->
  </div>
</div>
```

**Compare mode:** prev period bar shown LEFT (blue, 50% opacity), current RIGHT (green). Each bar has its own value + month label directly below it.

### Day of Week Heatmap
```html
<div class="heatmap">  <!-- display:flex; align-items:flex-end -->
  <div class="hw">     <!-- flex:1; column -->
    <div class="hv">53</div>   <!-- count -->
    <div class="hb" style="height:70px;background:var(--blue)"></div>
    <div class="hl">Wed</div>  <!-- day label -->
  </div>
</div>
```

Weekdays: `--blue`, weekends: `--gray`.

### Side Panel (Drill-down)
```css
.side-panel {
  width: 420px;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  position: sticky;
  top: 1.5rem;
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
}
```

Layout: `.content-wrap` = `display:flex; gap:1.5rem`. Main table takes `flex:1`, panel takes fixed `420px`. Panel slides in via `display:none → display:block` (no animation needed — fast and clean).

Selected row: `tr.selected td { background: rgba(68,175,254,.1) }` — blue tint.

**Panel sections** use `.panel-section-title` with same blue left-border marker as `.ctitle`.

**Mini bar rows** inside panel:
```html
<div class="mini-bar-row">
  <div class="mini-bar-label">FMS Transport</div>
  <div class="mini-bar-track"><div class="mini-bar-fill" style="width:68%"></div></div>
  <div class="mini-bar-val">10</div>
</div>
```

### Table
```css
table { border-collapse: collapse; border-radius: 10px; overflow: hidden; }
th    { font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
        background: var(--bg3); border-bottom: 1px solid var(--border); cursor: pointer; }
td    { font-size: 12px; padding: .6rem .9rem; border-bottom: 1px solid var(--border); }
tr:hover td { background: rgba(68,175,254,.04); }
tr.clickable { cursor: pointer; }
th.asc::after  { content: " ▲"; font-size: 8px; }
th.desc::after { content: " ▼"; font-size: 8px; }
```

All tables are sortable — click th triggers sort, direction toggles on re-click.

### Risk Cards (Concentration Risk)
Border color changes based on risk level:
```js
card.style.borderColor = risk === 'HIGH'   ? 'rgba(254,104,96,.4)'
                       : risk === 'MEDIUM' ? 'rgba(253,197,63,.3)'
                       : 'var(--border)';
```

Background of recommendation boxes:
```js
background: risk === 'high'   ? 'rgba(254,104,96,.06)'
          : risk === 'medium' ? 'rgba(253,197,63,.06)'
          : 'rgba(81,197,72,.06)'
```

### Customer Activity Mini Squares (Retention)
```js
// 4 squares: Jan / Feb / Mar / Apr
// Color: green if cnt >= 10, blue if cnt > 0, dark bg if empty
months.map((m, i) => {
  const cnt = retention[m] || 0;
  const bg = cnt > 0 ? (cnt >= 10 ? 'var(--green)' : 'var(--blue)') : 'var(--bg3)';
  return `<div style="width:14px;height:14px;border-radius:3px;background:${bg};
    display:flex;align-items:center;justify-content:center;
    font-size:8px;font-weight:700;color:${cnt>0?'#fff':'var(--muted)'}">
    ${cnt > 0 ? cnt : ''}
  </div>`;
})
```

---

## 5. TAB NAVIGATION

```html
<div class="tabs">
  <div class="tab active" onclick="showTab('overview', this)">📊 Overview</div>
  <div class="tab" onclick="showTab('customers', this)">🏢 Customers</div>
  <!-- etc -->
</div>
```

```css
.tab {
  padding: .65rem 1.25rem;
  font-size: 12px; font-weight: 700;
  border-bottom: 2px solid transparent;
  color: var(--muted);
}
.tab.active { color: var(--blue); border-bottom-color: var(--blue); }
```

Tab content: `display: none` → `display: block` via `.tc` / `.tc.active`.

Emojis in tab names are intentional — quick visual scanning.

---

## 6. DATE RANGE CONTROLS

Three control groups in one bar:

```
PERIOD  [Last 7] [Last 30] [Quarter] [All data]  [2026-01-01] → [2026-04-23] [Apply]
───────────────────────────────────────────────────────────────────────────────
COMPARE [None] [vs Prev Period] [vs Prev Year]
───────────────────────────────────────────────────────────────────────────────
CHART   [Loads] [Spend $]
```

Date validation on Apply:
1. Regex check: `/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/`
2. Real date check: `new Date(val).getDate() === parsed_day` (catches Apr 31)
3. Range check: `start < end`
4. Error shown inline below controls (red text), inputs get red border

---

## 7. NO EXTERNAL CHART LIBRARIES

All charts are **pure CSS + HTML divs**. Zero chart library dependencies.

**Why:** Simpler, faster, perfectly fits the design system, no versioning issues.

**Techniques used:**

| Chart type | Technique |
|------------|-----------|
| Bar chart (monthly) | `display:flex; align-items:flex-end` + div heights as percentages |
| Horizontal bar | `div` with `width: X%` inside track div |
| Heatmap (DOW) | `display:flex` + variable height divs |
| Funnel | Horizontal bars with decreasing widths |
| Mini bars in panel | Flex row: label + track + value |
| Activity squares | 14×14px divs with color coding |
| Stacked bars | Multiple colored divs inside one column |

**Compare mode bars:** Two bars side by side in each column — prev LEFT (blue, 50% opacity), current RIGHT (green). Each has its own value label above and month name below.

---

## 8. INTERACTIVITY PATTERNS

### Drill-down side panel
```js
function openPanel(html, rowEl) {
  if (selectedRow) selectedRow.classList.remove('selected');
  selectedRow = rowEl;
  rowEl.classList.add('selected');
  document.getElementById('panel-content').innerHTML = html;
  document.getElementById('side-panel').classList.add('open');
}
function closePanel() {
  document.getElementById('side-panel').classList.remove('open');
  if (selectedRow) { selectedRow.classList.remove('selected'); selectedRow = null; }
}
```

Panel closes on: tab switch, date range change, × button, click on same row.

### Sortable tables
```js
let sorts = { custs:{col:2,dir:-1}, cars:{col:2,dir:-1}, zones:{col:2,dir:-1}, lanes:{col:2,dir:-1} };

function sortT(table, col) {
  const s = sorts[table];
  if (s.col === col) s.dir *= -1;
  else { s.col = col; s.dir = -1; }  // default desc
  // Update th classes + re-render
}
```

Default sort: always **descending by loads** (col:2, dir:-1).

### Filter buttons (pill style)
Active state: `background: var(--blue); color: #fff; border-color: var(--blue)`.
Only one active at a time — click removes `active` from all, adds to clicked.

### Event delegation for dynamic rows
Instead of inline onclick with complex escaping:
```js
// After rendering lane-body:
var laneBody = document.getElementById('lane-body');
if (laneBody) {
  laneBody.onclick = function(e) {
    var row = e.target.closest('tr[data-lane-key]');
    if (row) openLanePanel(row.dataset.laneKey, row);
  };
}
```

Use `data-*` attributes to pass identifiers, never inline JS with string escaping.

---

## 9. PERFORMANCE PATTERNS

### All data embedded in HTML
No API calls. All data (590 loads, 1109 stops, retention, concentration, performance) is embedded as `const RAW = {...}` JSON in the `<script>` tag.

File size: ~900KB. Acceptable for internal reports.

### Client-side filtering
Date range changes trigger `filteredLoads()` which filters `RAW.loads_raw` by date. All aggregations recomputed in JS. Fast enough for 590 loads.

### Function order matters
All functions and data must be defined **before** `refresh()` is called:
```js
// CORRECT ORDER:
const RAW = {...};
const CONC = {...};
const RETENTION = {...};
const PERF = {...};
const ZONE_RATES = {...};
function getZone() {...}
function retentionCells() {...}
function renderConcentration() {...}
function renderCusts() {...}
// ... all other functions ...
refresh();  // ← ALWAYS LAST
```

Breaking this order causes `ReferenceError` and blank page.

---

## 10. IMPLEMENTING IN REACT (ShipLocate)

When porting this report into the React app, the design system maps directly to Tailwind + shadcn:

| Report CSS | React/Tailwind equivalent |
|-----------|--------------------------|
| `.kpi` | Custom `KPICard` component |
| `.cc` + `.ctitle` | shadcn `Card` with custom header |
| `.b.bg / .by / .br` | shadcn `Badge` with variant |
| `.tab / .tc` | shadcn `Tabs` / `TabsContent` |
| `.side-panel` | shadcn `Sheet` (side panel) |
| `table + th + td` | shadcn `Table` |
| `.fb` filter buttons | shadcn `ToggleGroup` |
| Date range picker | shadcn `DateRangePicker` or `Popover` + `Calendar` |
| Bar charts | Keep as CSS divs OR use Recharts `BarChart` |
| `.search-box` | shadcn `Input` |
| Pagination | shadcn `Pagination` |

**Colors:** Add CSS variables to your Tailwind config or global CSS:
```css
/* globals.css */
:root { --sl-green: #51C548; --sl-blue: #44AFFE; /* etc */ }
```

**Side panel pattern:** Use shadcn `Sheet` with `side="right"` — equivalent to the `.side-panel` drawer.

**Data:** Replace embedded JSON with API calls to `/api/reports/fms?from=...&to=...`. The filtering logic stays the same, just moves server-side.

---

## 11. FILES REFERENCE

| File | Description |
|------|-------------|
| `fms-ops-report-v6.html` | Full standalone report (no dependencies except Google Fonts) |
| `REPORT.md` | Data sources, zone map, tab descriptions |
| `shiplocate-reports-cursor-prompt.md` | DB schema, SQL queries, zone detection for implementation |
| `/tmp/zone_map.json` | 32 zones with cities, states, rates |
| `/tmp/report_data_v3.json` | Computed data: loads, customers, zones, lanes (with real origins) |
| `/tmp/perf_data_v2.json` | Driver engagement per load (paths A/B/C, close methods) |
| `/tmp/concentration.json` | Concentration risk data |
| `/tmp/cust_retention.json` | First seen, last seen, status per customer |
