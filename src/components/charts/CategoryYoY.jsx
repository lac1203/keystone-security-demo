import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { CHART_COLORS } from './colors';

// Year colors: most recent = navy, middle = green, oldest = gold
const YEAR_COLORS = [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[2]];

function YoYTooltip({ active, payload, label, years }) {
  if (!active || !payload?.length) return null;
  // Sort by year descending
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
            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(entry.value)}
          </span>
        </div>
      ))}
      {sorted.length >= 2 && (
        <div className="mt-1 pt-1 border-t border-gray-100 space-y-0.5">
          {sorted.slice(0, -1).map((entry, i) => {
            const prev = sorted[i + 1];
            if (!prev || !prev.value) return null;
            const change = ((entry.value - prev.value) / prev.value) * 100;
            return (
              <div key={`yoy-${i}`}>
                <span className="text-gray-500">{prev.name}&rarr;{entry.name}: </span>
                <span className={`font-medium ${change >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CategoryYoY({
  data = [],
  years = [],
  categories = [],
  selectedCategory,
  onCategoryChange,
  height = 350,
}) {
  // Assign colors: most recent year first in the color array
  const reversedYears = [...years].reverse();
  const yearColorMap = {};
  reversedYears.forEach((y, i) => {
    yearColorMap[y] = YEAR_COLORS[i % YEAR_COLORS.length];
  });

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h3 className="text-lg font-semibold text-gray-800">
          Category Revenue Year-over-Year
        </h3>
        <select
          value={selectedCategory || ''}
          onChange={(e) => onCategoryChange(e.target.value || null)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
          <Tooltip content={<YoYTooltip years={years} />} />
          <Legend />
          {years.map((y) => (
            <Bar
              key={y}
              dataKey={y}
              name={y}
              fill={yearColorMap[y]}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
