import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadAllData, getOrderLines } from '../utils/dataLoader';
import {
  formatCurrencyFull,
  formatNumber,
  formatPercent,
  formatDate,
  getOrderStatusClass,
  getPaymentStatusClass,
  customerTypeLabel,
  getMarginBadgeClass,
} from '../utils/formatters';
import { CUSTOMER_TYPE_COLORS } from '../components/charts/colors';

// ---------------------------------------------------------------------------
// Loading Spinner
// ---------------------------------------------------------------------------
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrderDetail Component
// ---------------------------------------------------------------------------
export default function OrderDetail() {
  const { id } = useParams();
  const orderId = Number(id);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAllData()
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  // Find the order
  const order = useMemo(() => {
    if (!data) return null;
    return data.orders.find((o) => o.order_id === orderId) || null;
  }, [data, orderId]);

  // Find the customer
  const customer = useMemo(() => {
    if (!data || !order) return null;
    return data.customers.find((c) => c.customer_id === order.customer_id) || null;
  }, [data, order]);

  // Get line items
  const lineItems = useMemo(() => {
    if (!data || !order) return [];
    return getOrderLines(data.orderLines, data.products, orderId);
  }, [data, order, orderId]);

  // Margin breakdown by category
  const categoryBreakdown = useMemo(() => {
    const byCategory = {};
    lineItems.forEach((line) => {
      const cat = line.category || 'Unknown';
      if (!byCategory[cat]) {
        byCategory[cat] = { category: cat, revenue: 0, cost: 0, items: 0 };
      }
      byCategory[cat].revenue += line.line_total || 0;
      byCategory[cat].cost += line.line_cost || 0;
      byCategory[cat].items += 1;
    });
    return Object.values(byCategory).sort((a, b) => b.revenue - a.revenue);
  }, [lineItems]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h3 className="text-red-800 font-semibold text-lg mb-2">Error Loading Data</h3>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h3 className="text-yellow-800 font-semibold text-lg mb-2">Order Not Found</h3>
          <p className="text-yellow-600 text-sm">
            No order with ID {id} exists in the database.
          </p>
        </div>
      </div>
    );
  }

  const orderMargin = order.total > 0 ? (order.total - order.total_cost) / order.total : 0;
  const typeColor = customer ? (CUSTOMER_TYPE_COLORS[customer.customer_type] || '#666') : '#666';

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-[#1e3a5f] hover:underline font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      {/* Order Header */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-800 font-mono">
                {order.order_number}
              </h2>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getOrderStatusClass(order.status)}`}>
                {order.status}
              </span>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusClass(order.payment_status)}`}>
                {order.payment_status}
              </span>
            </div>
            {order.po_number && (
              <p className="text-sm text-gray-500 mt-1">PO: {order.po_number}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">{formatCurrencyFull(order.total)}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(order.order_date)}
            </p>
          </div>
        </div>

        {/* Order + Customer Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Order Date</p>
            <p className="text-sm text-gray-800 mt-1">{formatDate(order.order_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Ship Date</p>
            <p className="text-sm text-gray-800 mt-1">{formatDate(order.ship_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Customer</p>
            {customer ? (
              <Link
                to={`/customers/${customer.customer_id}`}
                className="text-sm text-[#1e3a5f] hover:underline font-medium mt-1 inline-block"
              >
                {customer.company_name}
              </Link>
            ) : (
              <p className="text-sm text-gray-800 mt-1">Unknown</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Customer Type</p>
            {customer ? (
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-medium text-white mt-1"
                style={{ backgroundColor: typeColor }}
              >
                {customerTypeLabel(customer.customer_type)}
              </span>
            ) : (
              <p className="text-sm text-gray-800 mt-1">—</p>
            )}
          </div>
        </div>
      </div>

      {/* Financial Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">Subtotal</p>
          <p className="text-xl font-bold mt-1">{formatCurrencyFull(order.subtotal)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">Tax</p>
          <p className="text-xl font-bold mt-1">{formatCurrencyFull(order.tax)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-blue-200">Freight</p>
          <p className="text-xl font-bold mt-1">{formatCurrencyFull(order.freight)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white rounded-xl p-5 shadow-md">
          <p className="text-xs uppercase tracking-wide font-medium text-green-200">Cost</p>
          <p className="text-xl font-bold mt-1">{formatCurrencyFull(order.total_cost)}</p>
        </div>
        <div className="bg-gradient-to-br from-[#d4a84b] to-[#c9a227] text-white rounded-xl p-5 shadow-md col-span-2 lg:col-span-1">
          <p className="text-xs uppercase tracking-wide font-medium text-yellow-100">Margin</p>
          <p className="text-xl font-bold mt-1">{formatPercent(orderMargin)}</p>
          <p className="text-xs text-yellow-100 mt-1">
            {formatCurrencyFull(order.total - order.total_cost)} profit
          </p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Line Items ({formatNumber(lineItems.length)})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <caption className="sr-only">Order line items</caption>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">SKU</th>
                <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Category</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Unit Cost</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase">Line Total</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Margin</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line) => {
                const lineMargin = line.line_total > 0
                  ? (line.line_total - line.line_cost) / line.line_total
                  : 0;
                return (
                  <tr key={line.line_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-sm text-gray-400">{line.line_number}</td>
                    <td className="py-2 px-3 text-sm text-gray-800 font-medium max-w-[200px] truncate" title={line.product_name}>
                      {line.product_name}
                    </td>
                    <td className="py-2 px-3 text-sm font-mono text-gray-500 hidden sm:table-cell">
                      {line.sku}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500 hidden md:table-cell">
                      {line.category}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right">
                      {formatNumber(line.quantity)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right">
                      {formatCurrencyFull(line.unit_price)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-500 text-right hidden sm:table-cell">
                      {formatCurrencyFull(line.unit_cost)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-800 text-right font-medium">
                      {formatCurrencyFull(line.line_total)}
                    </td>
                    <td className="py-2 px-3 text-right hidden lg:table-cell">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(lineMargin)}`}>
                        {formatPercent(lineMargin)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {lineItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                    No line items found
                  </td>
                </tr>
              )}
            </tbody>
            {lineItems.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-medium border-t border-gray-200">
                  <td className="py-2.5 px-3 text-sm text-gray-800" colSpan={4}>
                    Total ({lineItems.length} items)
                  </td>
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right">
                    {formatNumber(lineItems.reduce((s, l) => s + (l.quantity || 0), 0))}
                  </td>
                  <td className="py-2.5 px-3 hidden sm:table-cell" />
                  <td className="py-2.5 px-3 hidden sm:table-cell" />
                  <td className="py-2.5 px-3 text-sm text-gray-800 text-right font-medium">
                    {formatCurrencyFull(lineItems.reduce((s, l) => s + (l.line_total || 0), 0))}
                  </td>
                  <td className="py-2.5 px-3 text-right hidden lg:table-cell">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(orderMargin)}`}>
                      {formatPercent(orderMargin)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Margin by Category */}
      {categoryBreakdown.length > 1 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Margin by Category</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryBreakdown.map((cat) => {
              const catMargin = cat.revenue > 0 ? (cat.revenue - cat.cost) / cat.revenue : 0;
              const share = order.subtotal > 0 ? cat.revenue / order.subtotal : 0;
              return (
                <div key={cat.category} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800">{cat.category}</h4>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getMarginBadgeClass(catMargin)}`}>
                      {formatPercent(catMargin)}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenue</span>
                      <span className="text-gray-800 font-medium">{formatCurrencyFull(cat.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cost</span>
                      <span className="text-gray-800">{formatCurrencyFull(cat.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Profit</span>
                      <span className="text-[#2e8b57] font-medium">{formatCurrencyFull(cat.revenue - cat.cost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Items</span>
                      <span className="text-gray-800">{cat.items}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Share</span>
                      <span className="text-gray-800">{formatPercent(share)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
