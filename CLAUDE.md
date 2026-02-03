# Keystone Security Distribution Demo Project

> **Project Type:** Realistic B2B distributor demo website with synthetic data  
> **Tech Stack:** React + Tailwind CSS + Recharts + Leaflet  
> **Data Scope:** 36 months of transactional data for a Mid-Atlantic security hardware distributor

---

## Company Profile: Keystone Security Distribution

```yaml
name: "Keystone Security Distribution"
tagline: "Your Mid-Atlantic Security Partner Since 1987"
headquarters: "275 Commerce Drive, King of Prussia, PA 19406"
annual_revenue: "$20.0M (Year 1) → $21.4M (Year 2) → ~$22.5M (Year 3, ~8% YoY)"
employees: 42
warehouse_locations:
  - King of Prussia, PA (HQ, 45,000 sqft)
  - Cherry Hill, NJ (Branch, 18,000 sqft)
service_territory: [PA, NJ, DE, MD, VA, DC]
```

---

## Data Generation Rules

### Volume Targets

| Dataset | Year 1 | Year 2 | Year 3 | Total |
|---------|--------|--------|--------|-------|
| Products | 280+ SKUs | - | - | 281 |
| Customers | 150 accounts | - | - | 150 |
| Orders | ~4,000 | ~4,100 | ~4,200 | ~12,339 |
| Order Lines | ~18,000 | ~18,500 | ~19,400 | ~55,905 |

> **Note:** Actual generated volumes supersede original targets. The larger dataset provides richer chart visualizations and more realistic distribution patterns.

**Order Lines per Order:** Mean 4.5, Min 1, Max 25 (negative binomial distribution)

### Customer Segmentation

| Type | Code | Percentage | Typical Order Value | Order Frequency |
|------|------|------------|--------------------|-----------------| 
| Locksmith Shops | LSH | 45% | $150 - $800 | 8-15x monthly |
| Security Integrators | INT | 30% | $1,500 - $8,000 | 5-15x monthly |
| Property Managers | PMG | 15% | $200 - $600 | 2-6x monthly |
| Hardware Retailers | RET | 10% | $300 - $800 | 2-6x monthly |

### Geographic Distribution

| State | Weight | Major Cities |
|-------|--------|--------------|
| PA | 35% | Philadelphia (45%), Pittsburgh (20%), Allentown, Reading, Lancaster |
| NJ | 28% | Newark, Jersey City, Trenton, Camden, Cherry Hill, Edison |
| MD | 17% | Baltimore (50%), Silver Spring, Rockville, Columbia |
| VA | 12% | Arlington, Alexandria, Richmond, Norfolk, Virginia Beach |
| DE | 5% | Wilmington (65%), Dover, Newark |
| DC | 3% | Washington |

---

## Product Categories & Margin Guidelines

### Category Taxonomy

```
├── Residential Locks (RES)
│   ├── Deadbolts (RES-DBL)
│   ├── Entry Knobs (RES-KNB)
│   ├── Handlesets (RES-HND)
│   ├── Smart Locks (RES-SMT)
│   └── Keypad Locks (RES-KPD)
│
├── Commercial Hardware (COM)
│   ├── Cylindrical Locks (COM-CYL)
│   ├── Mortise Locks (COM-MOR)
│   ├── Exit Devices (COM-EXT)
│   ├── Door Closers (COM-CLS)
│   ├── Hinges (COM-HNG)
│   └── Thresholds (COM-THR)
│
├── Access Control (ACC)
│   ├── Card Readers (ACC-RDR)
│   ├── Controllers (ACC-CTL)
│   ├── Credentials (ACC-CRD)
│   ├── Electric Strikes (ACC-STR)
│   ├── Maglocks (ACC-MAG)
│   └── Keypad Locks (ACC-KPD)
│
├── Automotive (AUT)
│   ├── Transponder Keys (AUT-TRN)
│   ├── Programming Tools (AUT-PRG)
│   ├── Lockout Tools (AUT-LOT)
│   └── Remotes & Fobs (AUT-RMT)
│
├── Safes & Security (SAF)
│   ├── Residential Safes (SAF-RES)
│   ├── Commercial Safes (SAF-COM)
│   ├── Gun Safes (SAF-GUN)
│   └── Deposit Safes (SAF-DEP)
│
└── Key Machines & Supplies (KEY)
    ├── Key Machines (KEY-MCH)
    ├── Key Blanks (KEY-BLK)
    ├── Pinning Kits (KEY-PIN)
    ├── Lubricants (KEY-LUB)
    └── Tools (KEY-TLS)
```

