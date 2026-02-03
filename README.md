# Keystone Security Distribution

A realistic B2B distributor demo website for a fictional Mid-Atlantic security hardware distributor, built with React and powered by synthetic transactional data.

**Tech Stack:** React 18 | Tailwind CSS | Recharts | Leaflet | Vite

---

## Features

| Page | Description |
|------|-------------|
| **Executive Dashboard** | KPI cards, revenue trend line chart, category pie chart, recent orders table, top products |
| **Product Catalog** | Searchable, sortable table of 281 SKUs with category filters and pagination |
| **Sales Trends** | Year-over-year revenue comparison, seasonality index, day-of-week distribution, top customers & products |
| **Category Performance** | Revenue & margin by category, category mix over time, YoY grouped bar chart, subcategory breakdown |
| **Customer Map** | Interactive Leaflet map with customer pins, state/type filters, customer detail list |
| **About Us** | Company profile, timeline, leadership team, testimonials, FAQ |

### Data
- **281** products across 6 categories and 25 subcategories
- **150** customer accounts (Locksmiths, Integrators, Property Managers, Retailers)
- **12,340** orders with **55,906** line items spanning 3 years (2023-2025)
- Coverage across PA, NJ, MD, VA, DE, and DC

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run
```bash
npm install
npm run dev
```
The dev server starts at [http://localhost:3000](http://localhost:3000).

### Production Build
```bash
npm run build
npm run preview
```

### Regenerate Data
```bash
npm run generate-data
```
This runs the data generation scripts in `scripts/` and outputs CSV files to `data/`.

---

## Project Structure

```
├── data/                    # CSV data files (products, customers, orders, order_lines)
├── docs/                    # Validation reports & content documents
├── public/                  # Static assets
├── scripts/                 # Data generation & validation scripts
├── src/
│   ├── components/
│   │   ├── charts/          # Reusable chart components (9 components)
│   │   ├── Header.jsx       # Top navigation
│   │   ├── Sidebar.jsx      # Collapsible side navigation
│   │   └── Layout.jsx       # Page layout wrapper
│   ├── content/             # Static JSON content (company profile, FAQ, etc.)
│   ├── pages/               # 6 page components
│   ├── utils/               # Data loading & formatting utilities
│   ├── App.jsx              # Router configuration
│   └── index.jsx            # Entry point
├── CLAUDE.md                # Project specification & agent instructions
├── vite.config.js           # Vite build configuration
└── package.json
```

---

## Deployment

This project is configured for **GitHub Pages** via GitHub Actions.

Every push to `main` triggers an automatic build and deploy. The site is hosted at:

```
https://<username>.github.io/keystone-security-demo/
```

To deploy manually:
```bash
npm run build
# Upload the dist/ directory to any static hosting provider
```

---

## License

This is a demo project with synthetic data for portfolio and educational purposes.
