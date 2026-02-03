import React, { useState, useEffect, useMemo } from 'react';
import {
  loadAllData,
  computeMonthlyRevenue,
  computeCategoryBreakdown,
  getRecentOrders,
  getTopProducts,
} from '../utils/dataLoader';
import {
  formatCurrency,
  formatCurrencyFull,
  formatNumber,
  formatPercent,
  formatDate,
  formatMonthShort,
  getOrderStatusClass,
  getPaymentStatusClass,
  getTrendColor,
  getMarginBadgeClass,
} from '../utils/formatters';
import { CHART_COLORS, CATEGORY_COLORS } from '../components/charts/colors';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
// KPI Card
// ---------------------------------------------------------------------------
function KPICard({ label, value, subtext, variant = 'primary' }) {
  const baseClasses =
    variant === 'primary'
      ? 'bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white'
      : variant === 'secondary'
      ? 'bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white'
      : variant === 'accent'
      ? 'bg-gradient-to-br from-[#d4a84b] to-[#c9a227] text-white'
      : 'bg-white border border-gray-100 text-gray-800';

  const labelClasses =
    variant === 'default'
      ? 'text-gray-500'
      : variant === 'accent'
      ? 'text-yellow-100'
      : 'text-blue-200';

  const subtextClasses =
    variant === 'default'
      ? 'text-gray-400'
      : variant === 'accent'
      ? 'text-yellow-100'
      : 'text-blue-200';

  return (
    <div className={`rounded-xl p-5 shadow-md ${baseClasses}`}>
      <p className={`text-xs uppercase tracking-wide font-medium ${labelClasses}`}>
        {label}
      </p>
      <p className="text-2xl lg:text-3xl font-bold mt-1">{value}</p>
      {subtext && (
        <p className={`text-xs mt-2 ${subtextClasses}`}>{subtext}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Recharts Tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload, label, isCurrency = true }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}:</span>
          <span className="font-medium">
            {isCurrency ? formatCurrency(entry.value) : formatNumber(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllData()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Computed values
  const kpis = useMemo(() => {
    if (!data) return null;
    const { orders, customers, products } = data;
    const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');

    const totalRevenue = activeOrders.reduce((s, o) => s + (o.total || 0), 0);
    const totalCost = activeOrders.reduce((s, o) => s + (o.total_cost || 0), 0);
    const totalOrders = activeOrders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const grossMargin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;

    // YoY split: detect years dynamically from order dates
    const years = [...new Set(activeOrders.map((o) => o.order_date?.substring(0, 4)).filter(Boolean))].sort();
    const year1 = years.length >= 2 ? years[years.length - 2] : years[0];
    const year2 = years[years.length - 1];
    const y1Orders = activeOrders.filter((o) => o.order_date?.startsWith(year1));
    const y2Orders = activeOrders.filter((o) => o.order_date?.startsWith(year2));
    const y1Revenue = y1Orders.reduce((s, o) => s + (o.total || 0), 0);
    const y2Revenue = y2Orders.reduce((s, o) => s + (o.total || 0), 0);
    const yoyGrowth = y1Revenue > 0 ? (y2Revenue - y1Revenue) / y1Revenue : 0;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers: customers.length,
      avgOrderValue,
      grossMargin,
      yoyGrowth,
      totalProducts: products.length,
      y1Revenue,
      y2Revenue,
      year1,
      year2,
      firstYear: years[0],
    };
  }, [data]);

  const monthlyRevenue = useMemo(() => {
    if (!data) return [];
    return computeMonthlyRevenue(data.orders);
  }, [data]);

  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    return computeCategoryBreakdown(data.orderLines, data.products);
  }, [data]);

  const recentOrders = useMemo(() => {
    if (!data) return [];
    return getRecentOrders(data.orders, data.customers, 10);
  }, [data]);

  const topProducts = useMemo(() => {
    if (!data) return [];
    return getTopProducts(data.orderLines, data.products, 10);
  }, [data]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Data</h3>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="text-gray-500 text-xs mt-3">
          Ensure data files are present in the /data/ directory.
        </p>
      </div>
    );
  }

  // Prepare chart data for category pie
  const categoryPieData = categoryBreakdown.map((c) => ({
    name: c.category,
    value: c.revenue,
    margin: c.revenue > 0 ? (c.revenue - c.cost) / c.revenue : 0,
  }));

  // Monthly revenue chart with formatted labels
  const monthlyChartData = monthlyRevenue.map((m) => ({
    ...m,
    label: formatMonthShort(m.month),
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Executive Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">
          {kpis ? `${monthlyRevenue.length}-month overview — January ${kpis.firstYear} through December ${kpis.year2}` : 'Overview'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          subtext={`YoY: ${kpis.yoyGrowth >= 0 ? '+' : ''}${formatPercent(kpis.yoyGrowth)}`}
          variant="primary"
        />
        <KPICard
          label="Total Orders"
          value={formatNumber(kpis.totalOrders)}
          subtext={`${formatNumber(kpis.totalProducts)} products`}
          variant="primary"
        />
        <KPICard
          label="Active Customers"
          value={formatNumber(kpis.totalCustomers)}
          subtext="6-state territory"
          variant="secondary"
        />
        <KPICard
          label="Avg Order Value"
          value={formatCurrency(kpis.avgOrderValue)}
          subtext="per order"
          variant="secondary"
        />
        <KPICard
          label="Gross Margin"
          value={formatPercent(kpis.grossMargin)}
          subtext={`on ${formatCurrency(kpis.totalRevenue)} revenue`}
          variant="accent"
        />
      </div>

      {/* Revenue Trend Chart */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#737373' }}
              interval={1}
            />
            <YAxis
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
              tick={{ fontSize: 11, fill: '#737373' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={CHART_COLORS[0]}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Pie Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={categoryPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={{ stroke: '#b3b3b3' }}
              >
                {categoryPieData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={CATEGORY_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Orders Table */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Orders</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm font-mono text-[#1e3a5f]">
                      {order.order_number}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-700 max-w-[160px] truncate" title={order.customer_name}>
                      {order.customer_name}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500">
                      {formatDate(order.order_date)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrencyFull(order.total)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusClass(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Products by Revenue</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Units</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={product.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-sm text-gray-400 font-medium">
                    {index + 1}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-800 font-medium max-w-[200px] truncate" title={product.name}>
                    {product.name}
                  </td>
                  <td className="py-2 px-3 text-sm font-mono text-gray-500">
                    {product.sku}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500">
                    {product.category}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-800 text-right font-medium">
                    {formatCurrency(product.revenue)}
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-500 text-right">
                    {formatNumber(product.units)}
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    No product data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
