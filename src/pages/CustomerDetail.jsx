import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadAllData, computeMonthlyRevenue } from '../utils/dataLoader';
import {
  formatCurrency,
  formatCurrencyFull,
  formatNumber,
  formatPercent,
  formatDate,
  formatMonthShort,
  customerTypeLabel,
  getOrderStatusClass,
  getPaymentStatusClass,
} from '../utils/formatters';
import { CUSTOMER_TYPE_COLORS } from '../components/charts/colors';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Loading Spinner
// ---------------------------------------------------------------------------
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Tooltip for the revenue chart
// ---------------------------------------------------------------------------
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}:</span>
          <span className="font-medium">{formatCurrency(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Orders Per Page
// ---------------------------------------------------------------------------
const ORDERS_PER_PAGE = 15;

// ---------------------------------------------------------------------------
// CustomerDetail Component
// ---------------------------------------------------------------------------
export default function CustomerDetail() {
  const { id } = useParams();
  const customerId = Number(id);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderPage, setOrderPage] = useState(1);
  const [orderSort, setOrderSort] = useState({ key: 'order_date', dir: 'desc' });

  useEffect(() => {
    loadAllData()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  // Find the customer record
  const customer = useMemo(() => {
    if (!data) return null;
    return data.customers.find((c) => c.customer_id === customerId) || null;
  }, [data, customerId]);

  // All non-cancelled orders for this customer
  const customerOrders = useMemo(() => {
    if (!data) return [];
    return data.orders.filter(
      (o) => o.customer_id === customerId && o.status !== 'CANCELLED'
    );
  }, [data, customerId]);

  // Order IDs set for fast lookup
  const customerOrderIds = useMemo(() => {
    return new Set(customerOrders.map((o) => o.order_id));
  }, [customerOrders]);

  // Order lines for this customer
  const customerLines = useMemo(() => {
    if (!data) return [];
    return data.orderLines.filter((ol) => customerOrderIds.has(ol.order_id));
  }, [data, customerOrderIds]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = customerOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalCost = customerOrders.reduce((s, o) => s + (o.total_cost || 0), 0);
    const margin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
    const avgOrder = customerOrders.length > 0 ? totalRevenue / customerOrders.length : 0;
    return { totalRevenue, totalCost, margin, avgOrder, orderCount: customerOrders.length };
  }, [customerOrders]);

  // Monthly revenue trend for this customer
  const monthlyRevenue = useMemo(() => {
    return computeMonthlyRevenue(customerOrders).map((m) => ({
      ...m,
      label: formatMonthShort(m.month),
    }));
  }, [customerOrders]);

  // Top products for this customer
  const topProducts = useMemo(() => {
    if (!data) return [];
    const productMap = new Map();
    data.products.forEach((p) => productMap.set(p.product_id, p));

    const revenue = {};
    customerLines.forEach((line) => {
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
      .slice(0, 10)
      .map((item) => {
        const product = productMap.get(item.product_id);
        return {
          ...item,
          name: product?.name || 'Unknown',
          sku: product?.sku || '',
          category: product?.category_l1 || '',
        };
      });
  }, [data, customerLines]);

  // Sorted + paginated orders (include cancelled for full history)
  const allOrders = useMemo(() => {
    if (!data) return [];
    return data.orders.filter((o) => o.customer_id === customerId);
  }, [data, customerId]);

  const sortedOrders = useMemo(() => {
    const sorted = [...allOrders].sort((a, b) => {
      const aVal = a[orderSort.key];
      const bVal = b[orderSort.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return orderSort.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      return orderSort.dir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [allOrders, orderSort]);

  const totalOrderPages = Math.max(1, Math.ceil(sortedOrders.length / ORDERS_PER_PAGE));
  const pagedOrders = sortedOrders.slice(
    (orderPage - 1) * ORDERS_PER_PAGE,
    orderPage * ORDERS_PER_PAGE
  );

  const handleSort = (key) => {
    setOrderSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
    setOrderPage(1);
  };

  const sortIcon = (key) => {
    if (orderSort.key !== key) return ' \u2195';
    return orderSort.dir === 'asc' ? ' \u2191' : ' \u2193';
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Data</h3>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Customer Map
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h3 className="text-yellow-800 font-semibold text-lg mb-2">Customer Not Found</h3>
          <p className="text-yellow-600 text-sm">
            No customer with ID {id} exists in the database.
          </p>
        </div>
      </div>
    );
  }

  const typeColor = CUSTOMER_TYPE_COLORS[customer.customer_type] || '#666';

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Customer Map
      </Link>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Color indicator + name */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
              style={{ backgroundColor: typeColor }}
            >
              {customer.company_name?.charAt(0) || '?'}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-800 truncate">{customer.company_name}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: typeColor }}
                >
                  {customerTypeLabel(customer.customer_type)}
                </span>
                <span className="text-xs text-gray-400 font-mono">{customer.account_number}</span>
                <span className={`text-xs font-medium ${customer.status === 'ACTIVE' ? 'text-green-600' : 'text-red-500'}`}>
                  {customer.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Contact</p>
            <p className="text-sm text-gray-800 mt-1">{customer.contact_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Email</p>
            <p className="text-sm text-gray-800 mt-1 truncate">{customer.email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Phone</p>
            <p className="text-sm text-gray-800 mt-1">{customer.phone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Location</p>
            <p className="text-sm text-gray-800 mt-1">
              {customer.city}, {customer.state} {customer.zip}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Address</p>
            <p className="text-sm text-gray-800 mt-1">{customer.address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Payment Terms</p>
            <p className="text-sm text-gray-800 mt-1">{customer.payment_terms || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Credit Limit</p>
            <p className="text-sm text-gray-800 mt-1">{formatCurrency(customer.credit_limit)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Customer Since</p>
            <p className="text-sm text-gray-800 mt-1">{formatDate(customer.created_date)}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">Total Revenue</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(kpis.totalRevenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">Total Orders</p>
          <p className="text-2xl font-bold mt-1">{formatNumber(kpis.orderCount)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-green-200">Avg Order Value</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(kpis.avgOrder)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#d4a84b] to-[#c9a227] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-yellow-100">Gross Margin</p>
          <p className="text-2xl font-bold mt-1">{formatPercent(kpis.margin)}</p>
        </div>
      </div>

      {/* Revenue Trend */}
      {monthlyRevenue.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#737373' }}
                interval={Math.max(0, Math.floor(monthlyRevenue.length / 12) - 1)}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke={typeColor}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Orders + Top Products side by side on large screens */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Order History Table (2/3 width) */}
        <div className="xl:col-span-2 bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Order History ({formatNumber(allOrders.length)})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th
                    className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('order_date')}
                  >
                    Date{sortIcon('order_date')}
                  </th>
                  <th
                    className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('order_number')}
                  >
                    Order #{sortIcon('order_number')}
                  </th>
                  <th
                    className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('total')}
                  >
                    Total{sortIcon('total')}
                  </th>
                  <th
                    className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none"
                    onClick={() => handleSort('margin')}
                  >
                    Margin{sortIcon('margin')}
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Payment
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm text-gray-500">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="py-2 px-3 text-sm font-mono text-[#1e3a5f]">
                      {order.order_number}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrencyFull(order.total)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600 text-right">
                      {formatPercent(order.margin)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusClass(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
                {pagedOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalOrderPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {(orderPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(orderPage * ORDERS_PER_PAGE, sortedOrders.length)} of {sortedOrders.length}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                  disabled={orderPage === 1}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalOrderPages, 5) }, (_, i) => {
                  let page;
                  if (totalOrderPages <= 5) {
                    page = i + 1;
                  } else if (orderPage <= 3) {
                    page = i + 1;
                  } else if (orderPage >= totalOrderPages - 2) {
                    page = totalOrderPages - 4 + i;
                  } else {
                    page = orderPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setOrderPage(page)}
                      className={`px-3 py-1 text-sm rounded-lg border ${
                        page === orderPage
                          ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                  disabled={orderPage === totalOrderPages}
                  className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Top Products (1/3 width) */}
        <div className="xl:col-span-1 bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Products</h3>
          {topProducts.length > 0 ? (
            <ul className="space-y-3">
              {topProducts.map((product, index) => (
                <li key={product.product_id} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-gray-400 mt-0.5 w-5 text-right flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate" title={product.name}>
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-gray-400">{product.sku}</span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-xs text-gray-500">{product.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm font-medium text-gray-800">
                        {formatCurrency(product.revenue)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatNumber(product.units)} units
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No purchase data</p>
          )}
        </div>
      </div>
    </div>
  );
}
