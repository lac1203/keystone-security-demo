import React, { useState, useMemo } from 'react';
import { CHART_COLORS } from './colors';

/**
 * Default column formatters
 */
const defaultFormatters = {
  currency: (value) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value),
  percent: (value) => `${(value * 100).toFixed(1)}%`,
  number: (value) =>
    typeof value === 'number' ? value.toLocaleString() : value,
};

/**
 * Rank badge for top 3 positions
 */
function RankBadge({ rank }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold text-sm">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold text-sm">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 text-gray-500 text-sm">
      {rank}
    </span>
  );
}

/**
 * Sort indicator arrow
 */
function SortIndicator({ direction }) {
  if (!direction) return null;
  return (
    <span className="ml-1 text-gray-400">
      {direction === 'asc' ? '\u25B2' : '\u25BC'}
    </span>
  );
}

/**
 * TopProducts (TopItemsTable) - Reusable ranked table component
 *
 * @param {Array<Record<string, any>>} data - Row data
 * @param {Array<{key: string, label: string, format?: (value: any) => string, align?: 'left'|'right'|'center'}>} columns - Column definitions
 * @param {string} [title='Top Products'] - Table title
 * @param {number} [limit=10] - Max rows to display per page
 */
export default function TopProducts({ data = [], columns = [], title = 'Top Products', limit = 10 }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);

  // Handle sort toggling
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  };

  // Sort and paginate data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    let sorted = [...data];
    if (sortKey) {
      sorted.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDir === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }
    return sorted;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / limit));
  const pageData = processedData.slice(page * limit, (page + 1) * limit);

  // Handle empty state
  if (!data || data.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div className="flex items-center justify-center text-gray-400 h-40">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className="text-sm text-gray-500">
          {processedData.length} item{processedData.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-2.5 text-gray-600 font-medium text-center w-12">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-gray-600 font-medium cursor-pointer hover:text-gray-800 select-none ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && <SortIndicator direction={sortDir} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, rowIndex) => {
              const rank = page * limit + rowIndex + 1;
              return (
                <tr
                  key={row.product_id || row.id || rowIndex}
                  className="hover:bg-gray-50 border-b border-gray-100 transition-colors"
                >
                  <td className="px-3 py-2.5 text-center">
                    <RankBadge rank={rank} />
                  </td>
                  {columns.map((col) => {
                    const rawValue = row[col.key];
                    const formatted = col.format
                      ? col.format(rawValue)
                      : typeof rawValue === 'number'
                      ? rawValue.toLocaleString()
                      : rawValue;

                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        } ${rowIndex < 3 ? 'font-medium' : ''}`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
