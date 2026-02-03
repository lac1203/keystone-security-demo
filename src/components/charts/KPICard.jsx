import React from 'react';
import { SEMANTIC_COLORS } from './colors';

const VARIANTS = {
  primary: 'bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] text-white',
  secondary: 'bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] text-white',
  success: 'bg-gradient-to-br from-[#2e8b57] to-[#3e9b67] text-white',
  danger: 'bg-gradient-to-br from-[#c44536] to-[#d45546] text-white',
  neutral: 'bg-white border border-gray-200 text-gray-800',
};

// SVG trend arrows (no external icon dependency)
const TrendUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 11L8 5L13 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 5L8 11L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrendNeutralIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const TREND_ICONS = {
  up: <TrendUpIcon />,
  down: <TrendDownIcon />,
  neutral: <TrendNeutralIcon />,
};

/**
 * KPICard - Reusable key performance indicator display card
 *
 * @param {string} label - KPI label text (e.g. "Total Revenue")
 * @param {string|number} value - The main display value (e.g. "$19.98M")
 * @param {string} [subtitle] - Optional subtitle text
 * @param {'up'|'down'|'neutral'} [trend] - Trend direction indicator
 * @param {string} [trendValue] - Trend description (e.g. "+8.0% YoY")
 * @param {React.ReactNode} [icon] - Optional icon element
 * @param {'primary'|'secondary'|'success'|'danger'|'neutral'} [variant='primary'] - Card color variant
 */
export default function KPICard({
  label,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  variant = 'primary',
}) {
  const isNeutralVariant = variant === 'neutral';

  // Determine trend indicator color
  const getTrendColor = () => {
    if (isNeutralVariant) {
      if (trend === 'up') return 'text-green-600';
      if (trend === 'down') return 'text-red-600';
      return 'text-gray-500';
    }
    if (trend === 'up') return 'text-green-300';
    if (trend === 'down') return 'text-red-300';
    return 'text-blue-200';
  };

  // Handle empty/loading state
  if (!label && !value) {
    return (
      <div className={`rounded-xl p-6 ${VARIANTS[variant] || VARIANTS.primary} animate-pulse`}>
        <div className="h-4 bg-white/20 rounded w-24 mb-3" />
        <div className="h-8 bg-white/20 rounded w-32 mb-2" />
        <div className="h-3 bg-white/20 rounded w-20" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 shadow-md ${VARIANTS[variant] || VARIANTS.primary}`}>
      <div className="flex justify-between items-start">
        <p
          className={`text-sm font-medium uppercase tracking-wide ${
            isNeutralVariant ? 'text-gray-500' : 'text-blue-200'
          }`}
        >
          {label}
        </p>
        {icon && (
          <div className={isNeutralVariant ? 'text-gray-400' : 'text-blue-200'}>
            {icon}
          </div>
        )}
      </div>

      <p className={`text-3xl font-bold mt-2 ${isNeutralVariant ? 'text-gray-800' : ''}`}>
        {value}
      </p>

      {(trend || subtitle || trendValue) && (
        <div
          className={`flex items-center gap-2 mt-2 text-sm ${
            isNeutralVariant ? 'text-gray-500' : 'text-blue-200'
          }`}
        >
          {trend && (
            <span className={`flex items-center ${getTrendColor()}`}>
              {TREND_ICONS[trend]}
            </span>
          )}
          {trendValue && <span>{trendValue}</span>}
          {subtitle && !trendValue && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