### Margin Targets by Category

| Category | Target Margin | Cost-to-Price Ratio | Price Range |
|----------|--------------|---------------------|-------------|
| Residential Locks | 28-32% | 0.68-0.72 | $15 - $350 |
| Commercial Hardware | 35-40% | 0.60-0.65 | $25 - $1,500 |
| Access Control | 35-50% | 0.50-0.65 | $50 - $1,500 |
| Automotive | 40-45% | 0.55-0.60 | $5 - $2,500 |
| Safes & Security | 38-42% | 0.58-0.62 | $150 - $3,500 |
| Key Machines | 20-25% | 0.75-0.80 | $300 - $10,000 |
| Key Blanks/Supplies | 50-55% | 0.45-0.50 | $5 - $400 |

### Key Manufacturers

**Tier 1 (Strategic):**
- Allegion: Schlage, Von Duprin, LCN, Falcon
- ASSA ABLOY: Corbin Russwin, Yale, Norton, Sargent, HES

**Tier 2 (Important):**
- dormakaba (Ilco, Silca, Best)
- HID Global
- Alarm Lock / NAPCO
- Spectrum Brands (Kwikset, Weiser)

**Tier 3 (Supplementary):**
- Marks USA, Don-Jo, JMA USA, Autel, Framon, Liberty Safe, AMSEC

---

## Seasonality & Time Patterns

### Monthly Multipliers

```javascript
const MONTHLY_SEASONALITY = {
  1:  0.78,  // January - post-holiday slump
  2:  0.72,  // February - lowest month
  3:  0.92,  // March - spring warmup
  4:  1.08,  // April - construction starts
  5:  1.15,  // May - strong growth
  6:  1.22,  // June - PEAK MONTH
  7:  1.18,  // July - summer strong
  8:  1.16,  // August - back to school prep
  9:  1.10,  // September - steady
  10: 1.05,  // October - moderate
  11: 0.98,  // November - pre-holiday dip
  12: 0.88   // December - holiday slowdown
};
```

### Day-of-Week Multipliers

```javascript
const DAY_OF_WEEK = {
  monday:    1.35,  // Heavy restock after weekend
  tuesday:   1.25,  // Second busiest
  wednesday: 1.10,  // Moderate
  thursday:  1.00,  // Baseline
  friday:    0.85,  // Winding down
  saturday:  0.30,  // Minimal
  sunday:    0.15   // Emergency only
};
```

### Week-of-Month Multipliers

```javascript
const WEEK_OF_MONTH = {
  week_1: 1.08,  // Beginning of billing cycle
  week_2: 1.12,  // Peak mid-month
  week_3: 1.05,  // Moderate
  week_4: 0.88   // Month-end slowdown
};
```

---

## Customer-Product Affinities

These weights determine which product categories each customer type typically purchases:

```javascript
const CUSTOMER_PRODUCT_AFFINITIES = {
  LSH: { // Locksmith Shops
    residential_locks: 0.30,
    commercial_hardware: 0.20,
    access_control: 0.10,
    automotive: 0.20,
    safes_security: 0.05,
    key_supplies: 0.15
  },
  INT: { // Security Integrators
    residential_locks: 0.05,
    commercial_hardware: 0.30,
    access_control: 0.50,
    automotive: 0.02,
    safes_security: 0.05,
    key_supplies: 0.08
  },
  PMG: { // Property Managers
    residential_locks: 0.45,
    commercial_hardware: 0.30,
    access_control: 0.15,
    automotive: 0.00,
    safes_security: 0.05,
    key_supplies: 0.05
  },
  RET: { // Hardware Retailers
    residential_locks: 0.50,
    commercial_hardware: 0.15,
    access_control: 0.05,
    automotive: 0.05,
    safes_security: 0.10,
    key_supplies: 0.15
  }
};
```

