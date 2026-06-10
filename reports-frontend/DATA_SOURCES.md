# ShipLocate Data Mapping & Sources

This document defines the source of truth for all reporting KPIs and charts. Use this as a reference when replacing CSV-based mock data with a real database/API.

## 1. Core Entities & Table Mapping

| Dashboard Field | CSV Source Table | CSV Column | Logic / Transformation |
| :--- | :--- | :--- | :--- |
| **Physical Departure Date** | `tc_stops` | `date` | Taken from the record where `stopindex = 0`. |
| **Load Number** | `tc_loads` | `number` | Unique identifier displayed in tables. |
| **Load Creation Time** | `tc_loads` | `createdat` | Used only as a fallback if no stop date exists. |
| **Carrier Name** | `tc_loads` | `carrier` | Name of the transport company. |
| **Customer / Location** | `tc_locations` | `name` | Extracted from stop sequences. |
| **Spend (Estimated)** | N/A | Calculated | `Base Zone Rate + (Deliveries - 1) * $100`. |
| **Zip Code** | `tc_locations` | `address` | Extracted via regex `\b\d{5}\b` from address. |

## 2. Timezone & Localization
- **Source Format**: UTC (Unix timestamp in milliseconds or ISO strings).
- **Reporting Format**: **EDT (UTC-4)**.
- **Rule**: All timestamps must be shifted by -4 hours before determining the "Day of Week" or "Month" to match shipping operations.

## 3. Key Performance Indicators (KPIs)

### Total Loads
- **Source**: Count of unique `loadid` in `tc_loads`.
- **Filter**: Exclude loads with 0 locations or "dirty" data.

### Estimated Spend
- **Source**: Derived.
- **Zones**: Determined by the 3-digit Zip Code of the final destination.
- **Rates**: Defined in the static `zoneRates` map in `reaggregate.cjs`.

### Day of Week (DOW)
- **Source**: `tc_stops.date` (index 0) shifted to EDT.
- **Start of Week**: Sunday.

## 4. Regional Zone Mapping (ZIP-3)
Zones are mapped based on the first 3 digits of the destination ZIP:
- **NYC / Long Island**: 100-119
- **Upstate NY**: 120-149
- **North Jersey**: 070-079, 088-089
- **Eastern PA**: 170-196
- **Capital Region**: 201, 220-223
- *(Full list available in `reaggregate.cjs`)*

## 5. Integration Notes
When moving to a production SQL database:
- **Join Query**: `tc_loads` JOIN `tc_stops` (on `loadid`) where `stopindex = 0`.
- **Aggregation**: Perform DOW and Monthly groupings in the database if possible for better performance.
