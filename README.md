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
| **Customer Detail** | Individual customer profile, order history, revenue trend, top products purchased |
| **Order Detail** | Individual order breakdown with line items, totals, and status |
| **Revenue Forecast** | 2026 monthly forecast vs. actuals, budget variance analysis by category |
| **About Us** | Company profile, timeline, leadership team, testimonials, FAQ |

### Data
- **281** products across 6 categories and 25 subcategories
- **150** customer accounts (Locksmiths, Integrators, Property Managers, Retailers)
- **17,145** orders with **77,862** line items spanning 4 years (2023-2026)
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
This runs the data generation scripts in `scripts/` and outputs CSV files to `public/data/`.

---

## Project Structure

```
├── agents/                  # Agent role documentation (QA, DevOps, Feature Dev, etc.)
├── docs/                    # Validation reports & content documents
├── public/
│   ├── data/                # CSV & JSON data files (products, customers, orders, order_lines, forecast)
│   ├── favicon.svg          # Brand favicon
│   ├── og-image.svg         # Social media preview
│   └── 404.html             # SPA redirect for GitHub Pages
├── scripts/                 # Data generation & validation scripts
├── src/
│   ├── components/
│   │   ├── charts/          # Reusable chart components (8 components)
│   │   ├── Layout.jsx       # Page layout wrapper
│   │   ├── Header.jsx       # Top navigation
│   │   ├── Sidebar.jsx      # Collapsible side navigation
│   │   ├── Skeleton.jsx     # Loading skeleton placeholders
│   │   └── PageTransition.jsx # Page transition animations
│   ├── content/             # Static JSON content (company profile, FAQ, etc.)
│   ├── pages/               # 11 page components
│   ├── utils/               # Data loading & formatting utilities
│   ├── App.jsx              # Router configuration (lazy-loaded routes)
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
