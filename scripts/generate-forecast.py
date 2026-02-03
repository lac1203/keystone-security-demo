#!/usr/bin/env python3
"""
Generate 2026 revenue forecast for Keystone Security Distribution.

Methodology: Trend extrapolation with seasonal decomposition
- Reads historical actuals from data/ CSV files (2023-2025)
- Computes per-category compound annual growth rate (CAGR)
- Computes monthly seasonality indices from historical patterns
- Projects 2026 monthly revenue by category
- Outputs data/forecast_2026.json
"""
import os
import csv
import json
import math
from datetime import datetime
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')


def load_csv(filename):
    """Load a CSV file and return list of dicts."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r', newline='') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append(row)
    return rows


def main():
    print("Loading historical data...")
    orders = load_csv('orders.csv')
    order_lines = load_csv('order_lines.csv')
    products = load_csv('products.csv')

    # Build product lookup
    product_map = {}
    for p in products:
        product_map[int(p['product_id'])] = p

    # Build order lookup: order_id -> { year, month, status }
    order_info = {}
    for o in orders:
        if o['status'] == 'CANCELLED':
            continue
        date = o['order_date']
        order_info[int(o['order_id'])] = {
            'year': date[:4],
            'month': date[5:7],
            'total': float(o['total']),
        }

    # ── Step 1: Compute revenue by category x year x month ──
    # Structure: { category: { year: { month: revenue } } }
    cat_year_month = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    # Also track total revenue by year x month (all categories)
    total_year_month = defaultdict(lambda: defaultdict(float))

    for ol in order_lines:
        oid = int(ol['order_id'])
        if oid not in order_info:
            continue
        info = order_info[oid]
        pid = int(ol['product_id'])
        product = product_map.get(pid)
        if not product:
            continue

        category = product['category_l1']
        revenue = float(ol['line_total'])

        cat_year_month[category][info['year']][info['month']] += revenue
        total_year_month[info['year']][info['month']] += revenue

    # Determine available years
    all_years = sorted(set(info['year'] for info in order_info.values()))
    print(f"  Years found: {', '.join(all_years)}")

    if len(all_years) < 2:
        print("ERROR: Need at least 2 years of data for trend extrapolation.")
        return

    categories = sorted(cat_year_month.keys())
    print(f"  Categories: {len(categories)}")

    # ── Step 2: Compute per-category annual revenue and CAGR ──
    cat_annual = {}  # { category: { year: total_revenue } }
    for cat in categories:
        cat_annual[cat] = {}
        for year in all_years:
            annual = sum(cat_year_month[cat][year].values())
            cat_annual[cat][year] = annual

    # CAGR = (end/start)^(1/n) - 1
    first_year = all_years[0]
    last_year = all_years[-1]
    n_years = int(last_year) - int(first_year)

    cat_cagr = {}
    for cat in categories:
        start_rev = cat_annual[cat].get(first_year, 0)
        end_rev = cat_annual[cat].get(last_year, 0)
        if start_rev > 0 and end_rev > 0 and n_years > 0:
            cagr = (end_rev / start_rev) ** (1.0 / n_years) - 1
        else:
            cagr = 0.0
        cat_cagr[cat] = cagr

    # Total CAGR
    total_start = sum(cat_annual[cat].get(first_year, 0) for cat in categories)
    total_end = sum(cat_annual[cat].get(last_year, 0) for cat in categories)
    total_cagr = (total_end / total_start) ** (1.0 / n_years) - 1 if total_start > 0 and n_years > 0 else 0

    # ── Step 3: Compute monthly seasonality indices ──
    # Average revenue per calendar month across all years, normalize to mean=1.0
    month_totals = defaultdict(list)
    for year in all_years:
        for mm in [f'{m:02d}' for m in range(1, 13)]:
            rev = total_year_month[year].get(mm, 0)
            if rev > 0:
                month_totals[mm].append(rev)

    month_avg = {}
    for mm in [f'{m:02d}' for m in range(1, 13)]:
        values = month_totals.get(mm, [0])
        month_avg[mm] = sum(values) / len(values) if values else 0

    overall_monthly_avg = sum(month_avg.values()) / 12 if month_avg else 1
    seasonality = {}
    for mm in [f'{m:02d}' for m in range(1, 13)]:
        seasonality[mm] = month_avg[mm] / overall_monthly_avg if overall_monthly_avg > 0 else 1.0

    # Per-category seasonality
    cat_seasonality = {}
    for cat in categories:
        cat_month_totals = defaultdict(list)
        for year in all_years:
            for mm in [f'{m:02d}' for m in range(1, 13)]:
                rev = cat_year_month[cat][year].get(mm, 0)
                if rev > 0:
                    cat_month_totals[mm].append(rev)

        cat_month_avg = {}
        for mm in [f'{m:02d}' for m in range(1, 13)]:
            values = cat_month_totals.get(mm, [0])
            cat_month_avg[mm] = sum(values) / len(values) if values else 0

        cat_overall_avg = sum(cat_month_avg.values()) / 12 if cat_month_avg else 1
        cat_seasonality[cat] = {}
        for mm in [f'{m:02d}' for m in range(1, 13)]:
            cat_seasonality[cat][mm] = cat_month_avg[mm] / cat_overall_avg if cat_overall_avg > 0 else 1.0

    # ── Step 4: Project 2026 ──
    forecast_year = 2026
    base_year = last_year
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # Per-category forecast
    by_category = []
    for cat in categories:
        base_rev = cat_annual[cat].get(base_year, 0)
        projected_annual = base_rev * (1 + cat_cagr[cat])

        by_month = []
        # Distribute annual forecast using category-specific seasonality
        season_sum = sum(cat_seasonality[cat].values())
        for m in range(1, 13):
            mm = f'{m:02d}'
            month_share = cat_seasonality[cat][mm] / season_sum if season_sum > 0 else 1 / 12
            month_rev = round(projected_annual * month_share, 2)
            by_month.append({
                'month': f'{forecast_year}-{mm}',
                'month_label': month_names[m - 1],
                'projected_revenue': month_rev,
                'seasonality_index': round(cat_seasonality[cat][mm], 3),
            })

        by_category.append({
            'category': cat,
            'base_year_revenue': round(base_rev, 2),
            'projected_revenue': round(projected_annual, 2),
            'cagr_pct': round(cat_cagr[cat] * 100, 2),
            'yoy_growth_pct': round(cat_cagr[cat] * 100, 2),
            'by_month': by_month,
        })

    # Overall forecast
    total_base = sum(cat_annual[cat].get(base_year, 0) for cat in categories)
    total_projected = sum(c['projected_revenue'] for c in by_category)

    # Overall by-month
    overall_by_month = []
    for m in range(1, 13):
        mm = f'{m:02d}'
        month_rev = sum(
            next(bm['projected_revenue'] for bm in c['by_month'] if bm['month'].endswith(mm))
            for c in by_category
        )
        overall_by_month.append({
            'month': f'{forecast_year}-{mm}',
            'month_label': month_names[m - 1],
            'projected_revenue': round(month_rev, 2),
            'seasonality_index': round(seasonality[mm], 3),
        })

    # ── Step 5: Build output ──
    output = {
        'forecast_year': forecast_year,
        'generated_at': datetime.now().isoformat(),
        'methodology': 'Trend extrapolation with seasonal decomposition',
        'assumptions': {
            'base_year': int(base_year),
            'growth_model': f'CAGR from {first_year}-{last_year} actuals',
            'years_of_history': len(all_years),
            'historical_years': [int(y) for y in all_years],
        },
        'overall': {
            'base_year_revenue': round(total_base, 2),
            'projected_revenue': round(total_projected, 2),
            'yoy_growth_pct': round(total_cagr * 100, 2),
        },
        'by_month': overall_by_month,
        'by_category': by_category,
    }

    # Write output
    out_path = os.path.join(DATA_DIR, 'forecast_2026.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n  forecast_2026.json written to {out_path}")

    # ── Summary ──
    print(f"\n{'='*60}")
    print(f"  2026 REVENUE FORECAST SUMMARY")
    print(f"{'='*60}")
    print(f"  Base Year:          {base_year}")
    print(f"  Base Revenue:       ${total_base:,.0f}")
    print(f"  Projected Revenue:  ${total_projected:,.0f}")
    print(f"  Overall YoY Growth: {total_cagr*100:+.1f}%")
    print(f"{'='*60}")
    print(f"  {'Category':<30} {'Base Rev':>12} {'Forecast':>12} {'CAGR':>8}")
    print(f"  {'-'*28:<30} {'-'*12:>12} {'-'*12:>12} {'-'*8:>8}")
    for c in sorted(by_category, key=lambda x: -x['projected_revenue']):
        print(f"  {c['category']:<30} ${c['base_year_revenue']:>10,.0f} ${c['projected_revenue']:>10,.0f} {c['cagr_pct']:>+6.1f}%")
    print(f"{'='*60}")
    print(f"\n  Monthly Breakdown:")
    for m in overall_by_month:
        bar = '#' * int(m['projected_revenue'] / total_projected * 120)
        print(f"  {m['month_label']:>3}  ${m['projected_revenue']:>10,.0f}  {bar}")
    print()


if __name__ == '__main__':
    main()
