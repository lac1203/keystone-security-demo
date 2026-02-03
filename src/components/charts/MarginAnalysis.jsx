import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { SEMANTIC_COLORS } from './colors';

const formatPercent = (value) => `${(value * 100).toFixed(1)}%`;

/**
 * Get bar color based on margin health relative to target.
 * Green if at/above target, gold if close, red if below.
 */
const getMarginColor = (actual, target) => {
  const ratio = actual / target;
  if (ratio >= 1.0) return SEMANTIC_COLORS.positive;
  if (ratio >= 0.85) return SEMANTIC_COLORS.warning;
  return SEMANTIC_COLORS.negative;
};

/**
 * Custom tooltip for margin chart
 */
function MarginTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const data = entry.payload;

  const diff = data.actualMargin - data.targetMargin;
  const diffLabel = diff >= 0 ? 'above' : 'below';

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <div className="space-y-1">
        <p className="text-gray-600">
          Actual: <span className="font-medium text-gray-800">{formatPercent(data.actualMargin)}</span>
        </p>
        <p className="text-gray-600">
          Target: <span className="font-medium text-gray-800">{formatPercent(data.targetMargin)}</span>
        </p>
        <p className={`font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatPercent(Math.abs(diff))} {diffLabel} target
        </p>
      </div>
    </div>
  );
}

/**
 * MarginAnalysis - Horizontal bar chart comparing actual vs target margins
 *
 * @param {Array<{category: string, actualMargin: number, targetMargin: number}>} data
 * @param {number} [height=300] - Chart height in pixels
 */
export default function MarginAnalysis({ data = [], height = 300 }) {
  // Sort data by actual margin descending
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => b.actualMargin - a.actualMargin);
  }, [data]);

  // Calculate average target for reference line
  const avgTarget = useMemo(() => {
    if (!data || data.length === 0) return 0.35;
    return data.reduce((sum, d) => sum + d.targetMargin, 0) / data.length;
  }, [data]);

  // Handle empty state
  if (!sortedData || sortedData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Margin by Category</h3>
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
        <h3 className="text-lg font-semibold text-gray-800">Margin by Category</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEMANTIC_COLORS.positive }} />
            <span>At/Above Target</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEMANTIC_COLORS.warning }} />
            <span>Near Target</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEMANTIC_COLORS.negative }} />
            <span>Below Target</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            horizontal={false}
            vertical={true}
          />
          <XAxis
            type="number"
            tickFormatter={formatPercent}
            domain={[0, 0.6]}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 12, fill: '#4a4a4a' }}
            width={110}
          />
          <Tooltip content={<MarginTooltip />} />
          <ReferenceLine
            x={avgTarget}
            stroke={SEMANTIC_COLORS.warning}
            strokeWidth={2}
            strokeDasharray="5 5"
            label={{
              value: `Avg Target ${formatPercent(avgTarget)}`,
              position: 'top',
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          <Bar
            dataKey="actualMargin"
            radius={[0, 4, 4, 0]}
            name="Actual Margin"
            barSize={24}
          >
            {sortedData.map((entry) => (
              <Cell
                key={entry.category}
                fill={getMarginColor(entry.actualMargin, entry.targetMargin)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
