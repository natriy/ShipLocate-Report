# Frontend Integration Guide

This project is built with **React**, **Vite**, and **Tailwind CSS v4**. It uses a pre-aggregated `mock-data.json` file for reporting.

## 1. How to Replace Mock Data with a Real API

Currently, `App.tsx` imports data directly:
```tsx
import mockData from '@/lib/mock-data.json';
```

To integrate with a backend:
1. Create an API endpoint that returns the same JSON structure.
2. Use `useEffect` in `App.tsx` to fetch data:
```tsx
const [data, setData] = useState(null);
useEffect(() => {
  fetch('/api/reports/overview').then(res => res.json()).then(setData);
}, []);
```

## 2. Expected Data Structure

The frontend expects a single object containing:
- `loads_raw`: Array of all individual loads with `date`, `month`, `dow`, `spend`, `loc_names`, `carrier`.
- `carriers`: Pre-aggregated array of carrier performance.
- `customers`: Pre-aggregated array of customer performance.
- `zones`: Pre-aggregated array of regional performance.

## 3. Deployment Steps

### Build
To create a production build:
```bash
npm run build
```
The output will be in the `dist/` folder, ready to be served by any web server (Nginx, Apache) or integrated into a Node.js project.

### Styling
- **Tailwind v4**: This project uses the new Tailwind v4. Theme variables are defined in `src/index.css` under `@theme`.
- **Icons**: Lucide React is used for all iconography.

## 4. Code Maintenance
- **Filters**: Filtering logic (Year/Month/Comparison) is located in `src/App.tsx` using `useMemo`.
- **Charts**: Built with `recharts`. Styles are controlled via props in `OverviewTab.tsx`.
