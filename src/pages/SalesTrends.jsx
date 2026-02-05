import React, { useState, useEffect, useMemo } from 'react';
import {
  loadAllData,
  computeMonthlyRevenue,
  getTopCustomers,
  getTopProducts,
  getYearsFromOrders,
} from '../utils/dataLoader';
import { MONTH_NAMES, DAY_COLORS } from '../utils/constants';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatMonthShort,
  customerTypeLabel,
} from '../utils/formatters';
import { CHART_COLORS } from '../components/charts/colors';
import { SalesTrendsSkeleton } from '../components/Skeleton';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Tooltip Components
// ---------------------------------------------------------------------------
function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  // Sort payload by year name descending (most recent first)
  const sorted = [...payload].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {sorted.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      {sorted.length >= 2 && sorted[0].value && sorted[1].value && (
        <div className="mt-1 pt-1 border-t border-gray-100">
          <span className="text-gray-500">YoY ({sorted[1].name}&rarr;{sorted[0].name}): </span>
          <span
            className={`font-medium ${
              sorted[0].value >= sorted[1].value
                ? 'text-[#2e8b57]'
                : 'text-[#c44536]'
            }`}
          >
            {sorted[1].value > 0
              ? `${(
                  ((sorted[0].value - sorted[1].value) / sorted[1].value) *
                  100
                ).toFixed(1)}%`
              : 'N/A'}
          </span>
        </div>
      )}
    </div>
  );
}

function DayOfWeekTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex justify-between gap-4">
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {entry.dataKey === 'avgRevenue'
              ? formatCurrency(entry.value)
              : formatNumber(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: compute YoY comparison data (aligned by calendar month)
// ---------------------------------------------------------------------------
function computeMultiYearComparison(orders, years) {
  // Accumulate revenue per year per month
  const byYearMonth = {};
  orders.forEach((o) => {
    if (o.status === 'CANCELLED') return;
    const date = o.order_date;
    if (!date) return;
    const year = date.substring(0, 4);
    if (!years.includes(year)) return;
    const mm = date.substring(5, 7);

    if (!byYearMonth[year]) byYearMonth[year] = {};
    if (!byYearMonth[year][mm]) byYearMonth[year][mm] = { revenue: 0, orders: 0 };
    byYearMonth[year][mm].revenue += o.total || 0;
    byYearMonth[year][mm].orders += 1;
  });

  const result = [];
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    const row = { month: MONTH_NAMES[m - 1], monthNum: m };
    years.forEach((y) => {
      row[y] = byYearMonth[y]?.[mm]?.revenue || 0;
    });
    result.push(row);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: compute day-of-week distribution
// ---------------------------------------------------------------------------
function computeDayOfWeek(orders) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const stats = dayNames.map((name, i) => ({
    day: dayShort[i],
    dayFull: name,
    orders: 0,
    revenue: 0,
    dayIndex: i,
  }));

  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date) return;
    const dow = new Date(o.order_date).getDay();
    stats[dow].orders += 1;
    stats[dow].revenue += o.total || 0;
  });

  // Reorder to start with Monday
  const reordered = [...stats.slice(1), stats[0]];
  return reordered.map((d) => ({
    ...d,
    avgRevenue: d.orders > 0 ? d.revenue / d.orders : 0,
  }));
}

// ---------------------------------------------------------------------------
// Helper: compute monthly seasonality index
// ---------------------------------------------------------------------------
function computeSeasonality(monthlyRevenue) {
  if (!monthlyRevenue || monthlyRevenue.length === 0) return [];

  const avgRevenue =
    monthlyRevenue.reduce((s, m) => s + m.revenue, 0) / monthlyRevenue.length;

  const byCalMonth = {};
  monthlyRevenue.forEach((m) => {
    const mm = m.month.substring(5, 7);
    if (!byCalMonth[mm]) byCalMonth[mm] = [];
    byCalMonth[mm].push(m.revenue);
  });

  return MONTH_NAMES.map((name, i) => {
    const mm = String(i + 1).padStart(2, '0');
    const values = byCalMonth[mm] || [];
    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    const index = avgRevenue > 0 ? avg / avgRevenue : 0;
    return { month: name, index, avgRevenue: avg };
  });
}

