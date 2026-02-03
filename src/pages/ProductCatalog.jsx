import React, { useState, useEffect, useMemo } from 'react';
import { loadCSV } from '../utils/dataLoader';
import {
  formatCurrencyFull,
  formatPercent,
  formatNumber,
  getMarginBadgeClass,
} from '../utils/formatters';
import { ProductCatalogSkeleton } from '../components/Skeleton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 25;

// ---------------------------------------------------------------------------
// Sort Header Button
// ---------------------------------------------------------------------------
function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const isActive = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 group focus:outline-2 focus:outline-[#1e3a5f] focus:outline-offset-2 rounded"
    >
      <span>{label}</span>
      <span className={`transition-colors ${isActive ? 'text-[#1e3a5f]' : 'text-gray-300 group-hover:text-gray-400'}`}>
        {isActive && sortDir === 'asc' ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        ) : isActive && sortDir === 'desc' ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 7l3-3 3 3m0 6l-3 3-3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ProductCatalog Component
// ---------------------------------------------------------------------------
export default function ProductCatalog() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryL1, setCategoryL1] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Pagination
  const [page, setPage] = useState(1);

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------
  useEffect(() => {
    loadCSV('products.csv')
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // -----------------------------------------------------------------------
  // Unique categories for filter dropdown
  // -----------------------------------------------------------------------
  const categoriesL1 = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category_l1).filter(Boolean))];
    return cats.sort();
  }, [products]);

  // -----------------------------------------------------------------------
  // Filtered + Sorted products
  // -----------------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    const lowerSearch = search.toLowerCase();

    return products
      .filter((p) => {
        // Search filter: name, SKU, or manufacturer
        const matchSearch =
          !search ||
          (p.name && p.name.toLowerCase().includes(lowerSearch)) ||
          (p.sku && p.sku.toLowerCase().includes(lowerSearch)) ||
          (p.manufacturer && p.manufacturer.toLowerCase().includes(lowerSearch));

        // Category L1 filter
        const matchCategory = !categoryL1 || p.category_l1 === categoryL1;

        return matchSearch && matchCategory;
      })
      .sort((a, b) => {
        const mult = sortDir === 'asc' ? 1 : -1;

        let aVal, bVal;
        if (sortField === 'margin') {
          // Compute margin on the fly for sorting
          aVal = a.price > 0 ? (a.price - a.cost) / a.price : 0;
          bVal = b.price > 0 ? (b.price - b.cost) / b.price : 0;
        } else {
          aVal = a[sortField];
          bVal = b[sortField];
        }

        // Handle null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        // Numeric comparison for price
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return (aVal - bVal) * mult;
        }

        // String comparison
        return String(aVal).localeCompare(String(bVal)) * mult;
      });
  }, [products, search, categoryL1, sortField, sortDir]);

  // -----------------------------------------------------------------------
  // Pagination logic
  // -----------------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageProducts = filteredProducts.slice(startIndex, startIndex + PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, categoryL1]);

  // -----------------------------------------------------------------------
  // Sort handler
  // -----------------------------------------------------------------------
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (loading) return <ProductCatalogSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Products</h3>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="text-gray-500 text-xs mt-3">
          Ensure products.csv is present in the /data/ directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Product Catalog</h2>
        <p className="text-gray-500 text-sm mt-1">
          Browse and search {formatNumber(products.length)} products across all categories
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by name, SKU, or manufacturer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-sm"
              aria-label="Search products"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryL1}
            onChange={(e) => setCategoryL1(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none text-sm min-w-[180px]"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categoriesL1.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {(search || categoryL1) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryL1('');
              }}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600" aria-live="polite">
          Showing{' '}
          <span className="font-medium text-gray-800">
            {filteredProducts.length === 0
              ? '0'
              : `${startIndex + 1}-${Math.min(startIndex + PAGE_SIZE, filteredProducts.length)}`}
          </span>{' '}
          of <span className="font-medium text-gray-800">{formatNumber(filteredProducts.length)}</span>{' '}
          products
        </p>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Product catalog with sortable columns</caption>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  <SortHeader
                    label="SKU"
                    field="sku"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  <SortHeader
                    label="Name"
                    field="name"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">
                  <SortHeader
                    label="Manufacturer"
                    field="manufacturer"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">
                  <SortHeader
                    label="Category"
                    field="category_l1"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  <SortHeader
                    label="Price"
                    field="price"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">
                  <SortHeader
                    label="Margin"
                    field="margin"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
                <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">
                  <SortHeader
                    label="Status"
                    field="status"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {pageProducts.map((product) => {
                const margin =
                  product.price > 0
                    ? (product.price - product.cost) / product.price
                    : 0;

                return (
                  <tr
                    key={product.product_id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-sm font-mono text-[#1e3a5f]">
                      {product.sku}
                    </td>
                    <td
                      className="py-2.5 px-3 text-sm text-gray-800 font-medium max-w-[220px] truncate"
                      title={product.name}
                    >
                      {product.name}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-600 hidden md:table-cell">
                      {product.manufacturer}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-500 hidden lg:table-cell">
                      {product.category_l1}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrencyFull(product.price)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-right hidden sm:table-cell">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(margin)}`}
                      >
                        {formatPercent(margin)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-sm text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          product.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : product.status === 'discontinued'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {product.status
                          ? product.status.charAt(0).toUpperCase() + product.status.slice(1)
                          : 'N/A'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {pageProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400 text-sm">
                    <svg
                      className="w-10 h-10 mx-auto mb-3 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    No products match your search criteria.
                    <br />
                    Try adjusting your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {safePage} of {totalPages}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="px-2.5 py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="First page"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2.5 py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                Prev
              </button>

              {/* Page number buttons */}
              {(() => {
                const pages = [];
                let start = Math.max(1, safePage - 2);
                let end = Math.min(totalPages, start + 4);
                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPage(i)}
                      className={`px-2.5 py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-xs font-medium rounded border transition-colors ${
                        i === safePage
                          ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2.5 py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="px-2.5 py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Last page"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
