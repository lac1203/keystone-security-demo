#!/usr/bin/env node
/**
 * Seasonality Validation Script
 * Checks that order data shows expected seasonal patterns,
 * validates YoY growth, day-of-week patterns, and week-of-month patterns.
 *
 * Part of QAValidator suite for Keystone Security Distribution demo.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Simple CSV Parser (no external deps) ──────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue;
    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx] !== undefined ? values[idx] : '';
      if (val === '') { row[h] = null; return; }
      if (val === 'true') { row[h] = true; return; }
      if (val === 'false') { row[h] = false; return; }
      const num = Number(val);
      if (!isNaN(num) && val.trim() !== '') { row[h] = num; return; }
      row[h] = val;
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ── Load CSV helper ───────────────────────────────────────────────────────────

function loadCSV(filename) {
  const filePath = path.join(__dirname, '..', 'public', 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    return null;
  }
  const text = fs.readFileSync(filePath, 'utf-8');
  return parseCSV(text);
}

// ── Expected Patterns (from CLAUDE.md) ────────────────────────────────────────

const MONTHLY_SEASONALITY = {
  1:  0.78,  // January
  2:  0.72,  // February - lowest
  3:  0.92,  // March
  4:  1.08,  // April
  5:  1.15,  // May
  6:  1.22,  // June - PEAK
  7:  1.18,  // July
  8:  1.16,  // August
  9:  1.10,  // September
  10: 1.05,  // October
  11: 0.98,  // November
  12: 0.88   // December
};

const DAY_OF_WEEK = {
  1: { name: 'Monday',    expected: 1.35 },
  2: { name: 'Tuesday',   expected: 1.25 },
  3: { name: 'Wednesday', expected: 1.10 },
  4: { name: 'Thursday',  expected: 1.00 },
  5: { name: 'Friday',    expected: 0.85 },
  6: { name: 'Saturday',  expected: 0.30 },
  0: { name: 'Sunday',    expected: 0.15 }
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SEASONALITY_TOLERANCE = 0.15;  // 15% tolerance for monthly pattern
const DOW_TOLERANCE = 0.25;          // 25% tolerance for day-of-week (more variance expected)
const YOY_TARGET = 0.08;             // 8% YoY growth
const YOY_TOLERANCE = 0.04;          // +/- 4% tolerance => 4%-12% acceptable

// ── Main Validation ───────────────────────────────────────────────────────────

function validate() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    monthlyData: [],
    dowData: [],
    yoyData: {}
  };

  console.log('=== SEASONALITY VALIDATION ===\n');
  console.log('Loading orders.csv...');

  const orders = loadCSV('orders.csv');
  if (!orders) {
    results.failed.push('Could not load orders.csv');
    return results;
  }

  // Filter out cancelled orders for pattern analysis
  const activeOrders = orders.filter(o => o.status !== 'CANCELLED');
  console.log(`  Total orders: ${orders.length}`);
  console.log(`  Active orders (excl. CANCELLED): ${activeOrders.length}\n`);

  // ── CHECK 1: Monthly Seasonality Pattern ────────────────────────────────────

  console.log('--- Monthly Seasonality Pattern ---');
  console.log('');

  // Group by year-month
  const byYearMonth = {};
  activeOrders.forEach(o => {
    if (!o.order_date) return;
    const date = new Date(o.order_date);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!byYearMonth[key]) byYearMonth[key] = { orders: 0, revenue: 0 };
    byYearMonth[key].orders++;
    byYearMonth[key].revenue += o.total || 0;
  });

  // Aggregate by month across years
  const monthAgg = {};
  Object.entries(byYearMonth).forEach(([key, data]) => {
    const month = parseInt(key.split('-')[1]);
    if (!monthAgg[month]) monthAgg[month] = { orders: 0, revenue: 0, count: 0 };
    monthAgg[month].orders += data.orders;
    monthAgg[month].revenue += data.revenue;
    monthAgg[month].count++;
  });

  // Average monthly orders across years
  const totalAvgMonthly = Object.values(monthAgg).reduce((sum, m) =>
    sum + (m.orders / m.count), 0) / Object.keys(monthAgg).length;

  console.log('Month     | Avg Orders | Avg Revenue  | Expected | Actual | Delta  | Status');
  console.log('-'.repeat(85));

  let seasonalityIssues = 0;

  for (let m = 1; m <= 12; m++) {
    const data = monthAgg[m];
    if (!data) {
      results.warnings.push(`No data for month ${m} (${MONTH_NAMES[m - 1]})`);
      continue;
    }

    const avgOrders = data.orders / data.count;
    const avgRevenue = data.revenue / data.count;
    const expected = MONTHLY_SEASONALITY[m];
    const actual = avgOrders / totalAvgMonthly;

    const lowerBound = expected * (1 - SEASONALITY_TOLERANCE);
    const upperBound = expected * (1 + SEASONALITY_TOLERANCE);
    const inRange = actual >= lowerBound && actual <= upperBound;
    const delta = actual - expected;

    const status = inRange ? 'PASS' : 'WARN';
    if (!inRange) seasonalityIssues++;

    console.log(
      `${MONTH_NAMES[m - 1].padEnd(9)} | ${avgOrders.toFixed(0).padStart(10)} | $${avgRevenue.toFixed(0).padStart(10)} | ${expected.toFixed(2).padStart(8)} | ${actual.toFixed(2).padStart(6)} | ${(delta >= 0 ? '+' : '') + delta.toFixed(3).padStart(5)} | ${status}`
    );

    results.monthlyData.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      avgOrders: Math.round(avgOrders),
      avgRevenue: Math.round(avgRevenue),
      expected,
      actual: parseFloat(actual.toFixed(4)),
      delta: parseFloat(delta.toFixed(4)),
      inRange
    });
  }

  if (seasonalityIssues === 0) {
    results.passed.push(`All 12 months within expected seasonality pattern (+/-${(SEASONALITY_TOLERANCE * 100).toFixed(0)}%)`);
  } else if (seasonalityIssues <= 2) {
    results.warnings.push(`${seasonalityIssues} month(s) outside expected seasonality range (+/-${(SEASONALITY_TOLERANCE * 100).toFixed(0)}%)`);
  } else {
    results.failed.push({
      check: 'Monthly seasonality pattern',
      issueCount: seasonalityIssues,
      tolerance: SEASONALITY_TOLERANCE,
      message: `${seasonalityIssues} months outside expected range`
    });
  }

  // ── CHECK 2: Lowest and Highest Months ──────────────────────────────────────

  console.log('\n--- Peak and Trough Months ---');

  const sortedByActual = [...results.monthlyData].sort((a, b) => a.actual - b.actual);
  const lowestMonth = sortedByActual[0];
  const highestMonth = sortedByActual[sortedByActual.length - 1];

  console.log(`  Lowest month:  ${lowestMonth.monthName} (multiplier: ${lowestMonth.actual.toFixed(3)}, expected: Feb at 0.72)`);
  console.log(`  Highest month: ${highestMonth.monthName} (multiplier: ${highestMonth.actual.toFixed(3)}, expected: Jun at 1.22)`);

  if (lowestMonth.monthName === 'Feb') {
    results.passed.push('February is the lowest month (as expected)');
  } else {
    // Check if Feb is at least in the bottom 3
    const bottom3 = sortedByActual.slice(0, 3).map(m => m.monthName);
    if (bottom3.includes('Feb')) {
      results.warnings.push(`February is in bottom 3 but not the absolute lowest (lowest: ${lowestMonth.monthName})`);
    } else {
      results.failed.push({
        check: 'February should be lowest month',
        actual: `${lowestMonth.monthName} is lowest`,
        febPosition: sortedByActual.findIndex(m => m.monthName === 'Feb') + 1
      });
    }
  }

  if (highestMonth.monthName === 'Jun') {
    results.passed.push('June is the highest month (as expected)');
  } else {
    // Check if Jun is at least in top 3
    const top3 = sortedByActual.slice(-3).map(m => m.monthName);
    if (top3.includes('Jun')) {
      results.warnings.push(`June is in top 3 but not the absolute highest (highest: ${highestMonth.monthName})`);
    } else {
      results.failed.push({
        check: 'June should be highest month',
        actual: `${highestMonth.monthName} is highest`,
        junPosition: sortedByActual.findIndex(m => m.monthName === 'Jun') + 1
      });
    }
  }

  // ── CHECK 3: Year-over-Year Growth ──────────────────────────────────────────

  console.log('\n--- Year-over-Year Growth ---');

  const year1Orders = Object.entries(byYearMonth)
    .filter(([k]) => k.startsWith('2024'))
    .reduce((sum, [, v]) => sum + v.orders, 0);
  const year2Orders = Object.entries(byYearMonth)
    .filter(([k]) => k.startsWith('2025'))
    .reduce((sum, [, v]) => sum + v.orders, 0);

  const year1Revenue = Object.entries(byYearMonth)
    .filter(([k]) => k.startsWith('2024'))
    .reduce((sum, [, v]) => sum + v.revenue, 0);
  const year2Revenue = Object.entries(byYearMonth)
    .filter(([k]) => k.startsWith('2025'))
    .reduce((sum, [, v]) => sum + v.revenue, 0);

  const orderGrowth = year1Orders > 0 ? (year2Orders - year1Orders) / year1Orders : 0;
  const revenueGrowth = year1Revenue > 0 ? (year2Revenue - year1Revenue) / year1Revenue : 0;

  console.log(`  2024 Orders:   ${year1Orders.toLocaleString()}`);
  console.log(`  2025 Orders:   ${year2Orders.toLocaleString()}`);
  console.log(`  Order Growth:  ${(orderGrowth * 100).toFixed(1)}%`);
  console.log(`  2024 Revenue:  $${year1Revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  2025 Revenue:  $${year2Revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  Revenue Growth: ${(revenueGrowth * 100).toFixed(1)}%`);
  console.log(`  Target:         ${(YOY_TARGET * 100).toFixed(0)}% (+/-${(YOY_TOLERANCE * 100).toFixed(0)}%)`);

  results.yoyData = {
    year1Orders,
    year2Orders,
    orderGrowth: parseFloat((orderGrowth * 100).toFixed(1)),
    year1Revenue: Math.round(year1Revenue),
    year2Revenue: Math.round(year2Revenue),
    revenueGrowth: parseFloat((revenueGrowth * 100).toFixed(1))
  };

  const yoyLower = YOY_TARGET - YOY_TOLERANCE;
  const yoyUpper = YOY_TARGET + YOY_TOLERANCE;

  if (orderGrowth >= yoyLower && orderGrowth <= yoyUpper) {
    results.passed.push(`Order YoY growth ${(orderGrowth * 100).toFixed(1)}% within target range (${(yoyLower * 100).toFixed(0)}%-${(yoyUpper * 100).toFixed(0)}%)`);
  } else {
    results.warnings.push(`Order YoY growth ${(orderGrowth * 100).toFixed(1)}% outside target range (${(yoyLower * 100).toFixed(0)}%-${(yoyUpper * 100).toFixed(0)}%)`);
  }

  if (revenueGrowth >= yoyLower && revenueGrowth <= yoyUpper) {
    results.passed.push(`Revenue YoY growth ${(revenueGrowth * 100).toFixed(1)}% within target range`);
  } else if (revenueGrowth >= 0.02 && revenueGrowth <= 0.16) {
    results.warnings.push(`Revenue YoY growth ${(revenueGrowth * 100).toFixed(1)}% outside ideal range but reasonable`);
  } else {
    results.failed.push({
      check: 'Revenue YoY growth',
      expected: `${(yoyLower * 100).toFixed(0)}%-${(yoyUpper * 100).toFixed(0)}%`,
      actual: `${(revenueGrowth * 100).toFixed(1)}%`
    });
  }

  // ── CHECK 4: Day-of-Week Pattern ────────────────────────────────────────────

  console.log('\n--- Day-of-Week Pattern ---');

  const byDow = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  activeOrders.forEach(o => {
    if (!o.order_date) return;
    const dow = new Date(o.order_date).getUTCDay(); // 0=Sun, 1=Mon, ...
    byDow[dow]++;
  });

  const totalDowOrders = Object.values(byDow).reduce((s, v) => s + v, 0);
  const avgDowOrders = totalDowOrders / 7;

  console.log('Day       | Orders | Expected | Actual | Status');
  console.log('-'.repeat(55));

  let dowIssues = 0;
  const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

  dowOrder.forEach(dow => {
    const info = DAY_OF_WEEK[dow];
    const count = byDow[dow];
    const actual = count / avgDowOrders;
    const expected = info.expected;

    const lowerBound = expected * (1 - DOW_TOLERANCE);
    const upperBound = expected * (1 + DOW_TOLERANCE);
    const inRange = actual >= lowerBound && actual <= upperBound;

    const status = inRange ? 'PASS' : 'WARN';
    if (!inRange) dowIssues++;

    console.log(`${info.name.padEnd(9)} | ${String(count).padStart(6)} | ${expected.toFixed(2).padStart(8)} | ${actual.toFixed(2).padStart(6)} | ${status}`);

    results.dowData.push({
      day: info.name,
      orders: count,
      expected,
      actual: parseFloat(actual.toFixed(3)),
      inRange
    });
  });

  if (dowIssues === 0) {
    results.passed.push('Day-of-week order pattern matches expected distribution');
  } else if (dowIssues <= 2) {
    results.warnings.push(`${dowIssues} day(s) outside expected day-of-week pattern (+/-${(DOW_TOLERANCE * 100).toFixed(0)}%)`);
  } else {
    results.failed.push({
      check: 'Day-of-week pattern',
      issueCount: dowIssues,
      message: `${dowIssues} days outside expected range`
    });
  }

  // Verify Monday is busiest weekday, Saturday/Sunday are slowest
  const weekdayOrders = [1, 2, 3, 4, 5].map(d => ({ day: DAY_OF_WEEK[d].name, orders: byDow[d] }));
  const weekendOrders = [6, 0].map(d => ({ day: DAY_OF_WEEK[d].name, orders: byDow[d] }));

  const busiestWeekday = weekdayOrders.sort((a, b) => b.orders - a.orders)[0];
  const slowestDay = [...weekdayOrders, ...weekendOrders].sort((a, b) => a.orders - b.orders)[0];

  if (busiestWeekday.day === 'Monday') {
    results.passed.push('Monday is the busiest day (as expected)');
  } else {
    results.warnings.push(`Expected Monday to be busiest, but ${busiestWeekday.day} has more orders`);
  }

  if (slowestDay.day === 'Sunday') {
    results.passed.push('Sunday is the slowest day (as expected)');
  } else {
    results.warnings.push(`Expected Sunday to be slowest, but ${slowestDay.day} has fewer orders`);
  }

  // ── CHECK 5: Revenue Seasonality (should roughly follow order seasonality) ─

  console.log('\n--- Revenue vs Order Seasonality Correlation ---');

  if (results.monthlyData.length >= 12) {
    const orderMultipliers = results.monthlyData.map(m => m.actual);
    const revenueByMonth = {};
    Object.entries(byYearMonth).forEach(([key, data]) => {
      const month = parseInt(key.split('-')[1]);
      if (!revenueByMonth[month]) revenueByMonth[month] = { total: 0, count: 0 };
      revenueByMonth[month].total += data.revenue;
      revenueByMonth[month].count++;
    });

    const totalAvgMonthlyRev = Object.values(revenueByMonth).reduce((sum, m) =>
      sum + (m.total / m.count), 0) / Object.keys(revenueByMonth).length;

    const revenueMultipliers = [];
    for (let m = 1; m <= 12; m++) {
      const data = revenueByMonth[m];
      if (data) {
        revenueMultipliers.push((data.total / data.count) / totalAvgMonthlyRev);
      }
    }

    // Calculate Pearson correlation between order and revenue seasonality
    if (revenueMultipliers.length === 12 && orderMultipliers.length === 12) {
      const n = 12;
      const meanO = orderMultipliers.reduce((s, v) => s + v, 0) / n;
      const meanR = revenueMultipliers.reduce((s, v) => s + v, 0) / n;
      let num = 0, denO = 0, denR = 0;
      for (let i = 0; i < n; i++) {
        const dO = orderMultipliers[i] - meanO;
        const dR = revenueMultipliers[i] - meanR;
        num += dO * dR;
        denO += dO * dO;
        denR += dR * dR;
      }
      const correlation = denO > 0 && denR > 0 ? num / Math.sqrt(denO * denR) : 0;

      console.log(`  Order-Revenue correlation: ${correlation.toFixed(3)}`);

      if (correlation >= 0.85) {
        results.passed.push(`Order-Revenue seasonality correlation ${correlation.toFixed(3)} (strong positive)`);
      } else if (correlation >= 0.65) {
        results.warnings.push(`Order-Revenue seasonality correlation ${correlation.toFixed(3)} (moderate - expected strong)`);
      } else {
        results.failed.push({
          check: 'Order-Revenue seasonality correlation',
          expected: '>= 0.85',
          actual: correlation.toFixed(3)
        });
      }
    }
  }

  return results;
}

// ── Run and Output ────────────────────────────────────────────────────────────

const results = validate();

console.log('\n' + '='.repeat(60));
console.log('SEASONALITY VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`\nPASSED:   ${results.passed.length}`);
results.passed.forEach(p => console.log(`  [PASS] ${p}`));

if (results.warnings.length > 0) {
  console.log(`\nWARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(w => console.log(`  [WARN] ${typeof w === 'string' ? w : w.check || JSON.stringify(w)}`));
}

if (results.failed.length > 0) {
  console.log(`\nFAILED:   ${results.failed.length}`);
  results.failed.forEach(f => console.log(`  [FAIL] ${typeof f === 'string' ? f : f.check || JSON.stringify(f)}`));
}

// Write JSON results
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const outputPath = path.join(docsDir, 'seasonality-results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults written to: ${outputPath}`);

process.exit(results.failed.length > 0 ? 1 : 0);
