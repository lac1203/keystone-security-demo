import React from 'react';

/**
 * Reusable pagination component.
 * @param {number} currentPage - Current active page (1-based)
 * @param {number} totalPages - Total number of pages
 * @param {function} onPageChange - Callback with new page number
 * @param {number} totalItems - Total number of items (for "Showing X-Y of Z" text)
 * @param {number} pageSize - Items per page
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Compute visible page numbers (up to 5)
  let rangeStart = Math.max(1, currentPage - 2);
  let rangeEnd = Math.min(totalPages, rangeStart + 4);
  if (rangeEnd - rangeStart < 4) {
    rangeStart = Math.max(1, rangeEnd - 4);
  }

  const pages = [];
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 text-sm rounded-lg border ${
              page === currentPage
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
