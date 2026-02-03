#!/usr/bin/env python3
"""
Generate 2026 revenue forecast for Keystone Security Distribution.

Two forecast modes:
  1. Full Year (Equal Weight) - CAGR from all historical annual revenue
  2. Recent Quarter (Weighted) - Weighted average of Q4-to-Q4 growth rates,
     giving more weight to the most recent transition

Both modes apply the same monthly seasonality indices from historical patterns.
Outputs data/forecast_2026.json with both variants.
"""
import os
import csv
import json
import math
from datetime import datetime
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'data')
Q4_MONTHS = ['10', '11', '12']


def load_csv(filename):
    """Load a CSV file and return list of dicts."""
    path = os.path.join(DATA_DIR, filename)
    with open(path, 'r', newline='') as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            rows.append(row)
    return rows


def build_forecast(categories, cat_annual, cat_growth_rates, cat_seasonality,
                   seasonality, base_year, forecast_year, month_names):
    """Build a forecast variant given per-category growth rates."""
    by_category = []
    for cat in categories:
        base_rev = cat_annual[cat].get(base_year, 0)
        growth = cat_growth_rates[cat]
        projected_annual = base_rev * (1 + growth)

        by_month = []
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
            'cagr_pct': round(growth * 100, 2),
            'yoy_growth_pct': round(growth * 100, 2),
            'by_month': by_month,
        })

    total_base = sum(cat_annual[cat].get(base_year, 0) for cat in categories)
    total_projected = sum(c['projected_revenue'] for c in by_category)
    total_growth = (total_projected / total_base - 1) if total_base > 0 else 0

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

    return {
        'overall': {
            'base_year_revenue': round(total_base, 2),
            'projected_revenue': round(total_projected, 2),
            'yoy_growth_pct': round(total_growth * 100, 2),
        },
        'by_month': overall_by_month,
        'by_category': by_category,
    }


