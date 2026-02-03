import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatNumber,
  formatCompact,
  formatDate,
  formatMonthShort,
  getTrendColor,
  getMarginBadgeClass,
  customerTypeLabel,
  getPaymentStatusClass,
  getOrderStatusClass,
} from './formatters';

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe('formatCurrency', () => {
  it('formats large numbers as USD with no decimals', () => {
    expect(formatCurrency(19980000)).toBe('$19,980,000');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('rounds to no decimal places', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-500)).toBe('-$500');
  });
});

// ---------------------------------------------------------------------------
// formatCurrencyFull
// ---------------------------------------------------------------------------
describe('formatCurrencyFull', () => {
  it('formats with cents', () => {
    expect(formatCurrencyFull(2527.43)).toBe('$2,527.43');
  });

  it('adds trailing zeros for whole numbers', () => {
    expect(formatCurrencyFull(100)).toBe('$100.00');
  });
});

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------
describe('formatPercent', () => {
  it('formats decimal as percentage', () => {
    expect(formatPercent(0.342)).toBe('34.2%');
  });

  it('formats zero percent', () => {
    expect(formatPercent(0)).toBe('0.0%');
  });

  it('formats 100%', () => {
    expect(formatPercent(1)).toBe('100.0%');
  });
});

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------
describe('formatNumber', () => {
  it('adds thousands separator', () => {
    expect(formatNumber(7904)).toBe('7,904');
  });

  it('handles small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// formatCompact
// ---------------------------------------------------------------------------
describe('formatCompact', () => {
  it('formats millions', () => {
    const result = formatCompact(19980000);
    expect(result).toMatch(/20M/);
  });

  it('formats thousands', () => {
    const result = formatCompact(2527);
    expect(result).toMatch(/2\.5K/);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  it('formats ISO date to readable format', () => {
    const result = formatDate('2024-06-15');
    expect(result).toContain('Jun');
    expect(result).toContain('2024');
    // Day may vary by timezone (14 or 15), just ensure it's a valid date
    expect(result).toMatch(/Jun \d{1,2}, 2024/);
  });

  it('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatMonthShort
// ---------------------------------------------------------------------------
describe('formatMonthShort', () => {
  it('formats YYYY-MM to short month label', () => {
    expect(formatMonthShort('2024-06')).toBe("Jun '24");
  });

  it('handles January', () => {
    expect(formatMonthShort('2023-01')).toBe("Jan '23");
  });

  it('handles December', () => {
    expect(formatMonthShort('2025-12')).toBe("Dec '25");
  });

  it('returns empty string for falsy input', () => {
    expect(formatMonthShort('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getTrendColor
// ---------------------------------------------------------------------------
describe('getTrendColor', () => {
  it('returns green for positive values', () => {
    expect(getTrendColor(5)).toBe('text-[#2e8b57]');
  });

  it('returns red for negative values', () => {
    expect(getTrendColor(-3)).toBe('text-[#c44536]');
  });

  it('returns gray for zero', () => {
    expect(getTrendColor(0)).toBe('text-gray-500');
  });
});

// ---------------------------------------------------------------------------
// getMarginBadgeClass
// ---------------------------------------------------------------------------
describe('getMarginBadgeClass', () => {
  it('returns green for high margin (>= 40%)', () => {
    expect(getMarginBadgeClass(0.45)).toBe('bg-green-100 text-green-800');
  });

  it('returns blue for good margin (>= 30%)', () => {
    expect(getMarginBadgeClass(0.35)).toBe('bg-blue-100 text-blue-800');
  });

  it('returns yellow for okay margin (>= 20%)', () => {
    expect(getMarginBadgeClass(0.25)).toBe('bg-yellow-100 text-yellow-800');
  });

  it('returns red for low margin (< 20%)', () => {
    expect(getMarginBadgeClass(0.15)).toBe('bg-red-100 text-red-800');
  });
});

// ---------------------------------------------------------------------------
// customerTypeLabel
// ---------------------------------------------------------------------------
describe('customerTypeLabel', () => {
  it('maps LSH to Locksmith', () => {
    expect(customerTypeLabel('LSH')).toBe('Locksmith');
  });

  it('maps INT to Integrator', () => {
    expect(customerTypeLabel('INT')).toBe('Integrator');
  });

  it('maps PMG to Property Mgr', () => {
    expect(customerTypeLabel('PMG')).toBe('Property Mgr');
  });

  it('maps RET to Retailer', () => {
    expect(customerTypeLabel('RET')).toBe('Retailer');
  });

  it('returns the code itself for unknown types', () => {
    expect(customerTypeLabel('XYZ')).toBe('XYZ');
  });
});

// ---------------------------------------------------------------------------
// getPaymentStatusClass
// ---------------------------------------------------------------------------
describe('getPaymentStatusClass', () => {
  it('returns green for PAID', () => {
    expect(getPaymentStatusClass('PAID')).toBe('bg-green-100 text-green-800');
  });

  it('returns yellow for UNPAID', () => {
    expect(getPaymentStatusClass('UNPAID')).toBe('bg-yellow-100 text-yellow-800');
  });

  it('returns blue for PARTIAL', () => {
    expect(getPaymentStatusClass('PARTIAL')).toBe('bg-blue-100 text-blue-800');
  });

  it('returns red for OVERDUE', () => {
    expect(getPaymentStatusClass('OVERDUE')).toBe('bg-red-100 text-red-800');
  });

  it('returns gray for unknown status', () => {
    expect(getPaymentStatusClass('UNKNOWN')).toBe('bg-gray-100 text-gray-800');
  });
});

// ---------------------------------------------------------------------------
// getOrderStatusClass
// ---------------------------------------------------------------------------
describe('getOrderStatusClass', () => {
  it('returns green for DELIVERED', () => {
    expect(getOrderStatusClass('DELIVERED')).toBe('bg-green-100 text-green-800');
  });

  it('returns blue for SHIPPED', () => {
    expect(getOrderStatusClass('SHIPPED')).toBe('bg-blue-100 text-blue-800');
  });

  it('returns yellow for PENDING', () => {
    expect(getOrderStatusClass('PENDING')).toBe('bg-yellow-100 text-yellow-800');
  });

  it('returns red for CANCELLED', () => {
    expect(getOrderStatusClass('CANCELLED')).toBe('bg-red-100 text-red-800');
  });

  it('returns gray for unknown status', () => {
    expect(getOrderStatusClass('OTHER')).toBe('bg-gray-100 text-gray-800');
  });
});