---

## Database Schemas

### products.csv

```csv
product_id,sku,name,manufacturer,category_l1,category_l2,cost,price,msrp,uom,min_order_qty,status
```

**Field Rules:**
- `product_id`: Sequential integer starting at 1
- `sku`: Format `{CAT_L2}-{NNN}` (e.g., `RES-DBL-001`)
- `cost`: Distributor cost
- `price`: Wholesale price to customers
- `msrp`: Manufacturer suggested retail
- `uom`: EA (each), BX (box), PK (pack), KIT, SET
- Constraint: `price >= cost`, `msrp >= price`

### customers.csv

```csv
customer_id,account_number,company_name,customer_type,contact_name,email,phone,address,city,state,zip,payment_terms,credit_limit,status,created_date
```

**Field Rules:**
- `customer_id`: Sequential integer starting at 1
- `account_number`: Format `KSD-{NNNNN}` (e.g., `KSD-00001`)
- `customer_type`: One of `LSH`, `INT`, `PMG`, `RET`
- `payment_terms`: One of `COD`, `NET15`, `NET30`, `NET45`
- `credit_limit`: $1,000 - $200,000 based on customer type
- `created_date`: Between 2015-01-01 and 2022-12-31

### orders.csv

```csv
order_id,order_number,customer_id,order_date,ship_date,subtotal,tax,freight,total,total_cost,margin,status,payment_status,po_number
```

**Field Rules:**
- `order_id`: Sequential integer starting at 1
- `order_number`: Format `ORD-{YYYYMM}-{NNNNN}` (e.g., `ORD-202301-00001`)
- `order_date`: Between 2023-01-01 and 2025-12-31
- `ship_date`: order_date + 0-3 business days
- `margin`: Calculated as `(total - total_cost) / total`
- `status`: `SHIPPED`, `DELIVERED`, `PENDING`, `CANCELLED`
- `payment_status`: `PAID`, `UNPAID`, `PARTIAL`, `OVERDUE`

### order_lines.csv

```csv
line_id,order_id,line_number,product_id,quantity,unit_price,unit_cost,line_total,line_cost
```

**Field Rules:**
- `line_id`: Sequential integer starting at 1
- `line_number`: Sequential within order (1, 2, 3...)
- `quantity`: 1-100, varies by product category
- `unit_price`: May vary ±5% from standard price (volume discounts)
- Constraint: `order_id` must exist in orders, `product_id` must exist in products

---

## Design System

### Colors

```css
:root {
  /* Brand Colors */
  --primary: #1e3a5f;       /* Deep navy - headers, primary buttons */
  --secondary: #4a7c59;     /* Forest green - success states, accents */
  --accent: #d4a84b;        /* Brass/gold - highlights, CTAs */
  --danger: #c44536;        /* Alert red - errors, negative trends */
  --success: #2e8b57;       /* Sea green - positive indicators */
  
  /* Neutrals */
  --gray-900: #1a1a1a;
  --gray-700: #4a4a4a;
  --gray-500: #737373;
  --gray-300: #b3b3b3;
  --gray-100: #f5f5f5;
  --white: #ffffff;
  
  /* Chart Colors (in order of use) */
  --chart-1: #1e3a5f;
  --chart-2: #4a7c59;
  --chart-3: #d4a84b;
  --chart-4: #6b8e9f;
  --chart-5: #7a9f6b;
  --chart-6: #c9a227;
}
```

### Typography

```css
--font-heading: 'Inter', -apple-system, sans-serif;
--font-body: 'Open Sans', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

### Tailwind Classes Reference

```jsx
// Primary Button
className="bg-[#1e3a5f] hover:bg-[#2a4a73] text-white px-4 py-2 rounded-lg"

// Secondary Button  
className="bg-[#4a7c59] hover:bg-[#5a8c69] text-white px-4 py-2 rounded-lg"

// Card Container
className="bg-white rounded-xl shadow-md p-6 border border-gray-100"

// KPI Card
className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-6"

