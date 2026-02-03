import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { loadCSV } from '../utils/dataLoader';
import { formatNumber, customerTypeLabel } from '../utils/formatters';
import { CUSTOMER_TYPE_COLORS, CUSTOMER_TYPE_LABELS } from '../components/charts/colors';
import CustomerMap from '../components/charts/CustomerMap';
import { CustomerMapSkeleton } from '../components/Skeleton';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CUSTOMER_TYPES = ['LSH', 'INT', 'PMG', 'RET'];

// ---------------------------------------------------------------------------
// CustomerMapPage Component
// ---------------------------------------------------------------------------
export default function CustomerMapPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters: which customer types are selected (all on by default)
  const [selectedTypes, setSelectedTypes] = useState(new Set(CUSTOMER_TYPES));

  // Selected customer from marker click
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Search within customer list
  const [listSearch, setListSearch] = useState('');

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------
  useEffect(() => {
    loadCSV('customers.csv')
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load customers:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // -----------------------------------------------------------------------
  // Toggle a customer type filter
  // -----------------------------------------------------------------------
  const toggleType = useCallback((type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTypes(new Set(CUSTOMER_TYPES));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedTypes(new Set());
  }, []);

  // -----------------------------------------------------------------------
  // Filtered customers
  // -----------------------------------------------------------------------
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => selectedTypes.has(c.customer_type));
  }, [customers, selectedTypes]);

  // Customers for the sidebar list (further filtered by search)
  const listCustomers = useMemo(() => {
    if (!listSearch) return filteredCustomers;
    const lower = listSearch.toLowerCase();
    return filteredCustomers.filter(
      (c) =>
        (c.company_name && c.company_name.toLowerCase().includes(lower)) ||
        (c.city && c.city.toLowerCase().includes(lower)) ||
        (c.state && c.state.toLowerCase().includes(lower)) ||
        (c.account_number && c.account_number.toLowerCase().includes(lower))
    );
  }, [filteredCustomers, listSearch]);

  // -----------------------------------------------------------------------
  // Summary counts by type
  // -----------------------------------------------------------------------
  const typeCounts = useMemo(() => {
    const counts = {};
    CUSTOMER_TYPES.forEach((t) => (counts[t] = 0));
    customers.forEach((c) => {
      if (counts[c.customer_type] !== undefined) {
        counts[c.customer_type]++;
      }
    });
    return counts;
  }, [customers]);

  // State-level counts for the filtered set
  const stateCounts = useMemo(() => {
    const counts = {};
    filteredCustomers.forEach((c) => {
      counts[c.state] = (counts[c.state] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredCustomers]);

  // -----------------------------------------------------------------------
  // Marker click handler
  // -----------------------------------------------------------------------
  const handleMarkerClick = useCallback((customer) => {
    setSelectedCustomer(customer);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (loading) return <CustomerMapSkeleton />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Customers</h3>
        <p className="text-red-600 text-sm">{error}</p>
        <p className="text-gray-500 text-xs mt-3">
          Ensure customers.csv is present in the /data/ directory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Customer Map</h2>
        <p className="text-gray-500 text-sm mt-1">
          Geographic view of {formatNumber(customers.length)} customer accounts across the Mid-Atlantic region
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CUSTOMER_TYPES.map((type) => (
          <div
            key={type}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: CUSTOMER_TYPE_COLORS[type] + '20' }}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: CUSTOMER_TYPE_COLORS[type] }}
              />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-800">{typeCounts[type]}</p>
              <p className="text-xs text-gray-500">{CUSTOMER_TYPE_LABELS[type]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content: Map + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Area (2/3 width on desktop) */}
        <div className="lg:col-span-2">
          {/* Filter Checkboxes */}
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mb-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Filter by Type:</span>
              {CUSTOMER_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTypes.has(type)}
                    onChange={() => toggleType(type)}
                    className="w-4 h-4 rounded border-gray-300 focus:ring-[#1e3a5f]"
                    style={{ accentColor: CUSTOMER_TYPE_COLORS[type] }}
                  />
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CUSTOMER_TYPE_COLORS[type] }}
                  />
                  <span className="text-sm text-gray-600">{CUSTOMER_TYPE_LABELS[type]}</span>
                </label>
              ))}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-[#1e3a5f] hover:underline font-medium px-2 py-1"
                >
                  All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-[#1e3a5f] hover:underline font-medium px-2 py-1"
                >
                  None
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2" aria-live="polite">
              Showing {formatNumber(filteredCustomers.length)} of {formatNumber(customers.length)} customers
            </p>
          </div>

          {/* Map Component */}
          <CustomerMap
            customers={filteredCustomers}
            height={typeof window !== 'undefined' && window.innerWidth < 640 ? 350 : 500}
            onMarkerClick={handleMarkerClick}
          />

          {/* State Breakdown */}
          {stateCounts.length > 0 && (
            <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 mt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Customers by State</h4>
              <div className="flex flex-wrap gap-3">
                {stateCounts.map(([state, count]) => (
                  <div
                    key={state}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-sm font-bold text-[#1e3a5f]">{state}</span>
                    <span className="text-sm text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Customer List Sidebar (1/3 width on desktop) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">
                Customer List ({formatNumber(listCustomers.length)})
              </h3>
              <div className="relative">
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
                  placeholder="Search customers..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
                  aria-label="Search customer list"
                />
              </div>
            </div>

            {/* Scrollable Customer List */}
            <div className="overflow-y-auto max-h-[600px]">
              {listCustomers.length === 0 ? (
                <div className="py-10 text-center text-gray-400 text-sm">
                  No customers match current filters
                </div>
              ) : (
                <ul className="divide-y divide-gray-100" role="listbox" aria-label="Customer list">
                  {listCustomers.map((customer) => {
                    const isSelected =
                      selectedCustomer &&
                      selectedCustomer.customer_id === customer.customer_id;

                    return (
                      <li
                        key={customer.customer_id}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border-l-2 border-[#1e3a5f]' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedCustomer(customer)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedCustomer(customer);
                          }
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                            style={{
                              backgroundColor:
                                CUSTOMER_TYPE_COLORS[customer.customer_type] || '#666',
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {customer.company_name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {customer.city}, {customer.state}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                style={{
                                  backgroundColor:
                                    CUSTOMER_TYPE_COLORS[customer.customer_type] || '#666',
                                }}
                              >
                                {customerTypeLabel(customer.customer_type)}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {customer.account_number}
                              </span>
                              <Link
                                to={`/customers/${customer.customer_id}`}
                                className="text-[10px] text-[#1e3a5f] hover:underline font-medium ml-auto"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Details &rarr;
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
