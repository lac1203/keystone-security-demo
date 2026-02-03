#!/usr/bin/env node
/**
 * 2026 Actuals Generator for Keystone Security Distribution
 *
 * Generates Year 4 (2026) order and order_line data with intentional
 * variance from forecast_2026.json budget. Appends to existing CSVs
 * and regenerates summary.json.
 *
 * Variance story:
 *   Overall: +3-5% favorable vs forecast
 *   Access Control: +8-10% (market growth)
 *   Commercial Hardware: +3-5% (construction strong)
 *   Automotive: -5-8% (online competition)
 *   Residential Locks: -2-4% (housing cool-off)
 *   Safes & Security: +1-3% (steady)
 *   Key Machines & Supplies: +4-6% (consumables)
 *
 *   Monthly timing: Jan-Feb under (-5 to -8%), Apr-Jun over (+5-10%),
 *   Nov-Dec under (-3 to -4%)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR (seed = 2026 for reproducibility)
// ============================================================================
let seed = 2026;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}
function randBetween(min, max) {
  return min + seededRandom() * (max - min);
}
function randInt(min, max) {
  return Math.floor(randBetween(min, max + 1));
}
function pick(arr) {
  return arr[Math.floor(seededRandom() * arr.length)];
}
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seededRandom() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ============================================================================
// CSV HELPERS
// ============================================================================
function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function readCSV(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const text = fs.readFileSync(filePath, 'utf8').trim();
  const lines = text.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const fields = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] || '';
    }
    rows.push(row);
  }
  return { headers, rows };
}

function appendCSV(filename, headers, rows) {
  const filePath = path.join(DATA_DIR, filename);
  const existing = fs.readFileSync(filePath, 'utf8');
  const prefix = existing.endsWith('\n') ? '' : '\n';
  const lines = rows.map(row => headers.map(h => escapeCSV(row[h])).join(','));
  fs.appendFileSync(filePath, prefix + lines.join('\n') + '\n');
  console.log(`  Appended ${rows.length} rows to ${filename}`);
}

// ============================================================================
// CONSTANTS (from generate-all-data.js / CLAUDE.md)
// ============================================================================
const MONTHLY_SEASONALITY = {
  1: 0.78, 2: 0.72, 3: 0.92, 4: 1.08, 5: 1.15, 6: 1.22,
  7: 1.18, 8: 1.16, 9: 1.10, 10: 1.05, 11: 0.98, 12: 0.88
};

const DAY_OF_WEEK = {
  1: 1.35,  // Monday
  2: 1.25,  // Tuesday
  3: 1.10,  // Wednesday
  4: 1.00,  // Thursday
  5: 0.85,  // Friday
  6: 0.30,  // Saturday
  0: 0.15   // Sunday
};

const WEEK_OF_MONTH = [1.08, 1.12, 1.05, 0.88]; // weeks 1-4

const CUSTOMER_PRODUCT_AFFINITIES = {
  LSH: { 'Residential Locks': 0.30, 'Commercial Hardware': 0.20, 'Access Control': 0.10, 'Automotive': 0.20, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.15 },
  INT: { 'Residential Locks': 0.05, 'Commercial Hardware': 0.30, 'Access Control': 0.50, 'Automotive': 0.02, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.08 },
  PMG: { 'Residential Locks': 0.45, 'Commercial Hardware': 0.30, 'Access Control': 0.15, 'Automotive': 0.00, 'Safes & Security': 0.05, 'Key Machines & Supplies': 0.05 },
  RET: { 'Residential Locks': 0.50, 'Commercial Hardware': 0.15, 'Access Control': 0.05, 'Automotive': 0.05, 'Safes & Security': 0.10, 'Key Machines & Supplies': 0.15 }
};

// Customer type weights for order frequency
const TYPE_ORDER_FREQ = {
  LSH: { weight: 0.45, freqMin: 8, freqMax: 15 },
  INT: { weight: 0.30, freqMin: 5, freqMax: 15 },
  PMG: { weight: 0.15, freqMin: 2, freqMax: 6 },
  RET: { weight: 0.10, freqMin: 2, freqMax: 6 }
};

// Tax rates by state
const TAX_RATES = { PA: 0.06, NJ: 0.06625, MD: 0.06, VA: 0.053, DE: 0, DC: 0.06 };

// ============================================================================
// VARIANCE MULTIPLIERS (the "story" for 2026 actuals vs forecast)
// ============================================================================
const MONTHLY_VARIANCE = {
  1: 0.93,   // harsh winter, under forecast
  2: 0.92,   // harsh winter, under forecast
  3: 0.98,   // slight under
  4: 1.07,   // strong spring
  5: 1.09,   // strong spring
  6: 1.06,   // strong summer
  7: 1.03,   // moderate
  8: 1.02,   // moderate
  9: 1.02,   // moderate
  10: 1.01,  // slight over
  11: 0.97,  // year-end caution
  12: 0.96   // year-end caution
};

// Affinity adjustments (shifts category selection probability)
// Note: normalization means boosting most categories causes under-represented
// categories to drop disproportionately. Automotive needs a slight boost to
// offset the normalization drag from other categories being pushed up.
const CATEGORY_VARIANCE = {
  'Access Control': 1.09,          // +8-10% market growth
  'Commercial Hardware': 1.05,     // +3-5% construction strong
  'Automotive': 1.02,              // slight affinity boost to offset normalization
  'Residential Locks': 0.94,       // -2-4% housing cool-off
  'Safes & Security': 1.03,        // +1-3% steady
  'Key Machines & Supplies': 1.06  // +4-6% consumables
};

// Price-level adjustments (shifts average unit price per category)
// Used to produce the actual revenue variance story per category
const CATEGORY_PRICE_ADJUST = {
  'Access Control': 1.00,
  'Commercial Hardware': 1.00,
  'Automotive': 0.97,              // price pressure from online competitors
  'Residential Locks': 0.97,       // slight price softening from housing cool-off
  'Safes & Security': 1.01,
  'Key Machines & Supplies': 1.01
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function addBusinessDays(date, days) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getWeekOfMonth(day) {
  if (day <= 7) return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

/**
 * Apply category variance to base customer-product affinities and re-normalize.
 */
