#!/usr/bin/env node
/**
 * Data Integrity Validation Script
 * Checks referential integrity, duplicate keys, null required fields,
 * date sequencing, and calculation accuracy across all data files.
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
      // Dynamic typing
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

// ── Main Validation ───────────────────────────────────────────────────────────

function validate() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
    stats: {}
  };

  console.log('=== DATA INTEGRITY VALIDATION ===\n');
  console.log('Loading data files...');

  const products = loadCSV('products.csv');
  const customers = loadCSV('customers.csv');
  const orders = loadCSV('orders.csv');
  const orderLines = loadCSV('order_lines.csv');

  // Check all files loaded
  if (!products || !customers || !orders || !orderLines) {
    results.failed.push('One or more data files could not be loaded');
    return results;
  }

  console.log(`  Products:    ${products.length} rows`);
  console.log(`  Customers:   ${customers.length} rows`);
  console.log(`  Orders:      ${orders.length} rows`);
  console.log(`  Order Lines: ${orderLines.length} rows`);

  results.stats = {
    products: products.length,
    customers: customers.length,
    orders: orders.length,
    orderLines: orderLines.length
  };

  // ── Build lookup sets ───────────────────────────────────────────────────────

  const productIds = new Set(products.map(p => p.product_id));
  const customerIds = new Set(customers.map(c => c.customer_id));
  const orderIds = new Set(orders.map(o => o.order_id));

  // ── CHECK 1: Volume Targets ─────────────────────────────────────────────────

  console.log('\n--- Volume Targets ---');

  if (products.length >= 200) {
    results.passed.push(`Products: ${products.length} (target: 200+)`);
  } else {
    results.failed.push({ check: 'Product count', expected: '200+', actual: products.length });
  }

  if (customers.length === 150) {
    results.passed.push(`Customers: ${customers.length} (target: 150)`);
  } else if (customers.length >= 145 && customers.length <= 155) {
    results.warnings.push(`Customers: ${customers.length} (target: 150, within tolerance)`);
  } else {
    results.failed.push({ check: 'Customer count', expected: 150, actual: customers.length });
  }

  if (orders.length >= 7500 && orders.length <= 8300) {
    results.passed.push(`Orders: ${orders.length} (target: ~7,904)`);
  } else {
    results.warnings.push(`Orders: ${orders.length} (target: ~7,904)`);
  }

  if (orderLines.length >= 33000 && orderLines.length <= 38000) {
    results.passed.push(`Order Lines: ${orderLines.length} (target: ~35,568)`);
  } else {
    results.warnings.push(`Order Lines: ${orderLines.length} (target: ~35,568)`);
  }

  // Avg lines per order
  const avgLinesPerOrder = orderLines.length / orders.length;
  console.log(`  Avg lines/order: ${avgLinesPerOrder.toFixed(2)} (target: ~4.5)`);
  if (avgLinesPerOrder >= 3.5 && avgLinesPerOrder <= 5.5) {
    results.passed.push(`Avg lines/order: ${avgLinesPerOrder.toFixed(2)} (target: ~4.5)`);
  } else {
    results.warnings.push(`Avg lines/order: ${avgLinesPerOrder.toFixed(2)} (target: ~4.5)`);
  }

  // ── CHECK 2: Referential Integrity ──────────────────────────────────────────

  console.log('\n--- Referential Integrity ---');

  // orders.customer_id -> customers
  const orphanedOrders = orders.filter(o => !customerIds.has(o.customer_id));
  if (orphanedOrders.length === 0) {
    results.passed.push('All orders reference valid customers');
    console.log('  orders.customer_id -> customers: PASS');
  } else {
    results.failed.push({
      check: 'orders.customer_id -> customers',
      count: orphanedOrders.length,
      samples: orphanedOrders.slice(0, 5).map(o => ({ order_id: o.order_id, customer_id: o.customer_id }))
    });
    console.log(`  orders.customer_id -> customers: FAIL (${orphanedOrders.length} orphaned)`);
  }

  // order_lines.order_id -> orders
  const orphanedLines = orderLines.filter(ol => !orderIds.has(ol.order_id));
  if (orphanedLines.length === 0) {
    results.passed.push('All order lines reference valid orders');
    console.log('  order_lines.order_id -> orders: PASS');
  } else {
    results.failed.push({
      check: 'order_lines.order_id -> orders',
      count: orphanedLines.length,
      samples: orphanedLines.slice(0, 5).map(ol => ({ line_id: ol.line_id, order_id: ol.order_id }))
    });
    console.log(`  order_lines.order_id -> orders: FAIL (${orphanedLines.length} orphaned)`);
  }

  // order_lines.product_id -> products
  const invalidProducts = orderLines.filter(ol => !productIds.has(ol.product_id));
  if (invalidProducts.length === 0) {
    results.passed.push('All order lines reference valid products');
    console.log('  order_lines.product_id -> products: PASS');
  } else {
    results.failed.push({
      check: 'order_lines.product_id -> products',
      count: invalidProducts.length,
      samples: invalidProducts.slice(0, 5).map(ol => ({ line_id: ol.line_id, product_id: ol.product_id }))
    });
    console.log(`  order_lines.product_id -> products: FAIL (${invalidProducts.length} orphaned)`);
  }

  // ── CHECK 3: Duplicate Primary Keys ─────────────────────────────────────────

  console.log('\n--- Duplicate Key Checks ---');

  function checkDuplicates(data, keyField, tableName) {
    const seen = new Set();
    const duplicates = [];
    data.forEach(row => {
      const val = row[keyField];
      if (seen.has(val)) {
        duplicates.push(val);
      }
      seen.add(val);
    });
    return { tableName, keyField, duplicates };
  }

  const dupChecks = [
    checkDuplicates(products, 'product_id', 'products'),
    checkDuplicates(products, 'sku', 'products'),
    checkDuplicates(customers, 'customer_id', 'customers'),
    checkDuplicates(customers, 'account_number', 'customers'),
    checkDuplicates(orders, 'order_id', 'orders'),
    checkDuplicates(orders, 'order_number', 'orders'),
    checkDuplicates(orderLines, 'line_id', 'order_lines'),
  ];

  dupChecks.forEach(check => {
    if (check.duplicates.length === 0) {
      results.passed.push(`No duplicate ${check.keyField} in ${check.tableName}`);
      console.log(`  ${check.tableName}.${check.keyField}: PASS`);
    } else {
      results.failed.push({
        check: `Duplicate ${check.keyField} in ${check.tableName}`,
        count: check.duplicates.length,
        samples: check.duplicates.slice(0, 5)
      });
      console.log(`  ${check.tableName}.${check.keyField}: FAIL (${check.duplicates.length} duplicates)`);
    }
  });

  // ── CHECK 4: Required Fields Not Null ───────────────────────────────────────

  console.log('\n--- Required Field Checks ---');

  const requiredFields = {
    products: ['product_id', 'sku', 'name', 'manufacturer', 'cost', 'price'],
    customers: ['customer_id', 'account_number', 'company_name', 'customer_type', 'city', 'state'],
    orders: ['order_id', 'order_number', 'customer_id', 'order_date', 'total'],
    order_lines: ['line_id', 'order_id', 'product_id', 'quantity', 'unit_price', 'line_total']
  };

  function checkNulls(data, fields, tableName) {
    const issues = [];
    data.forEach((row, idx) => {
      fields.forEach(field => {
        if (row[field] === null || row[field] === undefined || row[field] === '') {
          issues.push({ row: idx + 1, field, value: row[field] });
        }
      });
    });
    return { tableName, issues };
  }

  const datasets = {
    products: products,
    customers: customers,
    orders: orders,
    order_lines: orderLines
  };

  Object.entries(requiredFields).forEach(([table, fields]) => {
    const result = checkNulls(datasets[table], fields, table);
    if (result.issues.length === 0) {
      results.passed.push(`All required fields populated in ${table}`);
      console.log(`  ${table}: PASS`);
    } else {
      results.failed.push({
        check: `Null required fields in ${table}`,
        count: result.issues.length,
        samples: result.issues.slice(0, 5)
      });
      console.log(`  ${table}: FAIL (${result.issues.length} null values)`);
    }
  });

  // ── CHECK 5: Date Sequencing ────────────────────────────────────────────────

  console.log('\n--- Date Sequencing ---');

  // ship_date >= order_date
  const dateIssues = orders.filter(o => {
    if (!o.order_date || !o.ship_date) return false;
    return new Date(o.ship_date) < new Date(o.order_date);
  });
  if (dateIssues.length === 0) {
    results.passed.push('All ship_dates >= order_dates');
    console.log('  ship_date >= order_date: PASS');
  } else {
    results.failed.push({
      check: 'ship_date before order_date',
      count: dateIssues.length,
      samples: dateIssues.slice(0, 5).map(o => ({
        order_id: o.order_id,
        order_date: o.order_date,
        ship_date: o.ship_date
      }))
    });
    console.log(`  ship_date >= order_date: FAIL (${dateIssues.length} violations)`);
  }

  // order_date range check (2023-01-01 to 2025-12-31)
  const dateRangeIssues = orders.filter(o => {
    if (!o.order_date) return false;
    const d = new Date(o.order_date);
    return d < new Date('2023-01-01') || d > new Date('2025-12-31');
  });
  if (dateRangeIssues.length === 0) {
    results.passed.push('All order dates within 2023-2025 range');
    console.log('  order_date range [2023-2025]: PASS');
  } else {
    results.failed.push({
      check: 'Order dates outside 2023-2025 range',
      count: dateRangeIssues.length,
      samples: dateRangeIssues.slice(0, 5).map(o => ({ order_id: o.order_id, order_date: o.order_date }))
    });
    console.log(`  order_date range [2023-2025]: FAIL (${dateRangeIssues.length} out of range)`);
  }

  // ── CHECK 6: Calculation Accuracy ───────────────────────────────────────────

  console.log('\n--- Calculation Accuracy ---');

  // line_total = quantity * unit_price (with rounding tolerance)
  const TOLERANCE = 0.02; // 2 cents tolerance for rounding
  const lineCalcIssues = orderLines.filter(ol => {
    if (ol.quantity == null || ol.unit_price == null || ol.line_total == null) return false;
    const expected = ol.quantity * ol.unit_price;
    return Math.abs(ol.line_total - expected) > TOLERANCE;
  });
  if (lineCalcIssues.length === 0) {
    results.passed.push('All line totals match quantity * unit_price');
    console.log('  line_total = qty * unit_price: PASS');
  } else {
    results.failed.push({
      check: 'line_total != quantity * unit_price',
      count: lineCalcIssues.length,
      samples: lineCalcIssues.slice(0, 5).map(ol => ({
        line_id: ol.line_id,
        expected: (ol.quantity * ol.unit_price).toFixed(2),
        actual: ol.line_total
      }))
    });
    console.log(`  line_total = qty * unit_price: FAIL (${lineCalcIssues.length} mismatches)`);
  }

  // line_cost = quantity * unit_cost
  const lineCostIssues = orderLines.filter(ol => {
    if (ol.quantity == null || ol.unit_cost == null || ol.line_cost == null) return false;
    const expected = ol.quantity * ol.unit_cost;
    return Math.abs(ol.line_cost - expected) > TOLERANCE;
  });
  if (lineCostIssues.length === 0) {
    results.passed.push('All line costs match quantity * unit_cost');
    console.log('  line_cost = qty * unit_cost: PASS');
  } else {
    results.failed.push({
      check: 'line_cost != quantity * unit_cost',
      count: lineCostIssues.length,
      samples: lineCostIssues.slice(0, 5).map(ol => ({
        line_id: ol.line_id,
        expected: (ol.quantity * ol.unit_cost).toFixed(2),
        actual: ol.line_cost
      }))
    });
    console.log(`  line_cost = qty * unit_cost: FAIL (${lineCostIssues.length} mismatches)`);
  }

  // order total = subtotal + tax + freight (with rounding tolerance)
  const ORDER_TOLERANCE = 0.05;
  const orderCalcIssues = orders.filter(o => {
    if (o.subtotal == null || o.tax == null || o.freight == null || o.total == null) return false;
    const expected = o.subtotal + o.tax + o.freight;
    return Math.abs(o.total - expected) > ORDER_TOLERANCE;
  });
  if (orderCalcIssues.length === 0) {
    results.passed.push('All order totals match subtotal + tax + freight');
    console.log('  total = subtotal + tax + freight: PASS');
  } else {
    results.failed.push({
      check: 'total != subtotal + tax + freight',
      count: orderCalcIssues.length,
      samples: orderCalcIssues.slice(0, 5).map(o => ({
        order_id: o.order_id,
        expected: (o.subtotal + o.tax + o.freight).toFixed(2),
        actual: o.total
      }))
    });
    console.log(`  total = subtotal + tax + freight: FAIL (${orderCalcIssues.length} mismatches)`);
  }

  // ── CHECK 7: Order subtotals vs order_lines aggregation ─────────────────────

  console.log('\n--- Subtotal Aggregation ---');

  // Build order_id -> sum of line_totals
  const lineSubtotals = {};
  const lineCostTotals = {};
  orderLines.forEach(ol => {
    if (!lineSubtotals[ol.order_id]) lineSubtotals[ol.order_id] = 0;
    if (!lineCostTotals[ol.order_id]) lineCostTotals[ol.order_id] = 0;
    lineSubtotals[ol.order_id] += ol.line_total || 0;
    lineCostTotals[ol.order_id] += ol.line_cost || 0;
  });

  const AGG_TOLERANCE = 0.10; // 10 cents for cumulative rounding
  const subtotalMismatches = orders.filter(o => {
    const lineSum = lineSubtotals[o.order_id];
    if (lineSum === undefined || o.subtotal == null) return false;
    return Math.abs(o.subtotal - lineSum) > AGG_TOLERANCE;
  });

  if (subtotalMismatches.length === 0) {
    results.passed.push('Order subtotals match sum of line totals');
    console.log('  order.subtotal = SUM(line_total): PASS');
  } else {
    results.warnings.push({
      check: 'Order subtotal mismatch with line totals',
      count: subtotalMismatches.length,
      samples: subtotalMismatches.slice(0, 5).map(o => ({
        order_id: o.order_id,
        order_subtotal: o.subtotal,
        line_sum: (lineSubtotals[o.order_id] || 0).toFixed(2)
      }))
    });
    console.log(`  order.subtotal = SUM(line_total): WARN (${subtotalMismatches.length} mismatches)`);
  }

  // ── CHECK 8: Field Format Checks ───────────────────────────────────────────

  console.log('\n--- Field Format Checks ---');

  // Product SKU format: {CAT_L2}-{NNN}
  const skuPattern = /^[A-Z]{2,3}-[A-Z]{2,3}-\d{3}$/;
  const badSkus = products.filter(p => !skuPattern.test(p.sku));
  if (badSkus.length === 0) {
    results.passed.push('All product SKUs match expected format');
    console.log('  Product SKU format: PASS');
  } else {
    results.warnings.push({
      check: 'Product SKU format violations',
      count: badSkus.length,
      samples: badSkus.slice(0, 5).map(p => ({ product_id: p.product_id, sku: p.sku }))
    });
    console.log(`  Product SKU format: WARN (${badSkus.length} non-matching)`);
  }

  // Account number format: KSD-{NNNNN}
  const acctPattern = /^KSD-\d{5}$/;
  const badAccts = customers.filter(c => !acctPattern.test(c.account_number));
  if (badAccts.length === 0) {
    results.passed.push('All account numbers match KSD-NNNNN format');
    console.log('  Account number format: PASS');
  } else {
    results.warnings.push({
      check: 'Account number format violations',
      count: badAccts.length,
      samples: badAccts.slice(0, 5).map(c => ({ customer_id: c.customer_id, account_number: c.account_number }))
    });
    console.log(`  Account number format: WARN (${badAccts.length} non-matching)`);
  }

  // Order number format: ORD-{YYYYMM}-{NNNNN}
  const ordPattern = /^ORD-\d{6}-\d{5}$/;
  const badOrdNums = orders.filter(o => !ordPattern.test(o.order_number));
  if (badOrdNums.length === 0) {
    results.passed.push('All order numbers match ORD-YYYYMM-NNNNN format');
    console.log('  Order number format: PASS');
  } else {
    results.warnings.push({
      check: 'Order number format violations',
      count: badOrdNums.length,
      samples: badOrdNums.slice(0, 5).map(o => ({ order_id: o.order_id, order_number: o.order_number }))
    });
    console.log(`  Order number format: WARN (${badOrdNums.length} non-matching)`);
  }

  // Valid customer types
  const validTypes = new Set(['LSH', 'INT', 'PMG', 'RET']);
  const badTypes = customers.filter(c => !validTypes.has(c.customer_type));
  if (badTypes.length === 0) {
    results.passed.push('All customer types are valid (LSH/INT/PMG/RET)');
    console.log('  Customer type values: PASS');
  } else {
    results.failed.push({
      check: 'Invalid customer types',
      count: badTypes.length,
      samples: badTypes.slice(0, 5).map(c => ({ customer_id: c.customer_id, customer_type: c.customer_type }))
    });
    console.log(`  Customer type values: FAIL (${badTypes.length} invalid)`);
  }

  // Valid order statuses
  const validStatuses = new Set(['SHIPPED', 'DELIVERED', 'PENDING', 'CANCELLED']);
  const badStatuses = orders.filter(o => !validStatuses.has(o.status));
  if (badStatuses.length === 0) {
    results.passed.push('All order statuses are valid');
    console.log('  Order status values: PASS');
  } else {
    results.failed.push({
      check: 'Invalid order statuses',
      count: badStatuses.length,
      samples: badStatuses.slice(0, 5).map(o => ({ order_id: o.order_id, status: o.status }))
    });
    console.log(`  Order status values: FAIL (${badStatuses.length} invalid)`);
  }

  // Valid payment statuses
  const validPayments = new Set(['PAID', 'UNPAID', 'PARTIAL', 'OVERDUE']);
  const badPayments = orders.filter(o => !validPayments.has(o.payment_status));
  if (badPayments.length === 0) {
    results.passed.push('All payment statuses are valid');
    console.log('  Payment status values: PASS');
  } else {
    results.failed.push({
      check: 'Invalid payment statuses',
      count: badPayments.length,
      samples: badPayments.slice(0, 5).map(o => ({ order_id: o.order_id, payment_status: o.payment_status }))
    });
    console.log(`  Payment status values: FAIL (${badPayments.length} invalid)`);
  }

  // Valid UOM values
  const validUOMs = new Set(['EA', 'BX', 'PK', 'KIT', 'SET']);
  const badUOMs = products.filter(p => p.uom && !validUOMs.has(p.uom));
  if (badUOMs.length === 0) {
    results.passed.push('All product UOMs are valid');
    console.log('  Product UOM values: PASS');
  } else {
    results.warnings.push({
      check: 'Invalid UOM values',
      count: badUOMs.length,
      samples: badUOMs.slice(0, 5).map(p => ({ sku: p.sku, uom: p.uom }))
    });
    console.log(`  Product UOM values: WARN (${badUOMs.length} non-standard)`);
  }

  // Valid payment terms
  const validTerms = new Set(['COD', 'NET15', 'NET30', 'NET45']);
  const badTerms = customers.filter(c => c.payment_terms && !validTerms.has(c.payment_terms));
  if (badTerms.length === 0) {
    results.passed.push('All payment terms are valid');
    console.log('  Payment terms values: PASS');
  } else {
    results.warnings.push({
      check: 'Invalid payment terms',
      count: badTerms.length,
      samples: badTerms.slice(0, 5).map(c => ({ customer_id: c.customer_id, payment_terms: c.payment_terms }))
    });
    console.log(`  Payment terms values: WARN (${badTerms.length} non-standard)`);
  }

  return results;
}

// ── Run and Output ────────────────────────────────────────────────────────────

const results = validate();

console.log('\n' + '='.repeat(60));
console.log('INTEGRITY VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log(`\nPASSED:   ${results.passed.length}`);
results.passed.forEach(p => console.log(`  [PASS] ${typeof p === 'string' ? p : p.check || JSON.stringify(p)}`));

if (results.warnings.length > 0) {
  console.log(`\nWARNINGS: ${results.warnings.length}`);
  results.warnings.forEach(w => console.log(`  [WARN] ${typeof w === 'string' ? w : w.check || JSON.stringify(w)}`));
}

if (results.failed.length > 0) {
  console.log(`\nFAILED:   ${results.failed.length}`);
  results.failed.forEach(f => {
    console.log(`  [FAIL] ${typeof f === 'string' ? f : f.check || JSON.stringify(f)}`);
    if (f.samples) {
      f.samples.slice(0, 3).forEach(s => console.log(`         Sample: ${JSON.stringify(s)}`));
    }
  });
}

// Write JSON results
const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}
const outputPath = path.join(docsDir, 'integrity-results.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\nResults written to: ${outputPath}`);

process.exit(results.failed.length > 0 ? 1 : 0);
