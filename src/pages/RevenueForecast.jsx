import React, { useState, useEffect, useMemo } from 'react';
import {
  loadForecast,
  loadAllData,
  computeMonthlyRevenue,
} from '../utils/dataLoader';
import {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatNumber,
} from '../utils/formatters';
import { CHART_COLORS, CATEGORY_COLORS } from '../components/charts/colors';
import LoadingSpinner from '../components/LoadingSpinner';
import ChartTooltip from '../components/ChartTooltip';
import { MONTH_NAMES } from '../utils/constants';
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
  ReferenceLine,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------
function CategoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
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
      {payload.length === 2 && payload[0].value > 0 && payload[1].value > 0 && (
        <div className="mt-1 pt-1 border-t border-gray-100">
          <span className="text-gray-500">Growth: </span>
          <span
            className={`font-medium ${
              payload[0].value >= payload[1].value ? 'text-[#2e8b57]' : 'text-[#c44536]'
            }`}
          >
            {((payload[0].value - payload[1].value) / payload[1].value * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variance decomposition helper
// ---------------------------------------------------------------------------
function computeVarianceDecomposition(prior, actual) {
  const priorUnitValue = prior.volume > 0 ? prior.revenue / prior.volume : 0;
  const actualUnitValue = actual.volume > 0 ? actual.revenue / actual.volume : 0;
  const totalVar = actual.revenue - prior.revenue;
  const volumeVar = (actual.volume - prior.volume) * priorUnitValue;
  const priceVar = (actualUnitValue - priorUnitValue) * prior.volume;
  const mixVar = totalVar - volumeVar - priceVar;
  return { totalVar, volumeVar, priceVar, mixVar };
}

// ---------------------------------------------------------------------------
// RevenueForecast Component
// ---------------------------------------------------------------------------
export default function RevenueForecast() {
  const [forecast, setForecast] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [forecastMode, setForecastMode] = useState('full_year');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    Promise.all([loadForecast(), loadAllData()])
      .then(([fc, data]) => {
        setForecast(fc);
        setHistoricalData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Active forecast mode data
  const activeMode = useMemo(() => {
    if (!forecast?.modes) return null;
    return forecast.modes[forecastMode] || forecast.modes.full_year;
  }, [forecast, forecastMode]);

  // Historical monthly revenue
  const monthlyRevenue = useMemo(() => {
    if (!historicalData) return [];
    return computeMonthlyRevenue(historicalData.orders);
  }, [historicalData]);

  // Combined trend chart: actuals + forecast as continuation
  const trendData = useMemo(() => {
    if (!monthlyRevenue.length || !activeMode) return [];

    // Historical months
    const rows = monthlyRevenue.map((m) => {
      const [y, mm] = m.month.split('-');
      return {
        label: `${MONTH_NAMES[parseInt(mm, 10) - 1]} '${y.slice(2)}`,
        sortKey: m.month,
        actual: m.revenue,
        forecast: null,
      };
    });

    // Last actual month's revenue bridges to forecast
    const lastActual = rows[rows.length - 1];

    // Forecast months
    activeMode.by_month.forEach((fm) => {
      const [y, mm] = fm.month.split('-');
      rows.push({
        label: `${MONTH_NAMES[parseInt(mm, 10) - 1]} '${y.slice(2)}`,
        sortKey: fm.month,
        actual: null,
        forecast: fm.projected_revenue,
      });
    });

    // Bridge: set forecast value on last actual month so the line connects
    if (lastActual) {
      lastActual.forecast = lastActual.actual;
    }

    return rows;
  }, [monthlyRevenue, activeMode]);

  // Category comparison: base year vs forecast
  const categoryComparisonData = useMemo(() => {
    if (!activeMode) return [];
    return activeMode.by_category
      .map((c) => ({
        category: c.category,
        baseYear: c.base_year_revenue,
        forecast: c.projected_revenue,
        growth: c.cagr_pct,
      }))
      .sort((a, b) => b.forecast - a.forecast);
  }, [activeMode]);

  // Monthly forecast by category (for the detail chart)
  const categoryMonthlyData = useMemo(() => {
    if (!activeMode || !selectedCategory) return [];
    const catData = activeMode.by_category.find((c) => c.category === selectedCategory);
    if (!catData) return [];
    return catData.by_month.map((m) => ({
      month: m.month_label,
      forecast: m.projected_revenue,
      seasonality: m.seasonality_index,
    }));
  }, [activeMode, selectedCategory]);

  // Overall monthly forecast (when no category selected)
  const overallMonthlyData = useMemo(() => {
    if (!activeMode || selectedCategory) return [];
    return activeMode.by_month.map((m) => ({
      month: m.month_label,
      forecast: m.projected_revenue,
      seasonality: m.seasonality_index,
    }));
  }, [activeMode, selectedCategory]);

  const monthlyBarData = selectedCategory ? categoryMonthlyData : overallMonthlyData;

  // Top customers data
  const topCustomers = useMemo(() => {
    if (!activeMode?.top_customers) return [];
    return [...activeMode.top_customers].sort((a, b) => b.projected_revenue - a.projected_revenue);
  }, [activeMode]);

  // Selected customer monthly data
  const customerMonthlyData = useMemo(() => {
    if (!activeMode?.top_customers || !selectedCustomer) return [];
    const cust = activeMode.top_customers.find((c) => c.customer_id === selectedCustomer);
    if (!cust) return [];
    return cust.by_month.map((m) => ({
      month: m.month_label,
      forecast: m.projected_revenue,
      seasonality: m.seasonality_index,
    }));
  }, [activeMode, selectedCustomer]);

  const selectedCustomerData = useMemo(() => {
    if (!activeMode?.top_customers || !selectedCustomer) return null;
    return activeMode.top_customers.find((c) => c.customer_id === selectedCustomer) || null;
  }, [activeMode, selectedCustomer]);

  // -------------------------------------------------------------------------
  // Customer Variance Analysis: Prior Year (plan) vs Base Year (actual)
  // -------------------------------------------------------------------------
  const customerVariance = useMemo(() => {
    if (!historicalData || !forecast) return [];
    const baseYear = String(forecast.assumptions.base_year);
    const priorYear = String(Number(baseYear) - 1);
    const { orders } = historicalData;

    // Build per-customer stats for both years
    const stats = {};
    orders.forEach((o) => {
      if (o.status === 'CANCELLED' || !o.order_date) return;
      const yr = o.order_date.substring(0, 4);
      if (yr !== baseYear && yr !== priorYear) return;
      const cid = o.customer_id;
      if (!stats[cid]) stats[cid] = {};
      if (!stats[cid][yr]) stats[cid][yr] = { orders: 0, revenue: 0 };
      stats[cid][yr].orders += 1;
      stats[cid][yr].revenue += o.total || 0;
    });

    // Use the forecast top customers list
    const forecastCustomers = activeMode?.top_customers || [];
    return forecastCustomers.map((fc) => {
      const priorRaw = stats[fc.customer_id]?.[priorYear] || { orders: 0, revenue: 0 };
      const actualRaw = stats[fc.customer_id]?.[baseYear] || { orders: 0, revenue: 0 };
      const variance = computeVarianceDecomposition(
        { volume: priorRaw.orders, revenue: priorRaw.revenue },
        { volume: actualRaw.orders, revenue: actualRaw.revenue },
      );
      const priorAOV = priorRaw.orders > 0 ? priorRaw.revenue / priorRaw.orders : 0;
      const actualAOV = actualRaw.orders > 0 ? actualRaw.revenue / actualRaw.orders : 0;
      return {
        customer_id: fc.customer_id,
        company_name: fc.company_name,
        customer_type: fc.customer_type,
        priorRevenue: priorRaw.revenue,
        actualRevenue: actualRaw.revenue,
        forecastRevenue: fc.projected_revenue,
        priorOrders: priorRaw.orders,
        actualOrders: actualRaw.orders,
        priorAOV,
        actualAOV,
        ...variance,
        priorYear,
        baseYear,
      };
    }).sort((a, b) => b.actualRevenue - a.actualRevenue);
  }, [historicalData, forecast, activeMode]);

  // -------------------------------------------------------------------------
  // Product Variance Analysis: Prior Year (plan) vs Base Year (actual)
  // -------------------------------------------------------------------------
  const productVariance = useMemo(() => {
    if (!historicalData || !forecast) return [];
    const baseYear = String(forecast.assumptions.base_year);
    const priorYear = String(Number(baseYear) - 1);
    const { orders, orderLines, products } = historicalData;

    // Build order-year lookup
    const orderYear = {};
    orders.forEach((o) => {
      if (o.status === 'CANCELLED' || !o.order_date) return;
      const yr = o.order_date.substring(0, 4);
      if (yr === baseYear || yr === priorYear) orderYear[o.order_id] = yr;
    });

    // Aggregate per product per year
    const stats = {};
    orderLines.forEach((l) => {
      const yr = orderYear[l.order_id];
      if (!yr) return;
      const pid = l.product_id;
      if (!stats[pid]) stats[pid] = {};
      if (!stats[pid][yr]) stats[pid][yr] = { qty: 0, revenue: 0 };
      stats[pid][yr].qty += l.quantity || 0;
      stats[pid][yr].revenue += l.line_total || 0;
    });

    // Product lookup and category growth rates from forecast
    const prodMap = {};
    products.forEach((p) => { prodMap[p.product_id] = p; });
    const catGrowth = {};
    (activeMode?.by_category || []).forEach((c) => { catGrowth[c.category] = c.yoy_growth_pct; });

    // Top 10 products by base year revenue
    return Object.entries(stats)
      .filter(([, s]) => s[baseYear])
      .sort((a, b) => (b[1][baseYear]?.revenue || 0) - (a[1][baseYear]?.revenue || 0))
      .slice(0, 10)
      .map(([pid, s]) => {
        const priorRaw = s[priorYear] || { qty: 0, revenue: 0 };
        const actualRaw = s[baseYear] || { qty: 0, revenue: 0 };
        const variance = computeVarianceDecomposition(
          { volume: priorRaw.qty, revenue: priorRaw.revenue },
          { volume: actualRaw.qty, revenue: actualRaw.revenue },
        );
        const priorAvgPrice = priorRaw.qty > 0 ? priorRaw.revenue / priorRaw.qty : 0;
        const actualAvgPrice = actualRaw.qty > 0 ? actualRaw.revenue / actualRaw.qty : 0;
        const product = prodMap[Number(pid)];
        const growth = catGrowth[product?.category_l1] || 0;
        return {
          product_id: Number(pid),
          name: product?.name || 'Unknown',
          sku: product?.sku || '',
          category: product?.category_l1 || '',
          priorRevenue: priorRaw.revenue,
          actualRevenue: actualRaw.revenue,
          forecastRevenue: actualRaw.revenue * (1 + growth / 100),
          priorQty: priorRaw.qty,
          actualQty: actualRaw.qty,
          priorAvgPrice,
          actualAvgPrice,
          ...variance,
          priorYear,
          baseYear,
        };
      });
  }, [historicalData, forecast, activeMode]);

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

  const { assumptions } = forecast;
  const { overall, by_category } = activeMode;
  const avgMonthly = overall.projected_revenue / 12;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">2026 Revenue Forecast</h2>
          <p className="text-gray-500 text-sm mt-1">
            {activeMode.methodology} ({assumptions.historical_years.join(', ')})
          </p>
        </div>
        {/* Forecast Mode Toggle */}
        <div className="inline-flex rounded-lg border border-gray-300 bg-gray-100 p-0.5">
          {Object.entries(forecast.modes).map(([key, mode]) => (
            <button
              key={key}
              onClick={() => setForecastMode(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                forecastMode === key
                  ? 'bg-white text-[#1e3a5f] shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">
            {assumptions.base_year} Actual
          </p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(overall.base_year_revenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">
            2026 Forecast
          </p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(overall.projected_revenue)}</p>
          <p className="text-xs text-blue-200 mt-2">
            +{overall.yoy_growth_pct.toFixed(1)}% YoY
          </p>
        </div>
        <div className="bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-green-200">
            Monthly Avg
          </p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(avgMonthly)}</p>
          <p className="text-xs text-green-200 mt-2">projected</p>
        </div>
        <div className="bg-gradient-to-br from-[#d4a84b] to-[#c9a227] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-yellow-100">
            YoY Growth
          </p>
          <p className="text-2xl font-bold mt-1">+{overall.yoy_growth_pct.toFixed(1)}%</p>
          <p className="text-xs text-yellow-100 mt-2">
            {forecastMode === 'full_year' ? 'compound annual' : 'Q4-weighted'}
          </p>
        </div>
      </div>

      {/* Historical + Forecast Trend Line */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Historical Actuals + 2026 Forecast
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#737373' }}
              interval={2}
            />
            <YAxis
              tickFormatter={(v) =>
                v >= 1000000
                  ? `$${(v / 1000000).toFixed(1)}M`
                  : `$${(v / 1000).toFixed(0)}K`
              }
              tick={{ fontSize: 11, fill: '#737373' }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={CHART_COLORS[0]}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="2026 Forecast"
              stroke={CHART_COLORS[2]}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: CHART_COLORS[2] }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Comparison: Base Year vs Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Category Forecast vs {assumptions.base_year} Actual
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={categoryComparisonData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) =>
                  v >= 1000000
                    ? `$${(v / 1000000).toFixed(1)}M`
                    : `$${(v / 1000).toFixed(0)}K`
                }
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 10, fill: '#4a4a4a' }}
                width={120}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Legend />
              <Bar
                dataKey="forecast"
                name="2026 Forecast"
                fill={CHART_COLORS[0]}
                radius={[0, 4, 4, 0]}
                barSize={14}
              />
              <Bar
                dataKey="baseYear"
                name={`${assumptions.base_year} Actual`}
                fill={CHART_COLORS[2]}
                radius={[0, 4, 4, 0]}
                barSize={14}
                opacity={0.6}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Growth Rates */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Category Growth Rates
          </h3>
          <div className="space-y-3">
            {categoryComparisonData.map((cat) => {
              const color = CATEGORY_COLORS[cat.category] || CHART_COLORS[0];
              const maxGrowth = Math.max(...categoryComparisonData.map((c) => c.growth));
              const barWidth = maxGrowth > 0 ? (cat.growth / maxGrowth) * 100 : 0;
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{cat.category}</span>
                    <span className="text-gray-800 font-semibold">+{cat.growth.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: `${barWidth}%`, backgroundColor: color }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>{formatCurrency(cat.baseYear)}</span>
                    <span>{formatCurrency(cat.forecast)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Monthly Forecast Breakdown */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h3 className="text-lg font-semibold text-gray-800">
            Monthly Forecast Breakdown
          </h3>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
          >
            <option value="">All Categories</option>
            {by_category.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
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
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              y={selectedCategory
                ? (activeMode.by_category.find((c) => c.category === selectedCategory)?.projected_revenue || 0) / 12
                : avgMonthly}
              stroke="#737373"
              strokeDasharray="4 4"
              label={{ value: 'Avg', position: 'right', fontSize: 11, fill: '#737373' }}
            />
            <Bar
              dataKey="forecast"
              name="Forecast"
              radius={[4, 4, 0, 0]}
              barSize={32}
            >
              {monthlyBarData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={
                    entry.seasonality >= 1.1
                      ? CHART_COLORS[0]
                      : entry.seasonality >= 0.9
                      ? CHART_COLORS[1]
                      : CHART_COLORS[2]
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[0] }} />
            <span>Above Avg Season</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[1] }} />
            <span>Near Avg</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[2] }} />
            <span>Below Avg</span>
          </div>
        </div>
      </div>

      {/* Top 10 Customer Forecasts */}
      {topCustomers.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <h3 className="text-lg font-semibold text-gray-800">
              Top 10 Customer Forecasts
            </h3>
            <select
              value={selectedCustomer || ''}
              onChange={(e) => setSelectedCustomer(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
            >
              <option value="">Select a customer...</option>
              {topCustomers.map((c) => (
                <option key={c.customer_id} value={c.customer_id}>
                  {c.company_name} ({formatCurrency(c.projected_revenue)})
                </option>
              ))}
            </select>
          </div>

          {/* Customer monthly chart (shown when a customer is selected) */}
          {selectedCustomerData && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{assumptions.base_year} Actual:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(selectedCustomerData.base_year_revenue)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">2026 Forecast:</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(selectedCustomerData.projected_revenue)}</span>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedCustomerData.yoy_growth_pct >= 0
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {selectedCustomerData.yoy_growth_pct >= 0 ? '+' : ''}{selectedCustomerData.yoy_growth_pct.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {selectedCustomerData.customer_type}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={customerMonthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#737373' }} />
                  <YAxis
                    tickFormatter={(v) =>
                      v >= 1000000
                        ? `$${(v / 1000000).toFixed(1)}M`
                        : `$${(v / 1000).toFixed(0)}K`
                    }
                    tick={{ fontSize: 11, fill: '#737373' }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine
                    y={selectedCustomerData.projected_revenue / 12}
                    stroke="#737373"
                    strokeDasharray="4 4"
                    label={{ value: 'Avg', position: 'right', fontSize: 11, fill: '#737373' }}
                  />
                  <Bar dataKey="forecast" name="Forecast" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Customer summary table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Type</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{assumptions.base_year} Actual</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">2026 Forecast</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Growth</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg/Month</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((cust) => (
                  <tr
                    key={cust.customer_id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedCustomer === cust.customer_id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedCustomer(
                      selectedCustomer === cust.customer_id ? null : cust.customer_id
                    )}
                  >
                    <td className="py-2.5 px-3 text-sm text-gray-800 font-medium">{cust.company_name}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 hidden sm:table-cell">
                      <span className="bg-gray-100 px-2 py-0.5 rounded">{cust.customer_type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right">{formatCurrency(cust.base_year_revenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">{formatCurrency(cust.projected_revenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        cust.yoy_growth_pct >= 0
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {cust.yoy_growth_pct >= 0 ? '+' : ''}{cust.yoy_growth_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden md:table-cell">
                      {formatCurrency(cust.projected_revenue / 12)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Variance Analysis */}
      {customerVariance.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Customer Variance Analysis</h3>
          <p className="text-sm text-gray-500 mb-4">
            {customerVariance[0]?.priorYear} (Plan) vs {customerVariance[0]?.baseYear} (Actual) — decomposed by volume (# orders) and price (avg order value)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{customerVariance[0]?.priorYear} Plan</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{customerVariance[0]?.baseYear} Actual</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Total Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Volume Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Price Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Mix</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Orders</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">AOV</th>
                </tr>
              </thead>
              <tbody>
                {customerVariance.map((c) => (
                  <tr key={c.customer_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-sm text-gray-800 font-medium">
                      <div>{c.company_name}</div>
                      <span className="text-[10px] text-gray-400">{c.customer_type}</span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right">{formatCurrency(c.priorRevenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">{formatCurrency(c.actualRevenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-right font-medium">
                      <span className={c.totalVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {c.totalVar >= 0 ? '+' : ''}{formatCurrency(c.totalVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className={c.volumeVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {c.volumeVar >= 0 ? '+' : ''}{formatCurrency(c.volumeVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className={c.priceVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {c.priceVar >= 0 ? '+' : ''}{formatCurrency(c.priceVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right hidden lg:table-cell">
                      <span className={c.mixVar >= 0 ? 'text-gray-500' : 'text-gray-500'}>
                        {c.mixVar >= 0 ? '+' : ''}{formatCurrency(c.mixVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 text-right hidden xl:table-cell">
                      {c.priorOrders} &rarr; {c.actualOrders}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 text-right hidden xl:table-cell">
                      {formatCurrency(c.priorAOV)} &rarr; {formatCurrency(c.actualAOV)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="py-2.5 px-3 text-sm text-gray-800">Total</td>
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right">{formatCurrency(customerVariance.reduce((s, c) => s + c.priorRevenue, 0))}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right">{formatCurrency(customerVariance.reduce((s, c) => s + c.actualRevenue, 0))}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">
                    {(() => { const t = customerVariance.reduce((s, c) => s + c.totalVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right">
                    {(() => { const t = customerVariance.reduce((s, c) => s + c.volumeVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right">
                    {(() => { const t = customerVariance.reduce((s, c) => s + c.priceVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right hidden lg:table-cell">
                    {(() => { const t = customerVariance.reduce((s, c) => s + c.mixVar, 0); return (
                      <span className="text-gray-500">{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="hidden xl:table-cell" />
                  <td className="hidden xl:table-cell" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Variance Analysis */}
      {productVariance.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-1">Product Variance Analysis</h3>
          <p className="text-sm text-gray-500 mb-4">
            {productVariance[0]?.priorYear} (Plan) vs {productVariance[0]?.baseYear} (Actual) — decomposed by volume (units sold) and price (avg unit price)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{productVariance[0]?.priorYear} Plan</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{productVariance[0]?.baseYear} Actual</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Total Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Volume Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Price Var</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Mix</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Units</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden xl:table-cell">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {productVariance.map((p) => (
                  <tr key={p.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-sm">
                      <div className="text-gray-800 font-medium truncate max-w-[200px]" title={p.name}>{p.name}</div>
                      <span className="text-[10px] text-gray-400 font-mono">{p.sku}</span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right">{formatCurrency(p.priorRevenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">{formatCurrency(p.actualRevenue)}</td>
                    <td className="py-2.5 px-3 text-sm text-right font-medium">
                      <span className={p.totalVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {p.totalVar >= 0 ? '+' : ''}{formatCurrency(p.totalVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className={p.volumeVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {p.volumeVar >= 0 ? '+' : ''}{formatCurrency(p.volumeVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className={p.priceVar >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>
                        {p.priceVar >= 0 ? '+' : ''}{formatCurrency(p.priceVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right hidden lg:table-cell">
                      <span className="text-gray-500">
                        {p.mixVar >= 0 ? '+' : ''}{formatCurrency(p.mixVar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 text-right hidden xl:table-cell">
                      {formatNumber(p.priorQty)} &rarr; {formatNumber(p.actualQty)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 text-right hidden xl:table-cell">
                      {formatCurrencyFull(p.priorAvgPrice)} &rarr; {formatCurrencyFull(p.actualAvgPrice)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="py-2.5 px-3 text-sm text-gray-800">Total</td>
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right">{formatCurrency(productVariance.reduce((s, p) => s + p.priorRevenue, 0))}</td>
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right">{formatCurrency(productVariance.reduce((s, p) => s + p.actualRevenue, 0))}</td>
                  <td className="py-2.5 px-3 text-sm text-right font-medium">
                    {(() => { const t = productVariance.reduce((s, p) => s + p.totalVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right">
                    {(() => { const t = productVariance.reduce((s, p) => s + p.volumeVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right">
                    {(() => { const t = productVariance.reduce((s, p) => s + p.priceVar, 0); return (
                      <span className={t >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}>{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-right hidden lg:table-cell">
                    {(() => { const t = productVariance.reduce((s, p) => s + p.mixVar, 0); return (
                      <span className="text-gray-500">{t >= 0 ? '+' : ''}{formatCurrency(t)}</span>
                    ); })()}
                  </td>
                  <td className="hidden xl:table-cell" />
                  <td className="hidden xl:table-cell" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Category Table */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Category Forecast Detail</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">{assumptions.base_year} Actual</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">2026 Forecast</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Growth</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Share</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Avg/Month</th>
              </tr>
            </thead>
            <tbody>
              {categoryComparisonData.map((cat) => {
                const share = overall.projected_revenue > 0
                  ? cat.forecast / overall.projected_revenue
                  : 0;
                const color = CATEGORY_COLORS[cat.category] || '#737373';
                return (
                  <tr
                    key={cat.category}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCategory(
                      selectedCategory === cat.category ? null : cat.category
                    )}
                  >
                    <td className="py-2.5 px-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-800 font-medium">{cat.category}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right">
                      {formatCurrency(cat.baseYear)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrency(cat.forecast)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        +{cat.growth.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden sm:table-cell">
                      {formatPercent(share)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden md:table-cell">
                      {formatCurrency(cat.forecast / 12)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-medium">
                <td className="py-2.5 px-3 text-sm text-gray-800">Total</td>
                <td className="py-2.5 px-3 text-sm text-gray-800 text-right">
                  {formatCurrency(overall.base_year_revenue)}
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-800 text-right">
                  {formatCurrency(overall.projected_revenue)}
                </td>
                <td className="py-2.5 px-3 text-sm text-right">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                    +{overall.yoy_growth_pct.toFixed(1)}%
                  </span>
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-800 text-right hidden sm:table-cell">
                  100.0%
                </td>
                <td className="py-2.5 px-3 text-sm text-gray-800 text-right hidden md:table-cell">
                  {formatCurrency(overall.projected_revenue / 12)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology Note */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-xs text-gray-500">
        <p className="font-medium text-gray-600 mb-1">Methodology: {activeMode.label}</p>
        <p>
          {activeMode.methodology}. Monthly distribution based on historical seasonality
          indices. Forecast generated {new Date(forecast.generated_at).toLocaleDateString()}.
        </p>
      </div>
    </div>
  );
}