function getAdjustedAffinities(custType) {
  const base = CUSTOMER_PRODUCT_AFFINITIES[custType];
  const adjusted = {};
  let total = 0;
  for (const [cat, weight] of Object.entries(base)) {
    const v = weight * (CATEGORY_VARIANCE[cat] || 1.0);
    adjusted[cat] = v;
    total += v;
  }
  // Re-normalize
  for (const cat of Object.keys(adjusted)) {
    adjusted[cat] = adjusted[cat] / total;
  }
  return adjusted;
}

// ============================================================================
// MAIN GENERATION
// ============================================================================
function generate2026Orders(products, customers) {
  console.log('\n=== Generating 2026 orders and order lines ===');

  // Separate active customers
  const activeCustomers = customers.filter(c => c.status === 'ACTIVE');
  const customersByType = { LSH: [], INT: [], PMG: [], RET: [] };
  for (const c of activeCustomers) {
    if (customersByType[c.customer_type]) {
      customersByType[c.customer_type].push(c);
    }
  }

  // Build product groups by L1 category (active only)
  const productsByL1 = {};
  for (const p of products) {
    if (p.status === 'DISCONTINUED') continue;
    if (!productsByL1[p.category_l1]) productsByL1[p.category_l1] = [];
    productsByL1[p.category_l1].push(p);
  }

  // Find max existing IDs
  const existingOrders = readCSV('orders.csv');
  const existingLines = readCSV('order_lines.csv');

  let maxOrderId = 0;
  let maxLineId = 0;
  for (const row of existingOrders.rows) {
    const id = parseInt(row.order_id, 10);
    if (id > maxOrderId) maxOrderId = id;
  }
  for (const row of existingLines.rows) {
    const id = parseInt(row.line_id, 10);
    if (id > maxLineId) maxLineId = id;
  }

  console.log(`  Starting order_id: ${maxOrderId + 1}`);
  console.log(`  Starting line_id: ${maxLineId + 1}`);

  // Check idempotency: see if 2026 orders already exist
  const has2026 = existingOrders.rows.some(r => r.order_date && r.order_date.startsWith('2026'));
  if (has2026) {
    console.error('\n  ERROR: 2026 orders already exist in orders.csv. Aborting to prevent duplicates.');
    console.error('  To regenerate, first remove 2026 rows from orders.csv and order_lines.csv.');
    process.exit(1);
  }

  const orders = [];
  const orderLines = [];
  let orderId = maxOrderId + 1;
  let lineId = maxLineId + 1;
  const orderSeqByMonth = {};

  // Target ~4,750 orders for 2026 (continuing ~8% growth from 4,432 in 2025)
  // But actual distribution driven by monthly seasonality * variance
  const y4AnnualTarget = 4750;
  const sumMultipliers = Object.values(MONTHLY_SEASONALITY).reduce((a, b) => a + b, 0);
  const monthlyBase = y4AnnualTarget / sumMultipliers;

  const year = 2026;

  for (let month = 1; month <= 12; month++) {
    const seasonality = MONTHLY_SEASONALITY[month];
    const variance = MONTHLY_VARIANCE[month];
    const targetOrders = Math.round(monthlyBase * seasonality * variance);
    const monthKey = `${year}${String(month).padStart(2, '0')}`;
    orderSeqByMonth[monthKey] = 0;

    const daysInMonth = getDaysInMonth(year, month);

    for (let i = 0; i < targetOrders; i++) {
      // Pick a day based on day-of-week weights
      let day, dow, attempts = 0;
      do {
        day = randInt(1, daysInMonth);
        const testDate = new Date(year, month - 1, day);
        dow = testDate.getDay();
        const weekMult = WEEK_OF_MONTH[getWeekOfMonth(day)];
        const dowMult = DAY_OF_WEEK[dow];
        if (seededRandom() < (dowMult * weekMult) / (1.35 * 1.12)) break;
        attempts++;
      } while (attempts < 50);

      const orderDate = new Date(year, month - 1, day);

      // Pick customer type, then customer
      const types = Object.keys(TYPE_ORDER_FREQ);
      const typeWeights = types.map(t => TYPE_ORDER_FREQ[t].weight);
      const custType = weightedPick(types, typeWeights);
      const customer = pick(customersByType[custType]);
      if (!customer) continue;

      // Ship date: 0-3 business days after order date
      const shipDays = randInt(0, 3);
      const shipDate = shipDays === 0 ? new Date(orderDate) : addBusinessDays(orderDate, shipDays);

      // Generate order lines
      let numLines = 1 + Math.floor(Math.abs(randBetween(0, 1) + randBetween(0, 1) + randBetween(0, 1)) * 2.5);
      numLines = Math.max(1, Math.min(25, numLines));
      if (seededRandom() < 0.15) numLines = Math.min(25, numLines + randInt(1, 3));

      // Use adjusted affinities with category variance baked in
      const affinities = getAdjustedAffinities(custType);
      const affKeys = Object.keys(affinities);
      const affWeights = Object.values(affinities);

      let subtotal = 0;
      let totalCost = 0;
      const thisOrderLines = [];

      for (let ln = 0; ln < numLines; ln++) {
        let category = weightedPick(affKeys, affWeights);
        if (!productsByL1[category] || productsByL1[category].length === 0) {
          category = pick(Object.keys(productsByL1));
        }

        const product = pick(productsByL1[category]);
        const pPrice = parseFloat(product.price);
        const pCost = parseFloat(product.cost);

        // Quantity varies by category
        let qty;
        if (category === 'Key Machines & Supplies' && product.category_l2 === 'Key Blanks') {
          qty = randInt(2, 10);
        } else if (category === 'Key Machines & Supplies' && product.category_l2 === 'Lubricants') {
          qty = randInt(3, 12);
        } else if (category === 'Automotive' && product.category_l2 === 'Transponder Keys') {
          qty = randInt(5, 25);
        } else if (category === 'Access Control' && product.category_l2 === 'Credentials') {
          qty = randInt(1, 5);
        } else if (pPrice > 500) {
          qty = randInt(1, 2);
        } else if (pPrice > 100) {
          qty = randInt(1, 6);
        } else {
          qty = randInt(1, 10);
        }

        // Volume discount: +/-5% from standard price, plus category price adjustment
        const discount = randBetween(0.95, 1.00);
        const priceAdj = CATEGORY_PRICE_ADJUST[category] || 1.0;
        const unitPrice = parseFloat((pPrice * discount * priceAdj).toFixed(2));
        const lineTotal = parseFloat((qty * unitPrice).toFixed(2));
        const lineCost = parseFloat((qty * pCost).toFixed(2));

        subtotal += lineTotal;
        totalCost += lineCost;

        thisOrderLines.push({
          line_id: lineId++,
          order_id: orderId,
          line_number: ln + 1,
          product_id: product.product_id,
          quantity: qty,
          unit_price: unitPrice.toFixed(2),
          unit_cost: pCost.toFixed(2),
          line_total: lineTotal.toFixed(2),
          line_cost: lineCost.toFixed(2)
        });
      }

      subtotal = parseFloat(subtotal.toFixed(2));
      totalCost = parseFloat(totalCost.toFixed(2));

      // Tax
      const taxRate = TAX_RATES[customer.state] || 0.06;
      const tax = parseFloat((subtotal * taxRate).toFixed(2));

      // Freight
      let freight;
      if (subtotal < 500) {
        freight = parseFloat(randBetween(12, 35).toFixed(2));
      } else if (subtotal < 2000) {
        freight = parseFloat(randBetween(25, 65).toFixed(2));
      } else if (subtotal < 5000) {
        freight = parseFloat(randBetween(45, 120).toFixed(2));
      } else {
        freight = parseFloat(randBetween(75, 200).toFixed(2));
      }

      const total = parseFloat((subtotal + tax + freight).toFixed(2));
      const margin = parseFloat(((subtotal - totalCost) / subtotal).toFixed(4));

      // Order status — reference date is Dec 31, 2026
      let status;
      const refDate = new Date(2026, 11, 31);
      const orderAge = (refDate - orderDate) / (1000 * 60 * 60 * 24);
      if (seededRandom() < 0.02) {
        status = 'CANCELLED';
      } else if (orderAge < 14) {
        status = seededRandom() < 0.5 ? 'PENDING' : 'SHIPPED';
      } else if (orderAge < 30) {
        status = seededRandom() < 0.3 ? 'SHIPPED' : 'DELIVERED';
      } else {
        status = 'DELIVERED';
      }

      // Payment status
      let paymentStatus;
      if (status === 'CANCELLED') {
        paymentStatus = 'UNPAID';
      } else if (orderAge > 60) {
        const r = seededRandom();
        if (r < 0.85) paymentStatus = 'PAID';
        else if (r < 0.93) paymentStatus = 'PAID';
        else if (r < 0.97) paymentStatus = 'OVERDUE';
        else paymentStatus = 'PARTIAL';
      } else if (orderAge > 30) {
        const r = seededRandom();
        if (r < 0.70) paymentStatus = 'PAID';
        else if (r < 0.85) paymentStatus = 'UNPAID';
        else if (r < 0.95) paymentStatus = 'PARTIAL';
        else paymentStatus = 'OVERDUE';
      } else {
        const r = seededRandom();
        if (r < 0.30) paymentStatus = 'PAID';
        else if (r < 0.80) paymentStatus = 'UNPAID';
        else paymentStatus = 'PARTIAL';
      }

      // PO Number
      const poNumber = `PO-${customer.account_number.replace('KSD-', '')}-${String(randInt(1000, 9999))}`;

      orderSeqByMonth[monthKey]++;
      const orderNumber = `ORD-${monthKey}-${String(orderSeqByMonth[monthKey]).padStart(5, '0')}`;

      orders.push({
        order_id: orderId,
        order_number: orderNumber,
        customer_id: customer.customer_id,
        order_date: formatDate(orderDate),
        ship_date: formatDate(shipDate),
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        freight: freight.toFixed(2),
        total: total.toFixed(2),
        total_cost: totalCost.toFixed(2),
        margin: margin,
        status,
        payment_status: paymentStatus,
        po_number: poNumber
      });

      orderLines.push(...thisOrderLines);
      orderId++;
    }
  }

  return { orders, orderLines };
}

