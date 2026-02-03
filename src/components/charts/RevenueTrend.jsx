import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from './colors';

/**
 * Format a currency value for axis labels.
 * Values >= 1M show as "$1.5M", otherwise "$150K".
 */
const formatCurrencyAxis = (value) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

/**
 * Format a currency value for tooltips (more detail).
 */
const formatCurrencyTooltip = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

/**
 * Format month string "2023-01" into "Jan '23"
 */
const formatMonth = (month) => {
  if (!month) return '';
  const [year, m] = month.split('-');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${monthNames[parseInt(m, 10) - 1]} '${year.slice(2)}`;
};

/**
 * Custom tooltip component for the revenue chart.
 */
function CustomTooltip({ active, payload, label, showComparison }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{formatMonth(label)}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">
            {formatCurrencyTooltip(entry.value)}
          </span>
        </div>
      ))}
      {showComparison && payload.length >= 2 && payload[0].value && payload[1].value && (
        <div className="mt-1 pt-1 border-t border-gray-100">
          <span className="text-gray-500">YoY Change: </span>
          <span
            className={`font-medium ${
              payload[0].value >= payload[1].value ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {payload[1].value > 0
              ? `${(((payload[0].value - payload[1].value) / payload[1].value) * 100).toFixed(1)}%`
              : 'N/A'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * RevenueTrend - Line chart showing monthly revenue over 24 months
 *
 * @param {Array<{month: string, revenue: number, orders: number, prevYearRevenue?: number}>} data
 * @param {number} [height=300] - Chart height in pixels
 * @param {boolean} [showComparison=false] - Show previous year comparison line
 */
export default function RevenueTrend({ data = [], height = 300, showComparison = false }) {
  // Compute a 3-month moving average for trend line
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => {
      let movingAvg = null;
      if (index >= 2) {
        movingAvg =
          (data[index].revenue + data[index - 1].revenue + data[index - 2].revenue) / 3;
      }
      return { ...item, movingAvg };
    });
  }, [data]);

  // Handle empty state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Trend</h3>
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
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonth}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCurrencyAxis}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip content={<CustomTooltip showComparison={showComparison} />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[0], strokeWidth: 2, r: 3 }}
            activeDot={{ r: 6, fill: CHART_COLORS[0] }}
            name="Revenue"
          />
          {showComparison && (
            <Line
              type="monotone"
              dataKey="prevYearRevenue"
              stroke={CHART_COLORS[2]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Previous Year"
            />
          )}
          <Line
            type="monotone"
            dataKey="movingAvg"
            stroke={CHART_COLORS[1]}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            dot={false}
            name="3-Mo Avg"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
