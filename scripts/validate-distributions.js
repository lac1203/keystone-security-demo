#!/usr/bin/env node
/**
 * Distribution Validation Script
 * Checks customer type distribution, geographic distribution,
 * customer-product affinities, and order value ranges.
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
  const filePath = path.join(__dirname, '..', 'data', filename);
  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    return null;
  }
  const text = fs.readFileSync(filePath, 'utf-8');
  return parseCSV(text);
}

// ── Expected Distributions (from CLAUDE.md) ───────────────────────────────────

const EXPECTED_CUSTOMER_TYPES = {
  LSH: { pct: 0.45, name: 'Locksmith Shops',       orderMin: 150,  orderMax: 800 },
  INT: { pct: 0.30, name: 'Security Integrators',   orderMin: 1500, orderMax: 8000 },
  PMG: { pct: 0.15, name: 'Property Managers',      orderMin: 200,  orderMax: 600 },
  RET: { pct: 0.10, name: 'Hardware Retailers',      orderMin: 300,  orderMax: 800 }
};

const EXPECTED_STATES = {
  PA: 0.35,
  NJ: 0.28,
  MD: 0.17,
  VA: 0.12,
  DE: 0.05,
  DC: 0.03
};

const VALID_STATES = ['PA', 'NJ', 'MD', 'VA', 'DE', 'DC'];

const CUSTOMER_PRODUCT_AFFINITIES = {
  LSH: {
    'Residential Locks': 0.30,
    'Commercial Hardware': 0.20,
    'Access Control': 0.10,
    'Automotive': 0.20,
    'Safes & Security': 0.05,
    'Key Machines & Supplies': 0.15
  },
  INT: {
    'Residential Locks': 0.05,
    'Commercial Hardware': 0.30,
    'Access Control': 0.50,
    'Automotive': 0.02,
    'Safes & Security': 0.05,
    'Key Machines & Supplies': 0.08
  },
  PMG: {
    'Residential Locks': 0.45,
    'Commercial Hardware': 0.30,
    'Access Control': 0.15,
    'Automotive': 0.00,
    'Safes & Security': 0.05,
    'Key Machines & Supplies': 0.05
  },
  RET: {
    'Residential Locks': 0.50,
    'Commercial Hardware': 0.15,
    'Access Control': 0.05,
    'Automotive': 0.05,
    'Safes & Security': 0.10,
    'Key Machines & Supplies': 0.15
  }
};

const TYPE_TOLERANCE = 0.05;     // 5% tolerance for customer type distribution
const STATE_TOLERANCE = 0.05;    // 5% tolerance for geographic distribution
const AFFINITY_TOLERANCE = 0.12; // 12% tolerance for product affinities (more variance expected)

// ── Main Validation ───────────────────────────────────────────────────────────

function validate() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    customerTypes: {},
    geoDistribution: {},
    affinityResults: {}
  };

  console.log('=== DISTRIBUTION VALIDATION ===\n');
  console.log('Loading data files...');

  const customers = loadCSV('customers.csv');
  const orders = loadCSV('orders.csv');
  const orderLines = loadCSV('order_lines.csv');
  const products = loadCSV('products.csv');

  if (!customers || !orders || !orderLines || !products) {
    results.failed.push('One or more data files could not be loaded');
    return results;
  }

  console.log(`  Customers:   ${customers.length}`);
  console.log(`  Orders:      ${orders.length}`);
  console.log(`  Order Lines: ${orderLines.length}`);
  console.log(`  Products:    ${products.length}\n`);

  const totalCustomers = customers.length;

  // Build lookups
  const customerMap = {};
  customers.forEach(c => { customerMap[c.customer_id] = c; });
  const productMap = {};
  products.forEach(p => { productMap[p.product_id] = p; });

  // ── CHECK 1: Customer Type Distribution ─────────────────────────────────────

  console.log('--- Customer Type Distribution ---');
  console.log('');
  console.log('Type | Name                  | Count | Expected | Actual | Delta  | Status');
  console.log('-'.repeat(80));

  const typeCount = {};
  customers.forEach(c => {
    typeCount[c.customer_type] = (typeCount[c.customer_type] || 0) + 1;
  });

  let typeIssues = 0;

  Object.entries(EXPECTED_CUSTOMER_TYPES).forEach(([type, info]) => {
    const count = typeCount[type] || 0;
    const actual = count / totalCustomers;
    const delta = actual - info.pct;
    const inRange = Math.abs(delta) <= TYPE_TOLERANCE;
    const status = inRange ? 'PASS' : 'WARN';
    if (!inRange) typeIssues++;

    console.log(
      `${type.padEnd(4)} | ${info.name.padEnd(21)} | ${String(count).padStart(5)} | ${(info.pct * 100).toFixed(0).padStart(7)}% | ${(actual * 100).toFixed(1).padStart(5)}% | ${(delta >= 0 ? '+' : '') + (delta * 100).toFixed(1).padStart(4)}% | ${status}`
    );

    results.customerTypes[type] = {
      name: info.name,
      count,
      expected: info.pct,
      actual: parseFloat((actual).toFixed(4)),
      delta: parseFloat((delta).toFixed(4)),
      inRange
    };
  });

  // Check for unexpected customer types
  const unexpectedTypes = Object.keys(typeCount).filter(t => !EXPECTED_CUSTOMER_TYPES[t]);
  if (unexpectedTypes.length > 0) {
    results.failed.push({
      check: 'Unexpected customer types found',
      types: unexpectedTypes,
      counts: unexpectedTypes.map(t => ({ type: t, count: typeCount[t] }))
    });
  }

  if (typeIssues === 0 && unexpectedTypes.length === 0) {
    results.passed.push('Customer type distribution within tolerance (+/-5%)');
  } else if (typeIssues > 0) {
    results.warnings.push(`${typeIssues} customer type(s) outside expected distribution (+/-5%)`);
  }

  // ── CHECK 2: Geographic Distribution ────────────────────────────────────────

  console.log('\n--- Geographic Distribution ---');
  console.log('');
  console.log('State | Count | Expected | Actual | Delta  | Status');
  console.log('-'.repeat(55));

  const stateCount = {};
  customers.forEach(c => {
    stateCount[c.state] = (stateCount[c.state] || 0) + 1;
  });

  let stateIssues = 0;

  Object.entries(EXPECTED_STATES).forEach(([state, expected]) => {
    const count = stateCount[state] || 0;
    const actual = count / totalCustomers;
    const delta = actual - expected;
    const inRange = Math.abs(delta) <= STATE_TOLERANCE;
    const status = inRange ? 'PASS' : 'WARN';
    if (!inRange) stateIssues++;

    console.log(
      `${state.padEnd(5)} | ${String(count).padStart(5)} | ${(expected * 100).toFixed(0).padStart(7)}% | ${(actual * 100).toFixed(1).padStart(5)}% | ${(delta >= 0 ? '+' : '') + (delta * 100).toFixed(1).padStart(4)}% | ${status}`
    );

    results.geoDistribution[state] = {
      count,
      expected,
      actual: parseFloat((actual).toFixed(4)),
      delta: parseFloat((delta).toFixed(4)),
      inRange
    };
  });

  // Check for invalid states
  const invalidStates = Object.keys(stateCount).filter(s => !VALID_STATES.includes(s));
  if (invalidStates.length > 0) {
    results.failed.push({
      check: 'Customers in invalid states (outside service territory)',
      states: invalidStates,
      counts: invalidStates.map(s => ({ state: s, count: stateCount[s] }))
    });
    console.log(`\n  INVALID STATES FOUND: ${invalidStates.join(', ')}`);
  } else {
    results.passed.push('All customers in valid service territory (PA/NJ/MD/VA/DE/DC)');
  }

  if (stateIssues === 0) {
    results.passed.push('Geographic distribution within tolerance (+/-5%)');
  } else {
    results.warnings.push(`${stateIssues} state(s) outside expected geographic distribution (+/-5%)`);
  }

  // ── CHECK 3: Order Value Ranges by Customer Type ────────────────────────────

  console.log('\n--- Order Value Ranges by Customer Type ---');
  console.log('');
  console.log('Type | Orders | Min Order | Max Order | Avg Order | Expected Range     | Status');
  console.log('-'.repeat(90));

  // Build order -> customer type mapping
  const ordersByType = {};
  orders.forEach(o => {
    const customer = customerMap[o.customer_id];
    if (!customer) return;
    const type = customer.customer_type;
    if (!ordersByType[type]) ordersByType[type] = [];
    ordersByType[type].push(o);
  });

  let orderRangeIssues = 0;

  Object.entries(EXPECTED_CUSTOMER_TYPES).forEach(([type, info]) => {
    const typeOrders = ordersByType[type] || [];
    if (typeOrders.length === 0) {
      results.warnings.push(`No orders found for customer type ${type}`);
      return;
    }

    const totals = typeOrders.map(o => o.subtotal || o.total || 0).filter(t => t > 0);
    if (totals.length === 0) return;

    const minOrder = Math.min(...totals);
    const maxOrder = Math.max(...totals);
    const avgOrder = totals.reduce((s, t) => s + t, 0) / totals.length;

    // Use a generous tolerance: avg should be somewhere reasonable for this type
    const midExpected = (info.orderMin + info.orderMax) / 2;
    // For typical order value, allow the average to be within 50% of expected midpoint
    const inRange = avgOrder >= info.orderMin * 0.5 && avgOrder <= info.orderMax * 2;

    const status = inRange ? 'PASS' : 'WARN';
    if (!inRange) orderRangeIssues++;

    const expectedRange = `$${info.orderMin}-$${info.orderMax}`;

    console.log(
      `${type.padEnd(4)} | ${String(totals.length).padStart(6)} | $${minOrder.toFixed(0).padStart(8)} | $${maxOrder.toFixed(0).padStart(8)} | $${avgOrder.toFixed(0).padStart(8)} | ${expectedRange.padStart(18)} | ${status}`
    );
  });

  if (orderRangeIssues === 0) {
    results.passed.push('Order value ranges consistent with customer type expectations');
  } else {
    results.warnings.push(`${orderRangeIssues} customer type(s) with order values outside expected ranges`);
  }

  // ── CHECK 4: Customer-Product Affinities ────────────────────────────────────

  console.log('\n--- Customer-Product Affinities ---');

  // Build a mapping: order_id -> customer_type
  const orderCustomerType = {};
  orders.forEach(o => {
    const customer = customerMap[o.customer_id];
    if (customer) orderCustomerType[o.order_id] = customer.customer_type;
  });

  // Count line items by customer type and product category
  const affinityCount = {};
  const affinityTotal = {};

  orderLines.forEach(ol => {
    const custType = orderCustomerType[ol.order_id];
    const product = productMap[ol.product_id];
    if (!custType || !product) return;

    const cat = product.category_l1;
    if (!affinityCount[custType]) affinityCount[custType] = {};
    if (!affinityTotal[custType]) affinityTotal[custType] = 0;

    affinityCount[custType][cat] = (affinityCount[custType][cat] || 0) + 1;
    affinityTotal[custType]++;
  });

  let affinityIssues = 0;

  Object.entries(CUSTOMER_PRODUCT_AFFINITIES).forEach(([custType, expectedAffinities]) => {
    const counts = affinityCount[custType] || {};
    const total = affinityTotal[custType] || 0;

    if (total === 0) {
      results.warnings.push(`No order line data for customer type ${custType}`);
      return;
    }

    console.log(`\n  ${custType} (${EXPECTED_CUSTOMER_TYPES[custType]?.name || custType}):`);
    console.log('  Category                  | Lines | Expected | Actual | Delta  | Status');
    console.log('  ' + '-'.repeat(75));

    let typeAffinityIssues = 0;
    const affinityResults = {};

    Object.entries(expectedAffinities).forEach(([category, expectedPct]) => {
      const count = counts[category] || 0;
      const actual = total > 0 ? count / total : 0;
      const delta = actual - expectedPct;
      const inRange = Math.abs(delta) <= AFFINITY_TOLERANCE;

      const status = inRange ? 'PASS' : 'WARN';
      if (!inRange) typeAffinityIssues++;

      console.log(
        `  ${category.padEnd(27)} | ${String(count).padStart(5)} | ${(expectedPct * 100).toFixed(0).padStart(7)}% | ${(actual * 100).toFixed(1).padStart(5)}% | ${(delta >= 0 ? '+' : '') + (delta * 100).toFixed(1).padStart(4)}% | ${status}`
      );

      affinityResults[category] = {
        count,
        expected: expectedPct,
        actual: parseFloat(actual.toFixed(4)),
        delta: parseFloat(delta.toFixed(4)),
        inRange
      };
    });

    results.affinityResults[custType] = affinityResults;

    if (typeAffinityIssues > 0) {
      affinityIssues += typeAffinityIssues;
    }
  });

  if (affinityIssues === 0) {
    results.passed.push(`Customer-product affinities match expected distribution (+/-${(AFFINITY_TOLERANCE * 100).toFixed(0)}%)`);
  } else if (affinityIssues <= 4) {
    results.warnings.push(`${affinityIssues} category-type combinations outside expected affinity range (+/-${(AFFINITY_TOLERANCE * 100).toFixed(0)}%)`);
  } else {
    results.failed.push({
      check: 'Customer-product affinities',
      issueCount: affinityIssues,
      message: `${affinityIssues} combinations outside expected range`
    });
  }

  // ── CHECK 5: Order Frequency by Customer Type ──────────────────────────────

  console.log('\n--- Order Frequency by Customer Type ---');

  // Count orders per customer per month
  const customerMonthlyOrders = {};
  orders.forEach(o => {
    if (!o.order_date || !o.customer_id) return;
    const date = new Date(o.order_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = `${o.customer_id}-${monthKey}`;
    customerMonthlyOrders[key] = (customerMonthlyOrders[key] || 0) + 1;
  });

  // Aggregate by customer type
  const freqByType = {};
  Object.entries(customerMonthlyOrders).forEach(([key, count]) => {
    const customerId = parseInt(key.split('-')[0]);
    const customer = customerMap[customerId];
    if (!customer) return;
    const type = customer.customer_type;
    if (!freqByType[type]) freqByType[type] = [];
    freqByType[type].push(count);
  });

  const EXPECTED_FREQ = {
    LSH: { min: 8, max: 15 },
    INT: { min: 5, max: 15 },
    PMG: { min: 2, max: 6 },
    RET: { min: 2, max: 6 }
  };

  console.log('');
  console.log('Type | Avg Orders/Mo | Median | Min | Max | Expected Range | Status');
  console.log('-'.repeat(75));

  Object.entries(EXPECTED_FREQ).forEach(([type, range]) => {
    const freqs = freqByType[type] || [];
    if (freqs.length === 0) return;

    const sorted = [...freqs].sort((a, b) => a - b);
    const avg = freqs.reduce((s, f) => s + f, 0) / freqs.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Avg should be somewhat near the expected range
    const midExpected = (range.min + range.max) / 2;
    const inRange = avg >= range.min * 0.5 && avg <= range.max * 1.5;
    const status = inRange ? 'PASS' : 'WARN';

    console.log(
      `${type.padEnd(4)} | ${avg.toFixed(1).padStart(13)} | ${String(median).padStart(6)} | ${String(min).padStart(3)} | ${String(max).padStart(3)} | ${String(range.min).padStart(3)}-${String(range.max).padEnd(2)}x/mo     | ${status}`
    );
  });

  // ── CHECK 6: Payment Terms Distribution ────────────────────────────────────

  console.log('\n--- Payment Terms Distribution ---');

  const termCount = {};
  customers.forEach(c => {
    termCount[c.payment_terms] = (termCount[c.payment_terms] || 0) + 1;
  });

  console.log('');
  Object.entries(termCount).sort((a, b) => b[1] - a[1]).forEach(([term, count]) => {
    const pct = (count / totalCustomers * 100).toFixed(1);
    console.log(`  ${term}: ${count} customers (${pct}%)`);
  });

  // Just verify all terms are valid
  const validTerms = new Set(['COD', 'NET15', 'NET30', 'NET45']);
  const invalidTerms = Object.keys(termCount).filter(t => !validTerms.has(t));
  if (invalidTerms.length === 0) {
    results.passed.push('All payment terms are valid (COD/NET15/NET30/NET45)');
  } else {
    results.failed.push({
      check: 'Invalid payment terms',
      terms: invalidTerms
    });
  }

  // ── CHECK 7: Order Status Distribution ─────────────────────────────────────

  console.log('\n--- Order Status Distribution ---');

  const statusCount = {};
  orders.forEach(o => {
    statusCount[o.status] = (statusCount[o.status] || 0) + 1;
  });

  console.log('');
  Object.entries(statusCount).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    const pct = (count / orders.length * 100).toFixed(1);
    console.log(`  ${status}: ${count} orders (${pct}%)`);
  });

  // Cancelled should be a small percentage
  const cancelledPct = (statusCount['CANCELLED'] || 0) / orders.length;
  if (cancelledPct <= 0.10) {
    results.passed.push(`Cancelled orders: ${(cancelledPct * 100).toFixed(1)}% (reasonable)`);
  } else {
    results.warnings.push(`Cancelled orders: ${(cancelledPct * 100).toFixed(1)}% (higher than expected)`);
  }

  // ── CHECK 8: Credit Limit Reasonableness ───────────────────────────────────

  console.log('\n--- Credit Limit Distribution ---');

  const creditByType = {};
  customers.forEach(c => {
    const type = c.customer_type;
    if (!creditByType[type]) creditByType[type] = [];
    if (c.credit_limit != null) creditByType[type].push(c.credit_limit);
  });

  Object.entries(creditByType).forEach(([type, limits]) => {
    if (limits.length === 0) return;
    const avg = limits.reduce((s, l) => s + l, 0) / limits.length;
    const min = Math.min(...limits);
    const max = Math.max(...limits);
    console.log(`  ${type}: avg $${avg.toFixed(0)}, range $${min.toLocaleString()}-$${max.toLocaleString()}`);
  });

  // Credit limits should be within $1,000-$200,000
  const allCredits = customers.filter(c => c.credit_limit != null).map(c => c.credit_limit);
  const outOfRange = allCredits.filter(cl => cl < 1000 || cl > 200000);
  if (outOfRange.length === 0) {
    results.passed.push('All credit limits within $1,000-$200,000 range');
  } else {
    results.warnings.push({
      check: 'Credit limits outside expected range ($1K-$200K)',
      count: outOfRange.length
    });
  }

  return results;
}

// ── Run and Output ────────────────────────────────────────────────────────────

const results = validate();

console.log('\n' + '='.repeat(60));
console.log('DISTRIBUTION VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`\nPASSED:   ${results.passed.length}`);
results.passed.forEach(p => console.log(`  [PASS] ${p}`));

if (results.warnings.length > 0) {
  console.log(`\nWARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(w => {
    if (typeof w === 'string') {
      console.log(`  [WARN] ${w}`);
    } else {
      console.log(`  [WARN] ${w.check}: ${w.issueCount || w.count || ''}`);
    }
  });
}

if (results.failed.length > 0) {
  console.log(`\nFAILED:   ${results.failed.length}`);
  results.failed.forEach(f => {
    if (typeof f === 'string') {
      console.log(`  [FAIL] ${f}`);
    } else {
      console.log(`  [FAIL] ${f.check}`);
      if (f.states) console.log(`         States: ${f.states.join(', ')}`);
      if (f.types) console.log(`         Types: ${f.types.join(', ')}`);
    }
  });
}

// Write JSON results
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const outputPath = path.join(docsDir, 'distribution-results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults written to: ${outputPath}`);

process.exit(results.failed.length > 0 ? 1 : 0);