// ============================================================================
// SUMMARY REGENERATION
// ============================================================================
function regenerateSummary(products, customers) {
  console.log('\n=== Regenerating summary.json ===');

  // Re-read all orders and order lines (including freshly appended 2026 data)
  const allOrders = readCSV('orders.csv').rows;
  const allLines = readCSV('order_lines.csv').rows;

  // Build product map
  const productMap = {};
  for (const p of products) {
    productMap[p.product_id] = p;
  }

  // Revenue by month
  const revenueByMonth = {};
  for (const o of allOrders) {
    const ym = o.order_date.substring(0, 7);
    if (!revenueByMonth[ym]) revenueByMonth[ym] = { month: ym, revenue: 0, orders: 0, cost: 0 };
    revenueByMonth[ym].revenue += parseFloat(o.total);
    revenueByMonth[ym].cost += parseFloat(o.total_cost);
    revenueByMonth[ym].orders += 1;
  }
  const monthlyRevenue = Object.values(revenueByMonth).sort((a, b) => a.month.localeCompare(b.month));
  monthlyRevenue.forEach(m => {
    m.revenue = parseFloat(m.revenue.toFixed(2));
    m.cost = parseFloat(m.cost.toFixed(2));
    m.margin = parseFloat(((m.revenue - m.cost) / m.revenue).toFixed(4));
  });

  // Revenue by category (based on line items)
  const revenueByCategory = {};
  for (const ol of allLines) {
    const product = productMap[ol.product_id];
    if (!product) continue;
    const cat = product.category_l1;
    if (!revenueByCategory[cat]) revenueByCategory[cat] = { category: cat, revenue: 0, cost: 0, units: 0 };
    revenueByCategory[cat].revenue += parseFloat(ol.line_total);
    revenueByCategory[cat].cost += parseFloat(ol.line_cost);
    revenueByCategory[cat].units += parseInt(ol.quantity, 10);
  }
  const categoryRevenue = Object.values(revenueByCategory).sort((a, b) => b.revenue - a.revenue);
  categoryRevenue.forEach(c => {
    c.revenue = parseFloat(c.revenue.toFixed(2));
    c.cost = parseFloat(c.cost.toFixed(2));
    c.margin = parseFloat(((c.revenue - c.cost) / c.revenue).toFixed(4));
  });

  // Customers by type
  const customersByType = {};
  for (const c of customers) {
    customersByType[c.customer_type] = (customersByType[c.customer_type] || 0) + 1;
  }

  // Top 10 products by revenue
  const productRevenue = {};
  for (const ol of allLines) {
    if (!productRevenue[ol.product_id]) productRevenue[ol.product_id] = { product_id: ol.product_id, revenue: 0, units: 0, orders: 0 };
    productRevenue[ol.product_id].revenue += parseFloat(ol.line_total);
    productRevenue[ol.product_id].units += parseInt(ol.quantity, 10);
    productRevenue[ol.product_id].orders += 1;
  }
  const top10Products = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(pr => {
      const p = productMap[pr.product_id];
      return {
        product_id: parseInt(pr.product_id, 10),
        sku: p ? p.sku : 'N/A',
        name: p ? p.name : 'N/A',
        category: p ? p.category_l1 : 'N/A',
        revenue: parseFloat(pr.revenue.toFixed(2)),
        units_sold: pr.units,
        order_count: pr.orders
      };
    });

  // Overall metrics
  const totalRevenue = allOrders.reduce((s, o) => s + parseFloat(o.total), 0);
  const totalCost = allOrders.reduce((s, o) => s + parseFloat(o.total_cost), 0);
  const y1Rev = allOrders.filter(o => o.order_date.startsWith('2023')).reduce((s, o) => s + parseFloat(o.total), 0);
  const y2Rev = allOrders.filter(o => o.order_date.startsWith('2024')).reduce((s, o) => s + parseFloat(o.total), 0);
  const y3Rev = allOrders.filter(o => o.order_date.startsWith('2025')).reduce((s, o) => s + parseFloat(o.total), 0);
  const y4Rev = allOrders.filter(o => o.order_date.startsWith('2026')).reduce((s, o) => s + parseFloat(o.total), 0);

  // Top 10 customers
  const customerRevMap = {};
  for (const o of allOrders) {
    if (!customerRevMap[o.customer_id]) customerRevMap[o.customer_id] = { customer_id: o.customer_id, revenue: 0, orders: 0 };
    customerRevMap[o.customer_id].revenue += parseFloat(o.total);
    customerRevMap[o.customer_id].orders += 1;
  }
  const top10Customers = Object.values(customerRevMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map(cr => {
      const c = customers.find(cu => String(cu.customer_id) === String(cr.customer_id));
      return {
        customer_id: parseInt(cr.customer_id, 10),
        company_name: c ? c.company_name : 'N/A',
        customer_type: c ? c.customer_type : 'N/A',
        revenue: parseFloat(cr.revenue.toFixed(2)),
        order_count: cr.orders
      };
    });

  // Margin by category
  const marginByCategory = categoryRevenue.map(c => ({
    category: c.category,
    avg_margin: c.margin,
    revenue: c.revenue,
    cost: c.cost
  }));

  // State distribution
  const stateDistribution = {};
  for (const c of customers) {
    stateDistribution[c.state] = (stateDistribution[c.state] || 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    company: 'Keystone Security Distribution',
    data_period: { start: '2023-01-01', end: '2026-12-31' },
    record_counts: {
      products: products.length,
      customers: customers.length,
      orders: allOrders.length,
      order_lines: allLines.length
    },
    overall_metrics: {
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_cost: parseFloat(totalCost.toFixed(2)),
      overall_margin: parseFloat(((totalRevenue - totalCost) / totalRevenue).toFixed(4)),
      year1_revenue: parseFloat(y1Rev.toFixed(2)),
      year2_revenue: parseFloat(y2Rev.toFixed(2)),
      year3_revenue: parseFloat(y3Rev.toFixed(2)),
      year4_revenue: parseFloat(y4Rev.toFixed(2)),
      yoy_growth: parseFloat(((y4Rev / y3Rev - 1) * 100).toFixed(1)),
      avg_order_value: parseFloat((totalRevenue / allOrders.length).toFixed(2)),
      avg_lines_per_order: parseFloat((allLines.length / allOrders.length).toFixed(2))
    },
    revenue_by_month: monthlyRevenue,
    revenue_by_category: categoryRevenue,
    margin_by_category: marginByCategory,
    customers_by_type: customersByType,
    customers_by_state: stateDistribution,
    top_10_products: top10Products,
    top_10_customers: top10Customers
  };

  const outPath = path.join(DATA_DIR, 'summary.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`  Wrote summary.json`);
  console.log(`  Total revenue (all years): $${(totalRevenue / 1e6).toFixed(2)}M`);
  console.log(`  Y4 revenue: $${(y4Rev / 1e6).toFixed(2)}M`);
  console.log(`  YoY growth (Y3->Y4): ${((y4Rev / y3Rev - 1) * 100).toFixed(1)}%`);

  return summary;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
console.log('====================================================');
console.log('Keystone Security Distribution - 2026 Actuals Generator');
console.log('====================================================');

// Load existing data
console.log('\n=== Loading existing data ===');
const productsData = readCSV('products.csv');
const customersData = readCSV('customers.csv');

const products = productsData.rows.map(r => ({
  ...r,
  product_id: parseInt(r.product_id, 10),
  price: r.price,
  cost: r.cost
}));
const customers = customersData.rows.map(r => ({
  ...r,
  customer_id: parseInt(r.customer_id, 10)
}));

console.log(`  Products loaded: ${products.length}`);
console.log(`  Customers loaded: ${customers.length}`);

// Generate 2026 orders
const { orders, orderLines } = generate2026Orders(products, customers);

// Append to CSVs
console.log('\n=== Appending to CSV files ===');
const orderHeaders = ['order_id', 'order_number', 'customer_id', 'order_date', 'ship_date',
  'subtotal', 'tax', 'freight', 'total', 'total_cost', 'margin',
  'status', 'payment_status', 'po_number'];
const lineHeaders = ['line_id', 'order_id', 'line_number', 'product_id', 'quantity',
  'unit_price', 'unit_cost', 'line_total', 'line_cost'];

appendCSV('orders.csv', orderHeaders, orders);
appendCSV('order_lines.csv', lineHeaders, orderLines);

// Regenerate summary
const summary = regenerateSummary(products, customers);

// ============================================================================
// REPORTING
// ============================================================================
console.log('\n====================================================');
console.log('2026 ACTUALS GENERATION COMPLETE');
console.log('====================================================');
console.log(`New orders:      ${orders.length}`);
console.log(`New order lines: ${orderLines.length}`);
console.log(`Avg lines/order: ${(orderLines.length / orders.length).toFixed(2)}`);

// Revenue breakdown by category (line_total basis)
const catRevenue = {};
const productMap = {};
for (const p of products) productMap[p.product_id] = p;
for (const ol of orderLines) {
  const prod = productMap[parseInt(ol.product_id, 10)];
  if (!prod) continue;
  const cat = prod.category_l1;
  catRevenue[cat] = (catRevenue[cat] || 0) + parseFloat(ol.line_total);
}

// Load forecast for comparison
let forecast = null;
try {
  forecast = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'forecast_2026.json'), 'utf8'));
} catch (e) {
  // forecast not available
}

const totalLineRevenue = Object.values(catRevenue).reduce((a, b) => a + b, 0);
console.log(`\nTotal line_total revenue: $${(totalLineRevenue / 1e6).toFixed(2)}M`);

console.log('\nCategory breakdown (line_total basis):');
for (const [cat, rev] of Object.entries(catRevenue).sort((a, b) => b[1] - a[1])) {
  let forecastRev = '';
  let varianceStr = '';
  if (forecast) {
    const fc = forecast.modes.full_year.by_category.find(c => c.category === cat);
    if (fc) {
      forecastRev = `  Forecast: $${(fc.projected_revenue / 1e6).toFixed(2)}M`;
      const variance = ((rev / fc.projected_revenue - 1) * 100).toFixed(1);
      varianceStr = `  Variance: ${variance > 0 ? '+' : ''}${variance}%`;
    }
  }
  console.log(`  ${cat}: $${(rev / 1e6).toFixed(2)}M${forecastRev}${varianceStr}`);
}

// Monthly order counts
console.log('\nMonthly order counts:');
const monthlyCounts = {};
for (const o of orders) {
  const ym = o.order_date.substring(0, 7);
  monthlyCounts[ym] = (monthlyCounts[ym] || 0) + 1;
}
for (const [ym, count] of Object.entries(monthlyCounts).sort()) {
  console.log(`  ${ym}: ${count} orders`);
}

console.log('\n====================================================');
