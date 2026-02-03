/**
 * Format a number as US currency (no decimals).
 * e.g., 19980000 -> "$19,980,000"
 * @param {number} value
 * @returns {string}
 */
export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

/**
 * Format a number as US currency with cents.
 * e.g., 2527.43 -> "$2,527.43"
 * @param {number} value
 * @returns {string}
 */
export const formatCurrencyFull = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

/**
 * Format a decimal as a percentage.
 * e.g., 0.342 -> "34.2%"
 * @param {number} value - Decimal value (0-1 range)
 * @returns {string}
 */
export const formatPercent = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);

/**
 * Format a number with thousands separators.
 * e.g., 7904 -> "7,904"
 * @param {number} value
 * @returns {string}
 */
export const formatNumber = (value) =>
  new Intl.NumberFormat('en-US').format(value);

/**
 * Format a number in compact notation.
 * e.g., 19980000 -> "$20M", 2527 -> "2.5K"
 * @param {number} value
 * @returns {string}
 */
export const formatCompact = (value) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/**
 * Format a date string to a readable format.
 * e.g., "2024-06-15" -> "Jun 15, 2024"
 * @param {string} dateString
 * @returns {string}
 */
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format a month string to a short label.
 * e.g., "2024-06" -> "Jun '24"
 * @param {string} monthStr - 'YYYY-MM' format
 * @returns {string}
 */
export const formatMonthShort = (monthStr) => {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1]} '${year.slice(2)}`;
};

/**
 * Get a Tailwind text color class based on whether a value is positive or negative.
 * @param {number} value
 * @returns {string}
 */
export const getTrendColor = (value) => {
  if (value > 0) return 'text-[#2e8b57]';
  if (value < 0) return 'text-[#c44536]';
  return 'text-gray-500';
};

/**
 * Get a background color class for margin indicators.
 * @param {number} margin - Decimal value (0-1)
 * @returns {string}
 */
export const getMarginBadgeClass = (margin) => {
  if (margin >= 0.40) return 'bg-green-100 text-green-800';
  if (margin >= 0.30) return 'bg-blue-100 text-blue-800';
  if (margin >= 0.20) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

/**
 * Customer type code to display label.
 * @param {string} code
 * @returns {string}
 */
export const customerTypeLabel = (code) => {
  const labels = {
    LSH: 'Locksmith',
    INT: 'Integrator',
    PMG: 'Property Mgr',
    RET: 'Retailer',
  };
  return labels[code] || code;
};

/**
 * Payment status to badge styling.
 * @param {string} status
 * @returns {string}
 */
export const getPaymentStatusClass = (status) => {
  const classes = {
    PAID: 'bg-green-100 text-green-800',
    UNPAID: 'bg-yellow-100 text-yellow-800',
    PARTIAL: 'bg-blue-100 text-blue-800',
    OVERDUE: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Order status to badge styling.
 * @param {string} status
 * @returns {string}
 */
export const getOrderStatusClass = (status) => {
  const classes = {
    DELIVERED: 'bg-green-100 text-green-800',
    SHIPPED: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
};
