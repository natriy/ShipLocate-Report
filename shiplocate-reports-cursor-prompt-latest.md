# Cursor AI Master Prompt: ShipLocate Analytics & Reports Module

> Use this document as the final Source of Truth for integrating and maintaining the **Reports & Analytics module** within the **ShipLocate Platform** (cloude.shiplocate.com).
> **Tech Stack:** React (Vite), TypeScript, Tailwind CSS v4, Lucide React, Recharts, PostgreSQL backend + Python ingestion.

---

## 1. Database Schema & Data Pipeline

The reports are backed by a live PostgreSQL database accessed via credentials stored in a local, Git-ignored `.env` file. Data is processed locally by a Python aggregation script which exports the final optimized JSON for React consumption.

### Database Connection
- **Host:** `167.114.144.196:5432/postgres` (read-only credentials in `.env`).
- **Pipeline:** Run `python prepare_frontend_data.py` in the root directory to query the live DB, perform data cleaning (handling datetime and decimal serialization), and output a static JSON file:
  `reports-frontend/src/lib/real-data.json`

### Core Table Structure
- **Loads:** `tc_loads` (Main entity. The `uniqueid` field is the user-visible Load Number, e.g., `'11516'`).
- **Stops:** `tc_stops` (Delivery and pickup locations per load).
- **Locations:** `tc_locations` (Customer names, addresses, latitudes, longitudes).
- **Carriers:** `tc_carriers` (Directory of active shipping companies).

### Critical Query Rules (DO NOT MISS)
1. **Exclude Owner Facility:** Always exclude the owner/shipper warehouse from customer delivery counts:
   `WHERE tc_stops.locationid != 1` (Location `1` is the shipper's warehouse, e.g., "FMS - Sherrington QC").
2. **Delivery Stops Only:** Only count stops where `type` is `1` or `2` (DROP). Exclude `0` (PICKUP).
3. **Valid Load Numbers:** Filter out test/internal loads:
   `WHERE l.uniqueid REGEXP '^[0-9]+$'` (Numeric load numbers only).

---

## 2. Core Business Logic & Calculations

### Terminology & Trip Types
- **TRUCK LOADS WITH SINGLE DROP (TL):** A load containing **exactly 1 delivery stop** (excluding owner facility).
- **TRUCK LOADS WITH MULTI-STOP (LTL):** A load containing **2 or more delivery stops**.

### Fractional/Pro-Rata Customer Attribution (CRITICAL)
Simple summation of loads per customer causes double-counting when multiple customers share an LTL load. To prevent this, we calculate the pro-rata physical load share:
- **Calculation:** For every drop/stop a customer has on a load:
  $$\text{drop\_share} = \frac{1}{\text{total\_drops\_on\_load}}$$
- **Accumulation:**
  - On a **TL (Single)** load: Customer gets a load share of `1.0`.
  - On an **LTL (Multi-Stop)** load: Customer gets a load share of `1 / total_drops_on_load` per drop they occupy.
  - Summing the customer's TL and LTL shares yields `Total Loads` (which represents the customer's true physical truck run share).
- **Decimal Display:** Display these values with **up to one decimal place** precision (`Math.round(val * 10) / 10`) in the UI to ensure fractional counts are transparent and add up consistently (e.g., `0.5` instead of `1`, and `235.7` instead of `236`). If a value is a clean integer, display it without trailing decimals (e.g., `38` instead of `38.0`).

---

## 3. UI/UX & Component Styling Standards

### 1. Color Palette & Dedicated Themes (STRICT PARITY)
- ⚓ **TRUCK LOAD (Total Loads):** `brand-navy` / `#0f253d` (dark navy blue)
  - The "Total Truck Loads" KPI card, the "Total Loads" column in the Customers table, and the customer loads legends use `brand-navy`.
- 🟢 **TL (Single Drop):** `brand-green` / `#16a34a` (green)
- 🟡 **LTL (Multi-Stop):** `brand-yellow` / `#d97706` (orange/yellow)
- 🔵 **DROPS / PICKUPS:** `brand-blue` / `#2563eb` (bright blue)
- 🩶 **Carrier (Dedicated Theme):** `brand-slate` / `#64748b` (grey/slate)
  - All Carrier-specific UI elements (table header hovers, tab buttons, selected rows left-borders, search inputs, pagination links, and detail KPI tiles) must use `brand-slate` styling.

### 2. Overview Tab Layout
- **KPI Row:** 6 cards (Total Truck Loads [Navy], TL [Green], LTL [Yellow], Total Delivery Drops [Blue], Total Pickups [Blue], Active Carriers [Slate]).
- **Top 5 Carriers by TRUCK Loads Card:**
  - Uses `slateCardClass` to align with the Carrier theme.
  - Sorted by physical loads count (`loads` descending).
- **Top 5 Customers by TRUCK Loads Card:**
  - Uses `blueCardClass` (Customer theme).
  - Sorted by physical load share (`total_loads` descending).
  - Displays three columns: `TL` (`c.tl_loads`), `LTL` (`c.ltl_loads`), and `Total Loads` (`c.total_loads`), formatted to 1 decimal place with `brand-navy` indicator color for the Total Loads value.
  - Hover progress-bar tooltip shows these 3 columns (Total Drops is removed).
  - Progress bar outer width and segments scale relative to `total_loads` instead of drops.

### 3. Carriers Tab Detail Panel Reorganization
- **KPI Grid:** Expanded to 7 tiles (Total Truck Loads [Navy], TL [Green], LTL [Yellow], Total Delivery Drops [Blue], Zones [Slate], Customers [Slate], Efficiency [Slate]).
- **Detail Sub-Tabs:** Reordered and renamed to:
  1. **Zones** (formerly "Locations", mapped to `states` tab, set as default active tab).
  2. **Customers** (mapped to `customers` tab).
  3. **History** (formerly "Loads", mapped to `loads` tab).

### 4. Expandable Peer Rows Layout (No Nested Tables)
To avoid column alignment issues and duplicate headers when expanding a parent row in a table (e.g. State → Cities, or Customer → Locations):
- **DO NOT** render a nested `<table>` inside a full-width `colspan` row.
- **DO** render the details as peer `<tr>` siblings within the main table grid. Use a `<React.Fragment>` around the parent and its mapped child rows.
- Indent the first cell of the child row using padding/border:
  `<div className="border-l border-brand-blue/30 pl-2.5 py-0.5">...</div>`

---

## 4. Source Files Checklist
Verify your integration against these existing, fully functioning dashboard files:
1. [App.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/App.tsx): Coordinates date range parsing, comparison YoY calculations, and dynamic memory-based raw data aggregations.
2. [CarriersTab.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/components/CarriersTab.tsx): Renders carriers, expanding customers served, and locations. Features state-level interactive maps.
3. [CustomersTab.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/components/CustomersTab.tsx): Renders customers, expanding delivery state locations, and serving carriers. Features interactive mapping.
4. [ZonesTab.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/components/ZonesTab.tsx): Visualizes macro and meso region volumes, showing carrier/customer metrics within specific regions.
5. [OverviewTab.tsx](file:///Users/renat/Desktop/ShipLocate-Reports/reports-frontend/src/components/OverviewTab.tsx): Renders daily and monthly trend graphs with YoY line comparisons and custom hover tooltips.
