import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, CATEGORY_COLORS } from './colors';

/**
 * Format currency for display
 */
const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const formatCurrencyCompact = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

/**
 * Custom pie chart label renderer
 */
const renderPieLabel = ({ name, percent }) => {
  if (percent < 0.05) return null; // Skip tiny slices
  return `${name}: ${(percent * 100).toFixed(1)}%`;
};

/**
 * Custom tooltip for pie view
 */
function PieTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-800">{entry.name}</p>
      <p className="text-gray-600">Revenue: {formatCurrency(entry.value)}</p>
      {entry.payload.orderCount !== undefined && (
        <p className="text-gray-600">Orders: {entry.payload.orderCount.toLocaleString()}</p>
      )}
      {entry.payload.margin !== undefined && (
        <p className="text-gray-600">Margin: {formatPercent(entry.payload.margin)}</p>
      )}
    </div>
  );
}

/**
 * Custom tooltip for bar view
 */
function BarTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {entry.dataKey === 'margin'
              ? formatPercent(entry.value)
              : formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * CategoryBreakdown - Dual visualization of category performance (pie + bar)
 *
 * @param {Array<{category: string, revenue: number, cost: number, margin: number, orderCount: number}>} data
 * @param {number} [height=350] - Chart height in pixels
 * @param {'pie'|'bar'} [view] - Initial view mode (defaults to 'pie')
 */
export default function CategoryBreakdown({ data = [], height = 350, view: initialView }) {
  const [activeView, setActiveView] = useState(initialView || 'pie');

  // Sort data by revenue descending for bar chart
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  // Get color for each category
  const getColor = (category, index) =>
    CATEGORY_COLORS[category] || CHART_COLORS[index % CHART_COLORS.length];

  // Handle empty state
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Category</h3>
        <div
          className="flex items-center justify-center text-gray-400"
          style={{ height }}
        >
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Revenue by Category</h3>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setActiveView('pie')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              activeView === 'pie'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pie
          </button>
          <button
            onClick={() => setActiveView('bar')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              activeView === 'bar'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        {activeView === 'pie' ? (
          <PieChart>
            <Pie
              data={sortedData}
              dataKey="revenue"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={Math.min(height * 0.35, 120)}
              innerRadius={Math.min(height * 0.18, 55)}
              label={renderPieLabel}
              labelLine={{ stroke: '#6b7280' }}
              paddingAngle={2}
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={entry.category}
                  fill={getColor(entry.category, index)}
                />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
            <Legend
              formatter={(value) => (
                <span className="text-sm text-gray-700">{value}</span>
              )}
            />
          </PieChart>
        ) : (
          <BarChart
            data={sortedData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              yAxisId="revenue"
              tickFormatter={formatCurrencyCompact}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              yAxisId="margin"
              orientation="right"
              tickFormatter={formatPercent}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              domain={[0, 0.6]}
            />
            <Tooltip content={<BarTooltip />} />
            <Legend />
            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              fill={CHART_COLORS[0]}
              radius={[4, 4, 0, 0]}
              name="Revenue"
            >
              {sortedData.map((entry, index) => (
                <Cell
                  key={entry.category}
                  fill={getColor(entry.category, index)}
                />
              ))}
            </Bar>
            <Bar
              yAxisId="margin"
              dataKey="margin"
              fill={CHART_COLORS[2]}
              radius={[4, 4, 0, 0]}
              name="Margin"
              opacity={0.7}
            />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