// Data Table
className="w-full border-collapse text-sm"
// Table Header
className="bg-gray-50 text-left text-gray-600 font-medium"
// Table Row Hover
className="hover:bg-gray-50 border-b border-gray-100"
```

---

## File Ownership Matrix

| Agent | Owned Files | Dependencies |
|-------|-------------|--------------|
| **DataEngineer** | `/data/products.csv`, `/data/customers.csv`, `/data/orders.csv`, `/data/order_lines.csv`, `/data/summary.json` | Research output |
| **VisualizationSpecialist** | `/src/components/charts/*.jsx` | Data files |
| **FrontendBuilder** | `/src/pages/*.jsx`, `/src/App.jsx`, `/src/index.jsx` | Chart components |
| **ContentWriter** | `/docs/*.md`, `/src/content/*.json` | Company profile |
| **QAValidator** | `/scripts/*.js`, `/docs/validation_report.md` | All outputs |
| **UXDesigner** | `public/`, `src/index.css`, `index.html`, `src/components/Layout.jsx` | Design system |
| **DevOpsEngineer** | `.github/workflows/`, `vite.config.js`, `.gitignore`, `public/404.html` | Build output |
| **FeatureDeveloper** | `src/pages/*.jsx`, `src/components/charts/*.jsx`, `src/utils/dataLoader.js` | Data + components |
| **FinancialAnalyst** | `scripts/generate-forecast.py`, `data/forecast_2026.json` | Historical data files |

---

## Agent Personas

### 1. QA Validator
**Role:** Data integrity guardian and test automation lead
**Responsibilities:**
- Fix data validation issues (e.g., day-of-week seasonality)
- Run and maintain validation scripts (`scripts/validate-*.js`)
- Verify referential integrity across all CSV files
- Ensure margin bounds, date sequencing, and calculation accuracy
- Regression-test after any data or code changes
- Produce the validation report (`docs/validation_report.md`)

### 2. UX & Design Specialist
**Role:** Visual polish, accessibility, and user experience
**Responsibilities:**
- Create favicon and logo assets for brand identity
- Build a proper 404/Not Found page
- Add page transition animations and micro-interactions
- Audit and improve mobile responsiveness across all 6 pages
- Ensure color contrast meets WCAG AA accessibility standards
- Add meta tags (Open Graph, Twitter Card) for social sharing previews
- Polish chart tooltips, legends, and empty states

### 3. DevOps & Deployment Engineer
**Role:** Build pipeline, hosting, and CI/CD automation
**Responsibilities:**
- Maintain the GitHub Actions deployment workflow
- Configure `vite.config.js` for hosting (base path, build settings)
- Maintain the SPA routing fix (`public/404.html`)
- Add build-validation CI steps (lint, type-check, or test)
- Manage `.gitignore` to exclude `node_modules/`, `dist/`, `.env`, etc.
- Monitor bundle size and optimize code splitting
- Handle any future domain or hosting migration

### 4. Feature Developer
**Role:** New pages, components, and interactive features
**Responsibilities:**
- Build new dashboard widgets or pages as scope expands
- Add interactivity: drill-down from summary charts to detail views
- Implement data export (CSV download, PDF reports)
- Add customer detail pages (click a customer on the map to see order history)
- Build an order detail view (click an order number to see line items)
- Integrate any new data sources or API endpoints
- Maintain the component library (`src/components/charts/`)

### 5. Financial Analyst
**Role:** Revenue forecasting, budget modeling, and financial planning
**Responsibilities:**
- Build and maintain the Python forecast script (`scripts/generate-forecast.py`)
- Apply trend extrapolation: CAGR from 2023-2025 actuals projected to 2026
- Apply monthly seasonality multipliers from historical patterns
- Output `data/forecast_2026.json` for frontend consumption
- Document assumptions and methodology
- Refine the model as new actuals become available

---

## Code Standards

### React Components

```jsx
// Use functional components with hooks
// Single file per component
// Props destructured with defaults
// Tailwind for all styling (no separate CSS)

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function RevenueTrend({ data = [], height = 300 }) {
  // Component logic here
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={height}>
        {/* Chart content */}
      </ResponsiveContainer>
    </div>
  );
}
```

### Data Loading Pattern

```jsx
// Use Papa Parse for CSV files
import Papa from 'papaparse';