// ---------------------------------------------------------------------------
// SalesTrends Component
// ---------------------------------------------------------------------------
export default function SalesTrends() {
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

  // Detect years dynamically from order dates
  const { years, year1, year2 } = useMemo(() => {
    if (!data) return { years: [], year1: '', year2: '' };
    const allYears = getYearsFromOrders(data.orders);
    return {
      years: allYears,
      year1: allYears.length >= 2 ? allYears[allYears.length - 2] : allYears[0] || '',
      year2: allYears[allYears.length - 1] || '',
    };
  }, [data]);

  // Computed data
  const monthlyRevenue = useMemo(() => {
    if (!data) return [];
    return computeMonthlyRevenue(data.orders);
  }, [data]);

  const yoyData = useMemo(() => {
    if (!data || years.length === 0) return [];
    return computeMultiYearComparison(data.orders, years);
  }, [data, years]);

  const dayOfWeekData = useMemo(() => {
    if (!data) return [];
    return computeDayOfWeek(data.orders);
  }, [data]);

  const seasonalityData = useMemo(() => {
    return computeSeasonality(monthlyRevenue);
  }, [monthlyRevenue]);

  const topCustomers = useMemo(() => {
    if (!data) return [];
    return getTopCustomers(data.orders, data.customers, 10);
  }, [data]);

  const topProducts = useMemo(() => {
    if (!data) return [];
    return getTopProducts(data.orderLines, data.products, 10);
  }, [data]);

  // Summary KPIs
  const summaryKPIs = useMemo(() => {
    if (!data) return null;
    const activeOrders = data.orders.filter((o) => o.status !== 'CANCELLED');
    const y1 = activeOrders.filter((o) => o.order_date?.startsWith(year1));
    const y2 = activeOrders.filter((o) => o.order_date?.startsWith(year2));
    const y1Rev = y1.reduce((s, o) => s + (o.total || 0), 0);
    const y2Rev = y2.reduce((s, o) => s + (o.total || 0), 0);
    const yoyGrowth = y1Rev > 0 ? (y2Rev - y1Rev) / y1Rev : 0;

    // Best and worst months
    const best = monthlyRevenue.reduce(
      (b, m) => (m.revenue > b.revenue ? m : b),
      monthlyRevenue[0] || { month: '', revenue: 0 }
    );
    const worst = monthlyRevenue.reduce(
      (w, m) => (m.revenue < w.revenue ? m : w),
      monthlyRevenue[0] || { month: '', revenue: 0 }
    );

    return { y1Rev, y2Rev, yoyGrowth, bestMonth: best, worstMonth: worst };
  }, [data, monthlyRevenue, year1, year2]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) return <SalesTrendsSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Data</h3>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Sales Trends</h2>
        <p className="text-gray-500 text-sm mt-1">
          Deep-dive analytics across {monthlyRevenue.length} months of sales data
        </p>
      </div>

      {/* Summary Cards */}
      {summaryKPIs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
            <p className="text-xs uppercase tracking-wide font-medium text-blue-200">
              {year1} Revenue
            </p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summaryKPIs.y1Rev)}</p>
          </div>
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
            <p className="text-xs uppercase tracking-wide font-medium text-blue-200">
              {year2} Revenue
            </p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summaryKPIs.y2Rev)}</p>
            <p className="text-xs text-blue-200 mt-2">
              {summaryKPIs.yoyGrowth >= 0 ? '+' : ''}
              {formatPercent(summaryKPIs.yoyGrowth)} YoY
            </p>
          </div>
          <div className="bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white rounded-xl p-5 shadow-md">
            <p className="text-xs uppercase tracking-wide font-medium text-green-200">
              Best Month
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatMonthShort(summaryKPIs.bestMonth.month)}
            </p>
            <p className="text-xs text-green-200 mt-2">
              {formatCurrency(summaryKPIs.bestMonth.revenue)}
            </p>
          </div>
          <div className="bg-white border border-gray-100 text-gray-800 rounded-xl p-5 shadow-md">
            <p className="text-xs uppercase tracking-wide font-medium text-gray-500">
              Slowest Month
            </p>
            <p className="text-2xl font-bold mt-1">
              {formatMonthShort(summaryKPIs.worstMonth.month)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {formatCurrency(summaryKPIs.worstMonth.revenue)}
            </p>
          </div>
        </div>
      )}

      {/* YoY Revenue Comparison */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Year-over-Year Revenue Comparison
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={yoyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#737373' }}
            />
            <YAxis
              tickFormatter={(v) =>
                v >= 1000000
                  ? `$${(v / 1000000).toFixed(1)}M`
                  : `$${(v / 1000).toFixed(0)}K`
              }
              tick={{ fontSize: 11, fill: '#737373' }}
            />
            <Tooltip content={<CurrencyTooltip />} />
            <Legend />
            {[...years].reverse().map((y, i) => {
              const isMostRecent = i === 0;
              return (
                <Line
                  key={y}
                  type="monotone"
                  dataKey={y}
                  name={y}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={isMostRecent ? 2.5 : 2}
                  strokeDasharray={isMostRecent ? undefined : '5 5'}
                  dot={{ r: isMostRecent ? 4 : 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={isMostRecent ? { r: 6 } : undefined}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonality + Day of Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasonality Index */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Seasonality Index</h3>
          <p className="text-xs text-gray-500 mb-4">
            Average monthly revenue relative to overall mean (1.0 = average)
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={seasonalityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <YAxis
                domain={[0, 1.5]}
                tickFormatter={(v) => v.toFixed(1)}
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <Tooltip
                formatter={(value, name) => [
                  name === 'index' ? value.toFixed(2) : formatCurrency(value),
                  name === 'index' ? 'Seasonality Index' : 'Avg Revenue',
                ]}
                contentStyle={{ borderRadius: '8px', fontSize: '13px' }}
              />
              <Bar dataKey="index" name="index" radius={[4, 4, 0, 0]} barSize={28}>
                {seasonalityData.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={
                      entry.index >= 1.1
                        ? '#4a7c59'
                        : entry.index >= 0.9
                        ? '#d4a84b'
                        : '#c44536'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#4a7c59]" />
              <span>Above Avg</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#d4a84b]" />
              <span>Near Avg</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-[#c44536]" />
              <span>Below Avg</span>
            </div>
          </div>
        </div>

        {/* Day of Week Distribution */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Day-of-Week Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">
            Order count and average order value by day of the week
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dayOfWeekData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12, fill: '#737373' }}
              />
              <YAxis
                yAxisId="orders"
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <YAxis
                yAxisId="avgRev"
                orientation="right"
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <Tooltip content={<DayOfWeekTooltip />} />
              <Legend />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                name="Orders"
                radius={[4, 4, 0, 0]}
                barSize={28}
              >
                {dayOfWeekData.map((entry, index) => (
                  <Cell key={entry.day} fill={DAY_COLORS[index % DAY_COLORS.length]} />
                ))}
              </Bar>
              <Line
                yAxisId="avgRev"
                type="monotone"
                dataKey="avgRevenue"
                name="Avg Revenue"
                stroke={CHART_COLORS[2]}
                strokeWidth={2}
                dot={{ r: 4, fill: CHART_COLORS[2] }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Customers + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Customers */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Customers</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Top 10 customers ranked by revenue</caption>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Customer
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Revenue
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Orders
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr
                    key={customer.customer_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3 text-sm text-gray-400 font-medium">
                      {index + 1}
                    </td>
                    <td
                      className="py-2 px-3 text-sm text-gray-800 font-medium max-w-[160px] truncate"
                      title={customer.company_name}
                    >
                      {customer.company_name}
                    </td>
                    <td className="py-2 px-3 text-sm">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {customerTypeLabel(customer.customer_type)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrency(customer.revenue)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500 text-right">
                      {formatNumber(customer.orders)}
                    </td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                      No customer data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Products */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Products</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <caption className="sr-only">Top 10 products ranked by revenue</caption>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Category
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Revenue
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                    Units
                  </th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, index) => (
                  <tr
                    key={product.product_id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3 text-sm text-gray-400 font-medium">
                      {index + 1}
                    </td>
                    <td
                      className="py-2 px-3 text-sm text-gray-800 font-medium max-w-[160px] truncate"
                      title={product.name}
                    >
                      {product.name}
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
                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                      No product data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
