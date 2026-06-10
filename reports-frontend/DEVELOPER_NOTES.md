# ShipLocate Dashboard — Developer Notes

This project is a high-fidelity functional prototype (mockup) designed to be handed over to the development team for final integration.

## Design Standards
This project follows the **ShipLocate WWW** design system. 
- **Tokens**: Base colors, typography, and spacing are synchronized with `www/src/styles/globals.css`.
- **Styling**: Built with **Tailwind CSS v4**. All theme variables are defined in `src/index.css` under `@theme`.
- **Dark Mode**: Supports dark mode using the `.dark` class, consistent with the WWW project.

## Project Structure
- `src/App.tsx`: Main dashboard container, contains data aggregation logic (`useMemo`).
- `src/components/`: Modular tabs (Overview, Customers, Carriers, Zones, Risk).
- `src/lib/mock-data.json`: The source of truth for the mockup.

## Data Integration Guide
To turn this mockup into a production app:
1. **API Integration**: Replace the `mockData` import in `App.tsx` with a `fetch` or `react-query` call to your backend.
2. **Schema**: The components expect the structure defined in `mock-data.json`. Ensure your API responses match this schema or map them in `App.tsx`.
3. **Authentication**: Add your auth wrapper around the `App` component.

## Shared Brand Colors
We use specific brand tokens for logistics-specific UI elements:
- `--brand-blue`: Primary action color and spend highlights.
- `--brand-green`: Positive growth and single-stop indicators.
- `--brand-yellow`: Multi-stop and cautionary metrics.
- `--brand-red`: Risk and high-cost indicators.

## Running Locally
```bash
npm install
npm run dev
```
