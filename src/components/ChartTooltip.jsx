import React from 'react';
import { formatCurrency } from '../utils/formatters';

/**
 * Reusable Recharts tooltip component.
 * @param {function} formatter - Value formatter (default: formatCurrency)
 */
export default function ChartTooltip({ active, payload, label, formatter = formatCurrency }) {
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
            {formatter(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
