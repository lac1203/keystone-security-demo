import React, { useState, useEffect, useMemo } from 'react';
import {
  loadAllData,
  computeCategoryBreakdown,
  computeMonthlyRevenue,
  computeCategoryYoY,
} from '../utils/dataLoader';
import { CategoryYoY } from '../components/charts';
import {
  formatCurrency,
  formatCurrencyFull,
  formatNumber,
  formatPercent,
  getMarginBadgeClass,
} from '../utils/formatters';
import { CHART_COLORS, CATEGORY_COLORS } from '../components/charts/colors';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
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
// Tooltip Components
// ---------------------------------------------------------------------------
function RevenueTooltip({ active, payload, label }) {
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
    </div>
  );
}

function MarginTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex justify-between gap-4">
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {formatPercent(entry.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function MixTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + (e.value || 0), 0);
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
          <span className="text-gray-400 text-xs">
            ({total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute category revenue by month for stacked area chart */
function computeCategoryMixByMonth(orderLines, products, orders) {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  // Build order date lookup
  const orderDateMap = new Map();
  orders.forEach((o) => {
    if (o.status !== 'CANCELLED') {
      orderDateMap.set(o.order_id, o.order_date?.substring(0, 7));
    }
  });

  const data = {};
  orderLines.forEach((line) => {
    const month = orderDateMap.get(line.order_id);
    if (!month) return;
    const product = productMap.get(line.product_id);
    const cat = product?.category_l1 || 'Unknown';

    if (!data[month]) data[month] = { month };
    data[month][cat] = (data[month][cat] || 0) + (line.line_total || 0);
  });

  return Object.values(data).sort((a, b) => a.month.localeCompare(b.month));
}

/** Compute subcategory breakdown */
function computeSubcategoryBreakdown(orderLines, products) {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  const bySubcat = {};
  orderLines.forEach((line) => {
    const product = productMap.get(line.product_id);
    if (!product) return;
    const catL1 = product.category_l1 || 'Unknown';
    const catL2 = product.category_l2 || 'Unknown';
    const key = `${catL1}|${catL2}`;

    if (!bySubcat[key]) {
      bySubcat[key] = {
        category_l1: catL1,
        category_l2: catL2,
        revenue: 0,
        cost: 0,
        units: 0,
        lineCount: 0,
      };
    }
    bySubcat[key].revenue += line.line_total || 0;
    bySubcat[key].cost += line.line_cost || 0;
    bySubcat[key].units += line.quantity || 0;
    bySubcat[key].lineCount += 1;
  });

  return Object.values(bySubcat)
    .map((s) => ({
      ...s,
      margin: s.revenue > 0 ? (s.revenue - s.cost) / s.revenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// Target margins from CLAUDE.md
const MARGIN_TARGETS = {
  'Residential Locks': 0.30,
  'Commercial Hardware': 0.375,
  'Access Control': 0.425,
  'Automotive': 0.425,
  'Safes & Security': 0.40,
  'Key Machines & Supplies': 0.375,
};

// ---------------------------------------------------------------------------
// CategoryPerformance Component
// ---------------------------------------------------------------------------
export default function CategoryPerformance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [yoyCategoryFilter, setYoyCategoryFilter] = useState(null);

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

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    return computeCategoryBreakdown(data.orderLines, data.products).map((c) => ({
      ...c,
      margin: c.revenue > 0 ? (c.revenue - c.cost) / c.revenue : 0,
      targetMargin: MARGIN_TARGETS[c.category] || 0.35,
    }));
  }, [data]);

  // Margin chart data
  const marginData = useMemo(() => {
    return categoryBreakdown.map((c) => ({
      category: c.category,
      actualMargin: c.margin,
      targetMargin: c.targetMargin,
    }));
  }, [categoryBreakdown]);

  // Category mix over time
  const categoryMixData = useMemo(() => {
    if (!data) return [];
    return computeCategoryMixByMonth(data.orderLines, data.products, data.orders);
  }, [data]);

  // Categories list (for stacked area)
  const categories = useMemo(() => {
    return categoryBreakdown.map((c) => c.category);
  }, [categoryBreakdown]);

  // Subcategory breakdown
  const subcategoryData = useMemo(() => {
    if (!data) return [];
    return computeSubcategoryBreakdown(data.orderLines, data.products);
  }, [data]);

  // Category YoY data
  const categoryYoYResult = useMemo(() => {
    if (!data) return { data: [], years: [], categories: [] };
    return computeCategoryYoY(data.orderLines, data.products, data.orders, yoyCategoryFilter);
  }, [data, yoyCategoryFilter]);

  // Subcategories filtered by expanded category
  const filteredSubcategories = useMemo(() => {
    if (!expandedCategory) return subcategoryData;
    return subcategoryData.filter((s) => s.category_l1 === expandedCategory);
  }, [subcategoryData, expandedCategory]);

  // Total revenue for share calculation
  const totalRevenue = useMemo(() => {
    return categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
  }, [categoryBreakdown]);

  // Format month label
  const formatMonth = (month) => {
    if (!month) return '';
    const [year, m] = month.split('-');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${names[parseInt(m, 10) - 1]} '${year.slice(2)}`;
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Category Performance</h2>
        <p className="text-gray-500 text-sm mt-1">
          Revenue, margins, and trends across {categories.length} product categories
        </p>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryBreakdown.map((cat) => {
          const share = totalRevenue > 0 ? cat.revenue / totalRevenue : 0;
          const color = CATEGORY_COLORS[cat.category] || CHART_COLORS[0];

          return (
            <div
              key={cat.category}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-5 cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === cat.category ? null : cat.category
                )
              }
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <h4 className="text-sm font-semibold text-gray-800">{cat.category}</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatCurrency(cat.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Share</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatPercent(share)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Margin</p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(cat.margin)}`}
                  >
                    {formatPercent(cat.margin)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Units Sold</p>
                  <p className="text-sm font-medium text-gray-700">
                    {formatNumber(cat.units)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue by Category + Margin by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Bar Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={categoryBreakdown}
              margin={{ top: 5, right: 10, left: 10, bottom: 50 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: '#737373' }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tickFormatter={(v) =>
                  v >= 1000000
                    ? `$${(v / 1000000).toFixed(1)}M`
                    : `$${(v / 1000).toFixed(0)}K`
                }
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Bar
                dataKey="revenue"
                name="Revenue"
                radius={[4, 4, 0, 0]}
                barSize={40}
              >
                {categoryBreakdown.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={CATEGORY_COLORS[entry.category] || CHART_COLORS[0]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Margin Comparison */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Margin vs Target</h3>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#1e3a5f]" />
                <span>Actual</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-[#d4a84b] opacity-60" />
                <span>Target</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={marginData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 0.6]}
                tick={{ fontSize: 11, fill: '#737373' }}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11, fill: '#4a4a4a' }}
                width={95}
              />
              <Tooltip content={<MarginTooltip />} />
              <Bar
                dataKey="actualMargin"
                name="Actual"
                fill={CHART_COLORS[0]}
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
              <Bar
                dataKey="targetMargin"
                name="Target"
                fill={CHART_COLORS[2]}
                radius={[0, 4, 4, 0]}
                barSize={16}
                opacity={0.5}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Mix Over Time */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Category Mix Over Time</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={categoryMixData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={{ fontSize: 11, fill: '#737373' }}
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
            <Tooltip content={<MixTooltip />} />
            <Legend />
            {categories.map((cat, i) => (
              <Area
                key={cat}
                type="monotone"
                dataKey={cat}
                stackId="1"
                name={cat}
                stroke={CATEGORY_COLORS[cat] || CHART_COLORS[i % CHART_COLORS.length]}
                fill={CATEGORY_COLORS[cat] || CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.7}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Category Revenue Year-over-Year */}
      <CategoryYoY
        data={categoryYoYResult.data}
        years={categoryYoYResult.years}
        categories={categoryYoYResult.categories}
        selectedCategory={yoyCategoryFilter}
        onCategoryChange={setYoyCategoryFilter}
      />

      {/* Subcategory Breakdown Table */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h3 className="text-lg font-semibold text-gray-800">Subcategory Breakdown</h3>
          <div className="flex items-center gap-2">
            {expandedCategory && (
              <span className="text-sm text-gray-500">
                Filtered: <span className="font-medium text-gray-800">{expandedCategory}</span>
              </span>
            )}
            {expandedCategory && (
              <button
                type="button"
                onClick={() => setExpandedCategory(null)}
                className="px-3 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
              >
                Show All
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  Subcategory
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  Revenue
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  Cost
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  Margin
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  Units
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSubcategories.map((sub) => {
                const share = totalRevenue > 0 ? sub.revenue / totalRevenue : 0;
                const color = CATEGORY_COLORS[sub.category_l1] || '#737373';

                return (
                  <tr
                    key={`${sub.category_l1}-${sub.category_l2}`}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-gray-600">{sub.category_l1}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 font-medium">
                      {sub.category_l2}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrency(sub.revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden sm:table-cell">
                      {formatCurrency(sub.cost)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(sub.margin)}`}
                      >
                        {formatPercent(sub.margin)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden md:table-cell">
                      {formatNumber(sub.units)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 text-right hidden lg:table-cell">
                      {formatPercent(share)}
                    </td>
                  </tr>
                );
              })}
              {filteredSubcategories.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">
                    No subcategory data available
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
