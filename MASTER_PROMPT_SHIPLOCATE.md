# MASTER PROMPT: ShipLocate Operations Dashboard

You are an expert AI developer maintaining the ShipLocate Reporting Dashboard. 
This document is the "Source of Truth" for all business logic, data structures, and UI standards. 
If you are starting a new session, read this first to understand the existing connections.

## 1. Project Context
- **Objective:** Production-ready Shipper Intelligence Platform for the North American market (USA & Canada).
- **Positioning:** ShipLocate is designed for top-tier Shippers to manage and analyze logistics data across all zones. (FMS was used as the initial test site).
- **Tech Stack:** React (Vite), Recharts, Lucide-react, Vanilla CSS.
- **Core Strategy:** High-performance data aggregation via `reaggregate.cjs` providing a pre-processed `mock-data.json`.

## 2. Data Processing Logic (reaggregate.cjs)

### Geographic Zone Mapping
- **Objective:** Full coverage of the North American market (USA & Canada) for top-tier Shippers.
- **Source of Truth:** Zone assignment is based on the **ZIP code** from the source database (CSV), not the company name.
- **ZIP Prefixes:** NJ (070-079, 088-089 North; 080-087 South), NY (100-119 NYC; 120-149 Upstate), CA (936-961 North; 900-935 South), etc.

### Database Relationships
- **ID Mapping:** Match the `id` from the loads data with the `uniqueid` column in `tc_loads_...csv`. This `uniqueid` is the 5-digit **Load Number** visible to the user.
- **Location Mapping:** Use the location name (e.g., "EM Food - Brooklyn NY") to look up the corresponding ZIP code in `tc_locations_...csv`.

## 3. Hard Rules (DO NOT BREAK)
- **Customer Names:** **NEVER trim or normalize.** Names must be preserved exactly (e.g., "Jetro Milford MA") to ensure parity with the production database for future JOINs.
- **Dirty Data Filter:** Always filter out loads where `loc_names` is empty. These are incomplete records and must be ignored.
- **Pricing Formula:** `Base Zone Rate + (Total Stops - 1) * $100`. Only estimate `null` spend values.

## 4. UI/UX Standards
- **Branding:** Use "ShipLocate | Shipper Intelligence" as the primary title.
- **Drill-down Architecture:** Each main tab (Zones, Customers, Carriers) MUST implement a side-panel detail view that opens on row click.
- **Table Alignment:** Names (Left), Counts/Rates (Center), Currency/Spend (Right).
- **Color Tokens:** Spend/Blue: `#44AFFE`, TL/Green: `#00C48C`, LTL/Yellow: `#FFBB00`.

## 5. Maintenance Commands
- **Re-aggregate Data:** `node src/lib/reaggregate.cjs`
- **Run Dev Server:** `npm run dev`
