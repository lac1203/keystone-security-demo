import Papa from 'papaparse';

// ── In-memory cache ─────────────────────────────────────────────────────────
const cache = {};

/**
 * Load and parse a single CSV file from the /data/ directory.
 * Results are cached in memory — subsequent calls return instantly.
 * @param {string} filename - CSV filename (e.g., 'products.csv')
 * @returns {Promise<Array<Object>>} Parsed rows as array of objects
 */
export const loadCSV = async (filename) => {
  if (cache[filename]) return cache[filename];

  const response = await fetch(`${import.meta.env.BASE_URL}data/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const { data, errors } = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  if (errors.length > 0) {
    console.warn(`Parse warnings for ${filename}:`, errors);
  }
  cache[filename] = data;
  return data;
};

/**
 * Load the 2026 revenue forecast JSON (cached).
 * @returns {Promise<Object>} Forecast data
 */
export const loadForecast = async () => {
  if (cache['forecast_2026.json']) return cache['forecast_2026.json'];

  const response = await fetch(`${import.meta.env.BASE_URL}data/forecast_2026.json`);
  if (!response.ok) {
    throw new Error(`Failed to load forecast_2026.json: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  cache['forecast_2026.json'] = data;
  return data;
};

/**
 * Load the pre-computed summary JSON (cached).
 * @returns {Promise<Object>} Summary statistics
 */
export const loadSummary = async () => {
  if (cache['summary.json']) return cache['summary.json'];

  const response = await fetch(`${import.meta.env.BASE_URL}data/summary.json`);
  if (!response.ok) {
    throw new Error(`Failed to load summary.json: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  cache['summary.json'] = data;
  return data;
};

/**
 * Load all four CSV data files in parallel (each individually cached).
 * @returns {Promise<{products: Array, customers: Array, orders: Array, orderLines: Array}>}
 */
export const loadAllData = async () => {
  const [products, customers, orders, orderLines] = await Promise.all([
    loadCSV('products.csv'),
    loadCSV('customers.csv'),
    loadCSV('orders.csv'),
    loadCSV('order_lines.csv'),
  ]);
  return { products, customers, orders, orderLines };
};

/**
 * Custom hook-style helper: compute monthly revenue from orders.
 * @param {Array<Object>} orders - Parsed orders
 * @returns {Array<{month: string, revenue: number, orders: number, cost: number}>}
 */
export const computeMonthlyRevenue = (orders) => {
  const byMonth = {};
  orders.forEach((order) => {
    if (order.status === 'CANCELLED') return;
    const month = order.order_date?.substring(0, 7); // 'YYYY-MM'
    if (!month) return;
    if (!byMonth[month]) {
      byMonth[month] = { month, revenue: 0, orders: 0, cost: 0 };
    }
    byMonth[month].revenue += order.total || 0;
    byMonth[month].orders += 1;
    byMonth[month].cost += order.total_cost || 0;
  });
  return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
};

/**
 * Compute revenue breakdown by product category.
 * Joins order_lines with products to get category info.
 * @param {Array} orderLines
 * @param {Array} products
 * @returns {Array<{category: string, revenue: number, cost: number, units: number}>}
 */
export const computeCategoryBreakdown = (orderLines, products) => {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  const byCategory = {};
  orderLines.forEach((line) => {
    const product = productMap.get(line.product_id);
    if (!product) return;
    const cat = product.category_l1 || 'Unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { category: cat, revenue: 0, cost: 0, units: 0 };
    }
    byCategory[cat].revenue += line.line_total || 0;
    byCategory[cat].cost += line.line_cost || 0;
    byCategory[cat].units += line.quantity || 0;
  });
  return Object.values(byCategory).sort((a, b) => b.revenue - a.revenue);
};

/**
 * Get recent orders joined with customer names.
 * @param {Array} orders
 * @param {Array} customers
 * @param {number} limit
 * @returns {Array}
 */
export const getRecentOrders = (orders, customers, limit = 10) => {
  const customerMap = new Map();
  customers.forEach((c) => customerMap.set(c.customer_id, c));

  return [...orders]
    .filter((o) => o.status !== 'CANCELLED')
    .sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''))
    .slice(0, limit)
    .map((order) => {
      const customer = customerMap.get(order.customer_id);
      return {
        ...order,
        customer_name: customer?.company_name || 'Unknown',
        customer_type: customer?.customer_type || '',
      };
    });
};

/**
 * Compute top products by revenue from order lines.
 * @param {Array} orderLines
 * @param {Array} products
 * @param {number} limit
 * @returns {Array}
 */
export const getTopProducts = (orderLines, products, limit = 10) => {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  const revenue = {};
  orderLines.forEach((line) => {
    const pid = line.product_id;
    if (!revenue[pid]) {
      revenue[pid] = { product_id: pid, revenue: 0, units: 0, orders: 0 };
    }
    revenue[pid].revenue += line.line_total || 0;
    revenue[pid].units += line.quantity || 0;
    revenue[pid].orders += 1;
  });

  return Object.values(revenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((item) => {
      const product = productMap.get(item.product_id);
      return {
        ...item,
        name: product?.name || 'Unknown',
        sku: product?.sku || '',
        category: product?.category_l1 || '',
        manufacturer: product?.manufacturer || '',
      };
    });
};

/**
 * Compute category revenue grouped by year and calendar month for YoY comparison.
 * @param {Array} orderLines
 * @param {Array} products
 * @param {Array} orders
 * @param {string|null} categoryFilter - Optional category_l1 to filter; null = all
 * @returns {{ data: Array, years: string[], categories: string[] }}
 */
export const computeCategoryYoY = (orderLines, products, orders, categoryFilter = null) => {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  // Build order lookup: order_id -> { year, mm }
  const orderInfo = new Map();
  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date) return;
    orderInfo.set(o.order_id, {
      year: o.order_date.substring(0, 4),
      mm: o.order_date.substring(5, 7),
    });
  });

  // Collect all unique categories and years
  const yearSet = new Set();
  const categorySet = new Set();

  // Accumulate: { 'YYYY': { 'MM': revenue } }
  const byYearMonth = {};

  orderLines.forEach((line) => {
    const info = orderInfo.get(line.order_id);
    if (!info) return;
    const product = productMap.get(line.product_id);
    if (!product) return;
    const cat = product.category_l1 || 'Unknown';
    categorySet.add(cat);

    if (categoryFilter && cat !== categoryFilter) return;

    yearSet.add(info.year);
    if (!byYearMonth[info.year]) byYearMonth[info.year] = {};
    byYearMonth[info.year][info.mm] =
      (byYearMonth[info.year][info.mm] || 0) + (line.line_total || 0);
  });

  const allYears = [...yearSet].sort();
  const monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const data = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const row = { month: monthLabels[m - 1] };
    allYears.forEach((y) => {
      row[y] = byYearMonth[y]?.[mm] || 0;
    });
    data.push(row);
  }

  return {
    data,
    years: allYears,
    categories: [...categorySet].sort(),
  };
};

/**
 * Compute top customers by revenue.
 * @param {Array} orders
 * @param {Array} customers
 * @param {number} limit
 * @returns {Array}
 */
export const getTopCustomers = (orders, customers, limit = 10) => {
  const customerMap = new Map();
  customers.forEach((c) => customerMap.set(c.customer_id, c));

  const revenue = {};
  orders.forEach((order) => {
    if (order.status === 'CANCELLED') return;
    const cid = order.customer_id;
    if (!revenue[cid]) {
      revenue[cid] = { customer_id: cid, revenue: 0, orders: 0 };
    }
    revenue[cid].revenue += order.total || 0;
    revenue[cid].orders += 1;
  });

  return Object.values(revenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((item) => {
      const customer = customerMap.get(item.customer_id);
      return {
        ...item,
        company_name: customer?.company_name || 'Unknown',
        customer_type: customer?.customer_type || '',
        city: customer?.city || '',
        state: customer?.state || '',
      };
    });
};
