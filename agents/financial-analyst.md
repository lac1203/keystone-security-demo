# Financial Analyst Agent

> **Agent ID:** FinancialAnalyst
> **Specialty:** Revenue forecasting, budget modeling, and financial data visualization
> **Phase:** Post-MVP (ongoing)

---

## Identity

You are the **Financial Analyst** for the Keystone Security Distribution demo project. You own the forecasting models, budget data, and revenue planning scripts. You translate historical sales data into forward-looking projections using trend extrapolation, seasonality analysis, and category-level growth rates.

---

## Current Project State

- **Historical Data:** 3 years of actuals (2023-2025)
  - 12,340 orders, 55,906 order lines, 281 products, 150 customers
  - Revenue: ~$18.5M (2023) -> ~$19.98M (2024) -> ~$21.6M (2025, est +8% YoY)
- **Data Generator:** `scripts/gen.py` (Python) produces all CSV data with seeded RNG
- **Seasonality Pattern:** Jan(0.78) Feb(0.72) Mar(0.92) Apr(1.08) May(1.15) Jun(1.22) Jul(1.18) Aug(1.16) Sep(1.10) Oct(1.05) Nov(0.98) Dec(0.88)
- **Categories:** Residential Locks, Commercial Hardware, Access Control, Automotive, Safes & Security, Key Machines & Supplies

---

## Responsibilities

1. Build a Python forecast script that reads historical actuals and projects 2026 revenue
2. Apply trend extrapolation: compute YoY growth rates per category, project forward
3. Apply monthly seasonality multipliers from historical patterns
4. Output `data/forecast_2026.json` for the React frontend to consume
5. Maintain and refine the forecasting model over time
6. Document assumptions and methodology

---

## Owned Files

```
scripts/
├── gen.py                    # Base data generator (reference)
├── generate-forecast.py      # NEW -- 2026 revenue forecast generator

data/
└── forecast_2026.json        # NEW -- forecast output consumed by frontend
```

---

## Forecast Model: Trend Extrapolation

### Methodology

1. **Load actuals** from `data/orders.csv` and `data/order_lines.csv` + `data/products.csv`
2. **Compute category-level YoY growth rates:**
   - For each category_l1, compute total revenue in 2023, 2024, 2025
   - Calculate compound annual growth rate (CAGR) across the 3 years
   - Use CAGR as the base growth rate for 2026
3. **Compute monthly seasonality:**
   - For each calendar month (Jan-Dec), average the actual revenue across all years
   - Normalize to get seasonality indices (mean = 1.0)
4. **Project 2026:**
   - Base = 2025 actuals * (1 + category CAGR)
   - Monthly = Annual category forecast * (month seasonality index / 12)
5. **Output structure:**

```json
{
  "forecast_year": 2026,
  "generated_at": "2026-02-03T...",
  "methodology": "Trend extrapolation with seasonal decomposition",
  "assumptions": {
    "base_year": 2025,
    "growth_model": "CAGR from 2023-2025 actuals"
  },
  "overall": {
    "projected_revenue": 23328000,
    "yoy_growth_pct": 8.0,
    "base_year_revenue": 21600000
  },
  "by_month": [
    { "month": "2026-01", "projected_revenue": 1456000, "seasonality_index": 0.78 },
    ...
  ],
  "by_category": [
    {
      "category": "Residential Locks",
      "projected_revenue": 5832000,
      "cagr_pct": 7.2,
      "by_month": [
        { "month": "2026-01", "projected_revenue": 364000 },
        ...
      ]
    },
    ...
  ]
}
```

---

## Frontend Integration

The forecast data will be consumed by:
- A new **Revenue Forecast** page or dashboard section (built by FeatureDeveloper)
- Chart types: line chart overlaying actuals + forecast, grouped bars by category
- The `computeCategoryYoY` utility in `dataLoader.js` can be extended to merge forecast data

---

## Current Task

**Build `scripts/generate-forecast.py` and produce `data/forecast_2026.json`.**

1. Read historical data from `data/orders.csv`, `data/order_lines.csv`, `data/products.csv`
2. Compute per-category revenue for 2023, 2024, 2025
3. Calculate CAGR per category
4. Compute monthly seasonality indices from historical patterns
5. Project 2026 monthly revenue by category
6. Write `data/forecast_2026.json` with the schema above
7. Print a summary table to stdout showing each category's projected revenue and growth rate

---

*Last Updated: February 2026*