const loadData = async (filename) => {
  const response = await fetch(`/data/${filename}`);
  const text = await response.text();
  const { data } = Papa.parse(text, { header: true, dynamicTyping: true });
  return data;
};
```

### Number Formatting

```javascript
// Currency
const formatCurrency = (value) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

// Percentage
const formatPercent = (value) => 
  new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(value);

// Compact numbers
const formatCompact = (value) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
```

---

## Validation Rules

### Data Integrity Checks

```javascript
// 1. Referential integrity
orders.every(o => customers.find(c => c.customer_id === o.customer_id))
order_lines.every(ol => orders.find(o => o.order_id === ol.order_id))
order_lines.every(ol => products.find(p => p.product_id === ol.product_id))

// 2. Margin bounds
products.every(p => {
  const margin = (p.price - p.cost) / p.price;
  return margin >= 0.15 && margin <= 0.60;
})

// 3. Date sequencing
orders.every(o => new Date(o.ship_date) >= new Date(o.order_date))

// 4. Calculation accuracy
order_lines.every(ol => ol.line_total === ol.quantity * ol.unit_price)
orders.every(o => o.total === o.subtotal + o.tax + o.freight)
```

### Geographic Validation

```javascript
// Valid states for this territory
const VALID_STATES = ['PA', 'NJ', 'MD', 'VA', 'DE', 'DC'];
customers.every(c => VALID_STATES.includes(c.state))
```

### Statistical Validation

```javascript
// Monthly revenue should show seasonality pattern
// February should be lowest, June should be highest
// YoY growth should be approximately 8%
```

---

## Agent Communication Protocol

### Task Claiming

When an agent claims a task:
```
TaskUpdate({ 
  taskId: "X", 
  owner: "AgentName",
  status: "in_progress"
})
```

### Task Completion

When completing a task, report:
```
TaskUpdate({
  taskId: "X",
  status: "completed",
  notes: "Generated 207 products. Margins: RES 29.5%, COM 37.2%, ACC 42.1%..."
})
```

### Blocking Issues

If an agent discovers a blocking problem:
```
Teammate({
  operation: "write",
  recipient: "orchestrator",
  message: "BLOCKING: orders.csv references customer_id 999 which doesn't exist in customers.csv"
})
```

### Handoff Notifications

When completing work another agent depends on:
```
Teammate({
  operation: "write",
  recipient: "FrontendBuilder",
  message: "RevenueTrend.jsx complete. Props: { data: OrdersByMonth[], height?: number }"
})
```

---

## Quick Reference

### Generate Product SKU

```javascript
const generateSKU = (categoryL2, index) => {
  const codes = {
    'Deadbolts': 'RES-DBL',
    'Entry Knobs': 'RES-KNB',
    'Exit Devices': 'COM-EXT',
    // ... etc
  };
  return `${codes[categoryL2]}-${String(index).padStart(3, '0')}`;
};
```

### Generate Order Number

```javascript
const generateOrderNumber = (date, sequence) => {
  const ym = date.toISOString().slice(0, 7).replace('-', '');
  return `ORD-${ym}-${String(sequence).padStart(5, '0')}`;
};
```

### Apply Seasonality

```javascript
const applySeasonality = (baseOrders, month) => {
  return Math.round(baseOrders * MONTHLY_SEASONALITY[month]);
};
```

### Calculate Margin

```javascript
const calculateMargin = (price, cost) => ((price - cost) / price).toFixed(4);
```

---

## Project Timeline

1. **Phase 1 - Data Generation** (DataEngineer)
   - products.csv → customers.csv → orders.csv → order_lines.csv
   
2. **Phase 2 - Visualization** (VisualizationSpecialist)
   - Chart components (blocked by data)
   
3. **Phase 3 - Pages** (FrontendBuilder)
   - Dashboard, Catalog, Map pages (blocked by components)
   
4. **Phase 4 - Validation** (QAValidator)
   - Run all validation checks
   - Generate final report

---

*Last Updated: February 2026*  
*Project Lead: Orchestrator Agent*
