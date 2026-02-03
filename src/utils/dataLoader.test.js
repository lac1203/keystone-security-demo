import { describe, it, expect } from 'vitest';
import {
  computeMonthlyRevenue,
  computeCategoryBreakdown,
  getRecentOrders,
  getTopProducts,
  getTopCustomers,
  getOrderLines,
  computeCategoryYoY,
} from './dataLoader';

// ---------------------------------------------------------------------------
// Test Data Fixtures
// ---------------------------------------------------------------------------
const orders = [
  { order_id: 1, customer_id: 1, order_date: '2024-01-15', total: 1000, total_cost: 600, status: 'DELIVERED' },
  { order_id: 2, customer_id: 2, order_date: '2024-01-20', total: 2000, total_cost: 1200, status: 'SHIPPED' },
  { order_id: 3, customer_id: 1, order_date: '2024-02-10', total: 1500, total_cost: 900, status: 'DELIVERED' },
  { order_id: 4, customer_id: 3, order_date: '2024-02-15', total: 500, total_cost: 300, status: 'CANCELLED' },
  { order_id: 5, customer_id: 2, order_date: '2025-01-10', total: 3000, total_cost: 1800, status: 'DELIVERED' },
];

const customers = [
  { customer_id: 1, company_name: 'Alpha Locksmith', customer_type: 'LSH', city: 'Philadelphia', state: 'PA' },
  { customer_id: 2, company_name: 'Beta Security', customer_type: 'INT', city: 'Newark', state: 'NJ' },
  { customer_id: 3, company_name: 'Gamma Properties', customer_type: 'PMG', city: 'Baltimore', state: 'MD' },
];

const products = [
  { product_id: 1, name: 'Deadbolt A', sku: 'RES-DBL-001', category_l1: 'Residential Locks', manufacturer: 'Schlage' },
  { product_id: 2, name: 'Card Reader X', sku: 'ACC-RDR-001', category_l1: 'Access Control', manufacturer: 'HID' },
  { product_id: 3, name: 'Exit Device Pro', sku: 'COM-EXT-001', category_l1: 'Commercial Hardware', manufacturer: 'Von Duprin' },
];

const orderLines = [
  { line_id: 1, order_id: 1, line_number: 1, product_id: 1, quantity: 10, unit_price: 50, unit_cost: 30, line_total: 500, line_cost: 300 },
  { line_id: 2, order_id: 1, line_number: 2, product_id: 2, quantity: 5, unit_price: 100, unit_cost: 60, line_total: 500, line_cost: 300 },
  { line_id: 3, order_id: 2, line_number: 1, product_id: 2, quantity: 10, unit_price: 100, unit_cost: 60, line_total: 1000, line_cost: 600 },
  { line_id: 4, order_id: 2, line_number: 2, product_id: 3, quantity: 5, unit_price: 200, unit_cost: 120, line_total: 1000, line_cost: 600 },
  { line_id: 5, order_id: 3, line_number: 1, product_id: 1, quantity: 20, unit_price: 50, unit_cost: 30, line_total: 1000, line_cost: 600 },
  { line_id: 6, order_id: 3, line_number: 2, product_id: 3, quantity: 2, unit_price: 250, unit_cost: 150, line_total: 500, line_cost: 300 },
  { line_id: 7, order_id: 5, line_number: 1, product_id: 1, quantity: 30, unit_price: 50, unit_cost: 30, line_total: 1500, line_cost: 900 },
  { line_id: 8, order_id: 5, line_number: 2, product_id: 2, quantity: 15, unit_price: 100, unit_cost: 60, line_total: 1500, line_cost: 900 },
];

// ---------------------------------------------------------------------------
// computeMonthlyRevenue
// ---------------------------------------------------------------------------
describe('computeMonthlyRevenue', () => {
  it('aggregates revenue by month', () => {
    const result = computeMonthlyRevenue(orders);
    expect(result.length).toBe(3); // 2024-01, 2024-02, 2025-01
    expect(result[0].month).toBe('2024-01');
    expect(result[0].revenue).toBe(3000); // 1000 + 2000
    expect(result[0].orders).toBe(2);
  });

  it('excludes cancelled orders', () => {
    const result = computeMonthlyRevenue(orders);
    const feb = result.find((m) => m.month === '2024-02');
    expect(feb.revenue).toBe(1500); // only order 3, not the cancelled order 4
    expect(feb.orders).toBe(1);
  });

  it('sorts chronologically', () => {
    const result = computeMonthlyRevenue(orders);
    expect(result[0].month).toBe('2024-01');
    expect(result[result.length - 1].month).toBe('2025-01');
  });

  it('returns empty array for empty input', () => {
    expect(computeMonthlyRevenue([])).toEqual([]);
  });

  it('tracks cost alongside revenue', () => {
    const result = computeMonthlyRevenue(orders);
    expect(result[0].cost).toBe(1800); // 600 + 1200
  });
});