def main():
    print("Loading historical data...")
    orders = load_csv('orders.csv')
    order_lines = load_csv('order_lines.csv')
    products = load_csv('products.csv')

    # Build product lookup
    product_map = {}
    for p in products:
        product_map[int(p['product_id'])] = p

    # Build customer lookup
    customers = load_csv('customers.csv')
    customer_map = {}
    for c in customers:
        customer_map[int(c['customer_id'])] = c

    # Build order lookup: order_id -> { year, month, customer_id }
    order_info = {}
    for o in orders:
        if o['status'] == 'CANCELLED':
            continue
        date = o['order_date']
        order_info[int(o['order_id'])] = {
            'year': date[:4],
            'month': date[5:7],
            'total': float(o['total']),
            'customer_id': int(o['customer_id']),
        }

    # ── Step 1: Compute revenue by category x year x month ──
    cat_year_month = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    total_year_month = defaultdict(lambda: defaultdict(float))
    # Also: per-customer revenue by year and by year x month
    cust_year = defaultdict(lambda: defaultdict(float))
    cust_year_month = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))

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
        cid = info['customer_id']

        cat_year_month[category][info['year']][info['month']] += revenue
        total_year_month[info['year']][info['month']] += revenue
        cust_year[cid][info['year']] += revenue
        cust_year_month[cid][info['year']][info['month']] += revenue

    all_years = sorted(set(info['year'] for info in order_info.values()))
    print(f"  Years found: {', '.join(all_years)}")

    if len(all_years) < 2:
        print("ERROR: Need at least 2 years of data for trend extrapolation.")
        return

    categories = sorted(cat_year_month.keys())
    print(f"  Categories: {len(categories)}")

    # ── Step 2: Compute per-category annual revenue ──
    cat_annual = {}
    for cat in categories:
        cat_annual[cat] = {}
        for year in all_years:
            annual = sum(cat_year_month[cat][year].values())
            cat_annual[cat][year] = annual

    first_year = all_years[0]
    last_year = all_years[-1]
    n_years = int(last_year) - int(first_year)

    # ── Mode 1: Full Year CAGR ──
    cat_cagr = {}
    for cat in categories:
        start_rev = cat_annual[cat].get(first_year, 0)
        end_rev = cat_annual[cat].get(last_year, 0)
        if start_rev > 0 and end_rev > 0 and n_years > 0:
            cagr = (end_rev / start_rev) ** (1.0 / n_years) - 1
        else:
            cagr = 0.0
        cat_cagr[cat] = cagr

    # ── Mode 2: Recent Quarter (Weighted) ──
    # Compute Q4 revenue per category per year, then weighted YoY growth
    cat_q4 = {}
    for cat in categories:
        cat_q4[cat] = {}
        for year in all_years:
            q4_rev = sum(cat_year_month[cat][year].get(mm, 0) for mm in Q4_MONTHS)
            cat_q4[cat][year] = q4_rev

    # Weighted growth: more recent transitions get higher weight
    # With 3 years (2023, 2024, 2025): two transitions
    #   2023->2024: weight 1
    #   2024->2025: weight 2
    cat_q4_growth = {}
    for cat in categories:
        weighted_sum = 0.0
        weight_total = 0.0
        for i in range(1, len(all_years)):
            prev_year = all_years[i - 1]
            curr_year = all_years[i]
            prev_q4 = cat_q4[cat].get(prev_year, 0)
            curr_q4 = cat_q4[cat].get(curr_year, 0)
            if prev_q4 > 0:
                yoy = (curr_q4 / prev_q4) - 1
                weight = i  # 1 for oldest transition, 2 for next, etc.
                weighted_sum += yoy * weight
                weight_total += weight
        if weight_total > 0:
            cat_q4_growth[cat] = weighted_sum / weight_total
        else:
            cat_q4_growth[cat] = 0.0

    # ── Step 3: Compute monthly seasonality indices ──
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

    # ── Step 3b: Top 10 customers by total revenue ──
    cust_total_rev = {}
    for cid, years_dict in cust_year.items():
        cust_total_rev[cid] = sum(years_dict.values())
    top10_ids = sorted(cust_total_rev, key=cust_total_rev.get, reverse=True)[:10]
    print(f"  Top 10 customers identified")

    # Per-customer CAGR (full year mode), capped at ±50%
    CUST_GROWTH_CAP = 0.50
    cust_cagr = {}
    for cid in top10_ids:
        start_rev = cust_year[cid].get(first_year, 0)
        end_rev = cust_year[cid].get(last_year, 0)
        if start_rev > 0 and end_rev > 0 and n_years > 0:
            raw = (end_rev / start_rev) ** (1.0 / n_years) - 1
            cust_cagr[cid] = max(-CUST_GROWTH_CAP, min(CUST_GROWTH_CAP, raw))
        else:
            cust_cagr[cid] = 0.0

    # Per-customer Q4-weighted growth (recent quarter mode), also capped
    cust_q4_growth = {}
    for cid in top10_ids:
        weighted_sum = 0.0
        weight_total = 0.0
        for i in range(1, len(all_years)):
            prev_year = all_years[i - 1]
            curr_year = all_years[i]
            prev_q4 = sum(cust_year_month[cid][prev_year].get(mm, 0) for mm in Q4_MONTHS)
            curr_q4 = sum(cust_year_month[cid][curr_year].get(mm, 0) for mm in Q4_MONTHS)
            if prev_q4 > 0:
                yoy = (curr_q4 / prev_q4) - 1
                weight = i
                weighted_sum += yoy * weight
                weight_total += weight
        raw = weighted_sum / weight_total if weight_total > 0 else 0.0
        cust_q4_growth[cid] = max(-CUST_GROWTH_CAP, min(CUST_GROWTH_CAP, raw))

    # ── Step 4: Build both forecasts ──
    forecast_year = 2026
    base_year = last_year
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    full_year_forecast = build_forecast(
        categories, cat_annual, cat_cagr, cat_seasonality,
        seasonality, base_year, forecast_year, month_names
    )

    recent_quarter_forecast = build_forecast(
        categories, cat_annual, cat_q4_growth, cat_seasonality,
        seasonality, base_year, forecast_year, month_names
    )

    # Build per-customer forecasts for top 10
    def build_customer_forecasts(growth_rates):
        result = []
        for cid in top10_ids:
            cust = customer_map.get(cid, {})
            base_rev = cust_year[cid].get(base_year, 0)
            growth = growth_rates.get(cid, 0.0)
            projected_annual = base_rev * (1 + growth)

            # Use overall seasonality for monthly distribution
            season_sum = sum(seasonality.values())
            by_month = []
            for m in range(1, 13):
                mm = f'{m:02d}'
                month_share = seasonality[mm] / season_sum if season_sum > 0 else 1 / 12
                month_rev = round(projected_annual * month_share, 2)
                by_month.append({
                    'month': f'{forecast_year}-{mm}',
                    'month_label': month_names[m - 1],
                    'projected_revenue': month_rev,
                    'seasonality_index': round(seasonality[mm], 3),
                })

            result.append({
                'customer_id': cid,
                'company_name': cust.get('company_name', f'Customer {cid}'),
                'customer_type': cust.get('customer_type', ''),
                'base_year_revenue': round(base_rev, 2),
                'projected_revenue': round(projected_annual, 2),
                'yoy_growth_pct': round(growth * 100, 2),
                'by_month': by_month,
            })
        return result

    full_year_customers = build_customer_forecasts(cust_cagr)
    recent_quarter_customers = build_customer_forecasts(cust_q4_growth)

    # ── Step 5: Build output ──
    output = {
        'forecast_year': forecast_year,
        'generated_at': datetime.now().isoformat(),
        'assumptions': {
            'base_year': int(base_year),
            'years_of_history': len(all_years),
            'historical_years': [int(y) for y in all_years],
        },
        'modes': {
            'full_year': {
                'label': 'Full Year (Equal Weight)',
                'methodology': f'CAGR from {first_year}-{last_year} full-year annual revenue',
                'growth_model': f'CAGR from {first_year}-{last_year} actuals',
                **full_year_forecast,
                'top_customers': full_year_customers,
            },
            'recent_quarter': {
                'label': 'Recent Quarter (Weighted)',
                'methodology': f'Weighted average of Q4-to-Q4 growth rates ({", ".join(all_years)}), recent years weighted higher',
                'growth_model': 'Weighted Q4-to-Q4 growth rates',
                **recent_quarter_forecast,
                'top_customers': recent_quarter_customers,
            },
        },
    }

    # Write output
    out_path = os.path.join(DATA_DIR, 'forecast_2026.json')
    with open(out_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n  forecast_2026.json written to {out_path}")

    # ── Summary ──
    for mode_key, mode_label in [('full_year', 'FULL YEAR (EQUAL WEIGHT)'),
                                  ('recent_quarter', 'RECENT QUARTER (WEIGHTED)')]:
        mode = output['modes'][mode_key]
        overall = mode['overall']
        by_cat = mode['by_category']
        by_month = mode['by_month']

        print(f"\n{'='*60}")
        print(f"  2026 FORECAST — {mode_label}")
        print(f"{'='*60}")
        print(f"  Base Year:          {base_year}")
        print(f"  Base Revenue:       ${overall['base_year_revenue']:,.0f}")
        print(f"  Projected Revenue:  ${overall['projected_revenue']:,.0f}")
        print(f"  Overall YoY Growth: {overall['yoy_growth_pct']:+.1f}%")
        print(f"{'='*60}")
        print(f"  {'Category':<30} {'Base Rev':>12} {'Forecast':>12} {'Growth':>8}")
        print(f"  {'-'*28:<30} {'-'*12:>12} {'-'*12:>12} {'-'*8:>8}")
        for c in sorted(by_cat, key=lambda x: -x['projected_revenue']):
            print(f"  {c['category']:<30} ${c['base_year_revenue']:>10,.0f} ${c['projected_revenue']:>10,.0f} {c['cagr_pct']:>+6.1f}%")
        print(f"{'='*60}")
        print(f"\n  Monthly Breakdown:")
        total_proj = overall['projected_revenue']
        for m in by_month:
            bar = '#' * int(m['projected_revenue'] / total_proj * 120) if total_proj > 0 else ''
            print(f"  {m['month_label']:>3}  ${m['projected_revenue']:>10,.0f}  {bar}")

    print()


if __name__ == '__main__':
    main()
