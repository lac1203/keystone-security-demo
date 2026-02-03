#!/usr/bin/env node
/**
 * Margin Validation Script
 * Checks that product margins fall within category guidelines,
 * validates price >= cost, MSRP >= price, and overall margin health.
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

// ── Margin Rules by Category (from CLAUDE.md) ────────────────────────────────

const MARGIN_RULES = {
  'Residential Locks':      { min: 0.25, max: 0.35, target: 0.30 },
  'Commercial Hardware':    { min: 0.32, max: 0.42, target: 0.375 },
  'Access Control':         { min: 0.32, max: 0.52, target: 0.425 },
  'Automotive':             { min: 0.38, max: 0.48, target: 0.425 },
  'Safes & Security':       { min: 0.35, max: 0.45, target: 0.40 },
  'Key Machines & Supplies': { min: 0.18, max: 0.58, target: 0.375 },
};

// Global absolute margin bounds from CLAUDE.md
const GLOBAL_MARGIN_MIN = 0.15;
const GLOBAL_MARGIN_MAX = 0.60;

// ── Main Validation ───────────────────────────────────────────────────────────

function validate() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    summary: {}
  };

  console.log('=== MARGIN VALIDATION ===\n');
  console.log('Loading products.csv...');

  const products = loadCSV('products.csv');
  if (!products) {
    results.failed.push('Could not load products.csv');
    return results;
  }

  console.log(`  Loaded ${products.length} products\n`);

  // ── CHECK 1: Global margin bounds (15% - 60%) ──────────────────────────────

  console.log('--- Global Margin Bounds ---');

  const globalViolations = products.filter(p => {
    if (p.price == null || p.cost == null || p.price === 0) return false;
    const margin = (p.price - p.cost) / p.price;
    return margin < GLOBAL_MARGIN_MIN || margin > GLOBAL_MARGIN_MAX;
  });

  if (globalViolations.length === 0) {
    results.passed.push(`All products within global margin bounds (${(GLOBAL_MARGIN_MIN * 100).toFixed(0)}%-${(GLOBAL_MARGIN_MAX * 100).toFixed(0)}%)`);
    console.log(`  Global bounds [${(GLOBAL_MARGIN_MIN * 100).toFixed(0)}%-${(GLOBAL_MARGIN_MAX * 100).toFixed(0)}%]: PASS`);
  } else {
    results.failed.push({
      check: 'Global margin bounds violation',
      count: globalViolations.length,
      samples: globalViolations.slice(0, 5).map(p => ({
        sku: p.sku,
        cost: p.cost,
        price: p.price,
        margin: ((p.price - p.cost) / p.price * 100).toFixed(1) + '%'
      }))
    });
    console.log(`  Global bounds: FAIL (${globalViolations.length} violations)`);
  }

  // ── CHECK 2: price >= cost (no negative margins) ───────────────────────────

  console.log('\n--- Price >= Cost ---');

  const negativeMargins = products.filter(p => {
    if (p.price == null || p.cost == null) return false;
    return p.price < p.cost;
  });

  if (negativeMargins.length === 0) {
    results.passed.push('All products have price >= cost (no negative margins)');
    console.log('  price >= cost: PASS');
  } else {
    results.failed.push({
      check: 'Negative margins (price < cost)',
      count: negativeMargins.length,
      samples: negativeMargins.slice(0, 5).map(p => ({
        sku: p.sku,
        cost: p.cost,
        price: p.price,
        deficit: (p.cost - p.price).toFixed(2)
      }))
    });
    console.log(`  price >= cost: FAIL (${negativeMargins.length} products with negative margin)`);
  }

  // ── CHECK 3: MSRP >= price ─────────────────────────────────────────────────

  console.log('\n--- MSRP >= Price ---');

  const invalidMsrp = products.filter(p => {
    if (p.msrp == null || p.price == null) return false;
    return p.msrp < p.price;
  });

  if (invalidMsrp.length === 0) {
    results.passed.push('All products have MSRP >= price');
    console.log('  MSRP >= price: PASS');
  } else {
    results.warnings.push({
      check: 'MSRP below wholesale price',
      count: invalidMsrp.length,
      samples: invalidMsrp.slice(0, 5).map(p => ({
        sku: p.sku,
        price: p.price,
        msrp: p.msrp
      }))
    });
    console.log(`  MSRP >= price: WARN (${invalidMsrp.length} products)`);
  }

  // ── CHECK 4: Category-level margin validation ──────────────────────────────

  console.log('\n--- Category Margin Validation ---');
  console.log('');
  console.log('Category                  | Count | Avg Margin | Target  | Range       | OOB | Status');
  console.log('-'.repeat(95));

  const byCategory = {};
  products.forEach(p => {
    const cat = p.category_l1;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  let categoryIssues = 0;

  Object.entries(byCategory).forEach(([category, prods]) => {
    const rules = MARGIN_RULES[category];

    const margins = prods
      .filter(p => p.price != null && p.cost != null && p.price > 0)
      .map(p => ({
        sku: p.sku,
        name: p.name,
        margin: (p.price - p.cost) / p.price
      }));

    if (margins.length === 0) {
      results.warnings.push(`No valid margin data for category: ${category}`);
      return;
    }

    const avgMargin = margins.reduce((sum, m) => sum + m.margin, 0) / margins.length;
    const minMargin = Math.min(...margins.map(m => m.margin));
    const maxMargin = Math.max(...margins.map(m => m.margin));

    if (!rules) {
      results.warnings.push(`No margin rules defined for category: ${category}`);
      const catPad = category.padEnd(25);
      console.log(`${catPad} | ${String(prods.length).padStart(5)} | ${(avgMargin * 100).toFixed(1).padStart(9)}% |    N/A  | ${(minMargin * 100).toFixed(1)}%-${(maxMargin * 100).toFixed(1)}% |  -- | N/A`);
      results.summary[category] = {
        count: prods.length,
        avgMargin: (avgMargin * 100).toFixed(1) + '%',
        target: 'N/A',
        outOfBounds: 0,
        status: 'NO_RULES'
      };
      return;
    }

    const outOfBounds = margins.filter(m => m.margin < rules.min || m.margin > rules.max);

    const catPad = category.padEnd(25);
    const rangeStr = `${(rules.min * 100).toFixed(0)}%-${(rules.max * 100).toFixed(0)}%`;
    const status = outOfBounds.length === 0 ? 'PASS' : 'WARN';
    if (outOfBounds.length > 0) categoryIssues++;

    console.log(`${catPad} | ${String(prods.length).padStart(5)} | ${(avgMargin * 100).toFixed(1).padStart(9)}% | ${(rules.target * 100).toFixed(1).padStart(5)}%  | ${rangeStr.padStart(11)} | ${String(outOfBounds.length).padStart(3)} | ${status}`);

    results.summary[category] = {
      count: prods.length,
      avgMargin: (avgMargin * 100).toFixed(1) + '%',
      target: (rules.target * 100).toFixed(1) + '%',
      minMargin: (minMargin * 100).toFixed(1) + '%',
      maxMargin: (maxMargin * 100).toFixed(1) + '%',
      outOfBounds: outOfBounds.length,
      status
    };

    if (outOfBounds.length === 0) {
      results.passed.push(`${category}: All ${prods.length} products within margin bounds (${rangeStr})`);
    } else {
      results.warnings.push({
        check: `${category} margin bounds`,
        rule: rangeStr,
        violations: outOfBounds.length,
        total: prods.length,
        samples: outOfBounds.slice(0, 5).map(m => ({
          sku: m.sku,
          margin: (m.margin * 100).toFixed(1) + '%',
          bounds: rangeStr
        }))
      });
    }
  });

  if (categoryIssues === 0) {
    results.passed.push('All categories within their margin bounds');
  }

  // ── CHECK 5: Cost-to-Price Ratio validation ────────────────────────────────

  console.log('\n--- Cost-to-Price Ratio ---');

  const COST_TO_PRICE_RULES = {
    'Residential Locks':       { min: 0.65, max: 0.75 },
    'Commercial Hardware':     { min: 0.58, max: 0.68 },
    'Access Control':          { min: 0.48, max: 0.68 },
    'Automotive':              { min: 0.52, max: 0.62 },
    'Safes & Security':        { min: 0.55, max: 0.65 },
    'Key Machines & Supplies': { min: 0.42, max: 0.82 },
  };

  Object.entries(byCategory).forEach(([category, prods]) => {
    const rules = COST_TO_PRICE_RULES[category];
    if (!rules) return;

    const ratios = prods
      .filter(p => p.price != null && p.cost != null && p.price > 0)
      .map(p => p.cost / p.price);

    if (ratios.length === 0) return;

    const avgRatio = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    const inRange = avgRatio >= rules.min && avgRatio <= rules.max;

    if (inRange) {
      console.log(`  ${category}: avg C/P ratio ${avgRatio.toFixed(3)} [${rules.min}-${rules.max}] PASS`);
    } else {
      console.log(`  ${category}: avg C/P ratio ${avgRatio.toFixed(3)} [${rules.min}-${rules.max}] WARN`);
      results.warnings.push(`${category} avg cost-to-price ratio ${avgRatio.toFixed(3)} outside expected range [${rules.min}-${rules.max}]`);
    }
  });

  // ── CHECK 6: Margin distribution health ────────────────────────────────────

  console.log('\n--- Overall Margin Distribution ---');

  const allMargins = products
    .filter(p => p.price != null && p.cost != null && p.price > 0)
    .map(p => (p.price - p.cost) / p.price);

  if (allMargins.length > 0) {
    const sorted = [...allMargins].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.05)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avg = allMargins.reduce((s, m) => s + m, 0) / allMargins.length;

    console.log(`  Total products analyzed: ${allMargins.length}`);
    console.log(`  Mean margin:   ${(avg * 100).toFixed(1)}%`);
    console.log(`  P5:            ${(p5 * 100).toFixed(1)}%`);
    console.log(`  P25 (Q1):      ${(p25 * 100).toFixed(1)}%`);
    console.log(`  P50 (Median):  ${(p50 * 100).toFixed(1)}%`);
    console.log(`  P75 (Q3):      ${(p75 * 100).toFixed(1)}%`);
    console.log(`  P95:           ${(p95 * 100).toFixed(1)}%`);

    results.summary._overall = {
      count: allMargins.length,
      mean: (avg * 100).toFixed(1) + '%',
      p5: (p5 * 100).toFixed(1) + '%',
      p25: (p25 * 100).toFixed(1) + '%',
      median: (p50 * 100).toFixed(1) + '%',
      p75: (p75 * 100).toFixed(1) + '%',
      p95: (p95 * 100).toFixed(1) + '%'
    };

    // Overall avg margin should be in a healthy range for a distributor (~30-45%)
    if (avg >= 0.28 && avg <= 0.48) {
      results.passed.push(`Overall average margin ${(avg * 100).toFixed(1)}% is healthy for a distributor`);
    } else {
      results.warnings.push(`Overall average margin ${(avg * 100).toFixed(1)}% may be outside normal distributor range (28-48%)`);
    }
  }

  return results;
}

// ── Run and Output ────────────────────────────────────────────────────────────

const results = validate();

console.log('\n' + '='.repeat(60));
console.log('MARGIN VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`\nPASSED:   ${results.passed.length}`);
results.passed.forEach(p => console.log(`  [PASS] ${p}`));

if (results.warnings.length > 0) {
  console.log(`\nWARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(w => {
    if (typeof w === 'string') {
      console.log(`  [WARN] ${w}`);
    } else {
      console.log(`  [WARN] ${w.check}: ${w.violations}/${w.total} products outside ${w.rule}`);
      if (w.samples) {
        w.samples.slice(0, 3).forEach(s => console.log(`         Sample: ${JSON.stringify(s)}`));
      }
    }
  });
}

if (results.failed.length > 0) {
  console.log(`\nFAILED:   ${results.failed.length}`);
  results.failed.forEach(f => {
    if (typeof f === 'string') {
      console.log(`  [FAIL] ${f}`);
    } else {
      console.log(`  [FAIL] ${f.check}: ${f.count} violations`);
      if (f.samples) {
        f.samples.slice(0, 3).forEach(s => console.log(`         Sample: ${JSON.stringify(s)}`));
      }
    }
  });
}

// Write JSON results
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const outputPath = path.join(docsDir, 'margin-results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults written to: ${outputPath}`);

process.exit(results.failed.length > 0 ? 1 : 0);