// ---------------------------------------------------------------------------
// computeCategoryBreakdown
// ---------------------------------------------------------------------------
describe('computeCategoryBreakdown', () => {
  it('aggregates by product category', () => {
    const result = computeCategoryBreakdown(orderLines, products);
    expect(result.length).toBe(3);
  });

  it('sorts by revenue descending', () => {
    const result = computeCategoryBreakdown(orderLines, products);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].revenue).toBeGreaterThanOrEqual(result[i].revenue);
    }
  });

  it('tracks units and cost', () => {
    const result = computeCategoryBreakdown(orderLines, products);
    const residential = result.find((c) => c.category === 'Residential Locks');
    expect(residential.units).toBe(60); // 10 + 20 + 30
    expect(residential.revenue).toBe(3000); // 500 + 1000 + 1500
  });

  it('returns empty array for empty inputs', () => {
    expect(computeCategoryBreakdown([], products)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getRecentOrders
// ---------------------------------------------------------------------------
describe('getRecentOrders', () => {
  it('returns the most recent non-cancelled orders', () => {
    const result = getRecentOrders(orders, customers, 3);
    expect(result.length).toBe(3);
    expect(result[0].order_id).toBe(5); // most recent
  });

  it('excludes cancelled orders', () => {
    const result = getRecentOrders(orders, customers);
    const ids = result.map((o) => o.order_id);
    expect(ids).not.toContain(4);
  });

  it('joins customer name', () => {
    const result = getRecentOrders(orders, customers);
    const order1 = result.find((o) => o.order_id === 1);
    expect(order1.customer_name).toBe('Alpha Locksmith');
  });

  it('respects limit parameter', () => {
    const result = getRecentOrders(orders, customers, 2);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getTopProducts
// ---------------------------------------------------------------------------
describe('getTopProducts', () => {
  it('returns products ranked by revenue', () => {
    const result = getTopProducts(orderLines, products);
    expect(result[0].revenue).toBeGreaterThanOrEqual(result[1].revenue);
  });

  it('includes product metadata', () => {
    const result = getTopProducts(orderLines, products);
    const first = result[0];
    expect(first.name).toBeTruthy();
    expect(first.sku).toBeTruthy();
    expect(first.category).toBeTruthy();
  });

  it('tracks units and order count', () => {
    const result = getTopProducts(orderLines, products);
    const deadbolt = result.find((p) => p.product_id === 1);
    expect(deadbolt.units).toBe(60); // 10 + 20 + 30
    expect(deadbolt.orders).toBe(3); // lines 1, 5, 7
  });

  it('respects limit parameter', () => {
    const result = getTopProducts(orderLines, products, 2);
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getTopCustomers
// ---------------------------------------------------------------------------
describe('getTopCustomers', () => {
  it('returns customers ranked by revenue', () => {
    const result = getTopCustomers(orders, customers);
    expect(result[0].revenue).toBeGreaterThanOrEqual(result[1].revenue);
  });

  it('excludes cancelled orders from totals', () => {
    const result = getTopCustomers(orders, customers);
    const gamma = result.find((c) => c.customer_id === 3);
    expect(gamma).toBeUndefined(); // only had cancelled order
  });

  it('includes customer metadata', () => {
    const result = getTopCustomers(orders, customers);
    const first = result[0];
    expect(first.company_name).toBeTruthy();
    expect(first.customer_type).toBeTruthy();
  });

  it('respects limit parameter', () => {
    const result = getTopCustomers(orders, customers, 1);
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getOrderLines
// ---------------------------------------------------------------------------
describe('getOrderLines', () => {
  it('returns lines for a specific order', () => {
    const result = getOrderLines(orderLines, products, 1);
    expect(result.length).toBe(2);
    expect(result.every((l) => l.order_id === 1)).toBe(true);
  });

  it('sorts by line_number', () => {
    const result = getOrderLines(orderLines, products, 2);
    expect(result[0].line_number).toBe(1);
    expect(result[1].line_number).toBe(2);
  });

  it('joins product metadata', () => {
    const result = getOrderLines(orderLines, products, 1);
    expect(result[0].product_name).toBe('Deadbolt A');
    expect(result[0].sku).toBe('RES-DBL-001');
    expect(result[0].category).toBe('Residential Locks');
  });

  it('returns empty array for non-existent order', () => {
    expect(getOrderLines(orderLines, products, 999)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeCategoryYoY
// ---------------------------------------------------------------------------
describe('computeCategoryYoY', () => {
  it('returns 12 months of data', () => {
    const result = computeCategoryYoY(orderLines, products, orders);
    expect(result.data.length).toBe(12);
    expect(result.data[0].month).toBe('Jan');
    expect(result.data[11].month).toBe('Dec');
  });

  it('detects available years', () => {
    const result = computeCategoryYoY(orderLines, products, orders);
    expect(result.years).toContain('2024');
    expect(result.years).toContain('2025');
  });

  it('detects available categories', () => {
    const result = computeCategoryYoY(orderLines, products, orders);
    expect(result.categories).toContain('Residential Locks');
    expect(result.categories).toContain('Access Control');
  });

  it('filters by category when specified', () => {
    const result = computeCategoryYoY(orderLines, products, orders, 'Residential Locks');
    // Only residential revenue should appear
    const jan2024 = result.data[0]['2024'];
    // Jan 2024 residential: order 1 line 1 = 500
    expect(jan2024).toBe(500);
  });
});
