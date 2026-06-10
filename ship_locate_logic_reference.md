# ShipLocate Project Logic Reference

This document captures the core business logic and technical rules for the ShipLocate Shipper Intelligence Platform (USA & Canada market).

## 1. Project Overview
- **Core Objective:** Provide top-tier Shippers with granular analytics on spend, volume, and carrier performance across all North American zones.
- **Data Integrity:** All logic is designed to match production database structures for future seamless integration.

## 2. Data Processing Logic (reaggregate.cjs)

### Geographic Zone Mapping
- **Source of Truth:** Zone assignment is based on the **ZIP code** from the `tc_locations` CSV, not the company name.
- **Rules:** Defined in `getZone()` using 3-digit ZIP prefixes.
  - **NJ:** North (070-079, 088-089), Central/South (080-087).
  - **NY:** NYC/LI (100-119), Upstate (120-149).
  - **PA:** East (170-196), West (150-169).
  - **CA:** North (936-961), South (900-935).
  - **FL:** North (320-329, 335-349), South (330-334).
- **Fallback:** If ZIP is missing, use State Code regex on the location name.

### Customer Name Normalization
- **Rule:** **NO TRIMMING.** Customer names must be preserved exactly as they appear in the `tc_locations` name column (e.g., `EM Food - Brooklyn NY`) to ensure parity with the production database.
- **Reasoning:** Essential for future JOIN operations and branch-level reporting.

### Spend Estimation Formula
- **Base Rate:** Derived from the load's destination zone (e.g., $2300 for NYC/LI).
- **LTL/Multi-stop Adder:** `Base Rate + (Delivery Count - 1) * 100`.
- **Manual Overrides:** If `spend` is already present in the source data, it is preserved; only `null` values are estimated.

## 3. Dashboard Architecture

### Tab Structure
1.  **Overview:** High-level KPIs and volume charts (Monthly/DOW). Layout is 50/50 for charts.
2.  **Customers:** Detailed list with drill-down side panel. Shows carrier breakdown and recent load history (Load Number).
3.  **Carriers:** Performance analysis with drill-down side panel. Shows zone coverage and top clients.
4.  **Zones:** Regional spend/volume analysis with drill-down side panel. Shows customer/carrier lists.

### UI Standards
- **Component Styling:** Use Vanilla CSS with Tailwind-like utility classes from `index.css`.
- **Color Palette:**
  - Blue (`#44AFFE`): Primary actions/Spend.
  - Green (`#00C48C`): Single-stop (TL) / Efficiency.
  - Yellow (`#FFBB00`): Multi-stop (LTL) / Alerts.
  - Dark Mode: Primary background `#0F1623`, Surface `#161E2E`.

### Alignment Rules
- **Tables:** Name columns are left-aligned. Count/Numeric columns (Loads, Rate) are center-aligned. Currency/Spend columns are right-aligned.
