import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS, CUSTOMER_TYPE_COLORS, CUSTOMER_TYPE_LABELS } from './colors';

const formatMonth = (period) => {
  if (!period) return '';
  const [year, m] = period.split('-');
  if (!year || !m) return period;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${monthNames[parseInt(m, 10) - 1]} '${year.slice(2)}`;
};

/**
 * Custom tooltip for order volume chart
 */
function VolumeTooltip({ active, payload, label, stacked }) {
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
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
      {stacked && payload.length > 1 && (
        <div className="mt-1 pt-1 border-t border-gray-100">
          <span className="text-gray-500">Total: </span>
          <span className="font-medium text-gray-800">
            {payload.reduce((sum, e) => sum + (e.value || 0), 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * OrderVolume - Bar chart showing order volume over time
 *
 * @param {Array<{period: string, orders: number, byType?: Record<string, number>}>} data
 * @param {'daily'|'weekly'|'monthly'} [aggregation='monthly'] - Aggregation level
 * @param {number} [height=300] - Chart height in pixels
 * @param {boolean} [stacked=false] - Stack bars by customer type
 */
export default function OrderVolume({ data = [], aggregation = 'monthly', height = 300, stacked = false }) {
  // Compute average orders for reference line
  const avgOrders = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const total = data.reduce((sum, d) => sum + (d.orders || 0), 0);
    return Math.round(total / data.length);
  }, [data]);

  // Determine customer type keys if stacked mode
  const typeKeys = useMemo(() => {
    if (!stacked || !data || data.length === 0) return [];
    const keys = new Set();
    data.forEach((d) => {
      if (d.byType) {
        Object.keys(d.byType).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys).sort();
  }, [data, stacked]);

  // Flatten byType into top-level keys for stacking
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!stacked) return data;
    return data.map((d) => ({
      ...d,
      ...(d.byType || {}),
    }));
  }, [data, stacked]);

  // Handle empty state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Order Volume</h3>
        <div
          className="flex items-center justify-center text-gray-400"
          style={{ height }}
        >
          No data available
        </div>
      </div>
    );
  }

  const CUSTOMER_TYPE_ORDER = ['LSH', 'INT', 'PMG', 'RET'];

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Order Volume</h3>
        <span className="text-sm text-gray-500">
          Avg: {avgOrders.toLocaleString()} orders/{aggregation === 'monthly' ? 'mo' : aggregation === 'weekly' ? 'wk' : 'day'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="period"
            tickFormatter={formatMonth}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip content={<VolumeTooltip stacked={stacked} />} />
          <Legend />
          <ReferenceLine
            y={avgOrders}
            stroke={CHART_COLORS[2]}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            label={{
              value: `Avg ${avgOrders}`,
              position: 'right',
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          {stacked && typeKeys.length > 0 ? (
            CUSTOMER_TYPE_ORDER
              .filter((key) => typeKeys.includes(key))
              .map((key) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="orders"
                  fill={CUSTOMER_TYPE_COLORS[key] || CHART_COLORS[0]}
                  name={CUSTOMER_TYPE_LABELS[key] || key}
                  radius={[0, 0, 0, 0]}
                />
              ))
          ) : (
            <Bar
              dataKey="orders"
              fill={CHART_COLORS[0]}
              radius={[4, 4, 0, 0]}
              name="Orders"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
