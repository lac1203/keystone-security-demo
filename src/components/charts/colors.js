// /src/components/charts/colors.js
// Shared color constants for all chart components
// Based on Keystone Security Distribution design system

// Chart colors (use in this order for series data)
export const CHART_COLORS = [
  '#1e3a5f',  // Primary - deep navy
  '#4a7c59',  // Secondary - forest green
  '#d4a84b',  // Accent - brass/gold
  '#6b8e9f',  // Light blue
  '#7a9f6b',  // Light green
  '#c9a227',  // Gold
  '#8b6b5c',  // Brown
  '#5c7a8b',  // Steel blue
];

// Semantic colors for status/trend indicators
export const SEMANTIC_COLORS = {
  positive: '#2e8b57',  // Sea green
  negative: '#c44536',  // Alert red
  neutral: '#737373',   // Gray
  warning: '#d4a84b',   // Gold
};

// Customer type colors
export const CUSTOMER_TYPE_COLORS = {
  LSH: '#1e3a5f',  // Locksmith - navy
  INT: '#4a7c59',  // Integrator - green
  PMG: '#d4a84b',  // Property Manager - gold
  RET: '#6b8e9f',  // Retailer - light blue
};

// Customer type labels
export const CUSTOMER_TYPE_LABELS = {
  LSH: 'Locksmith',
  INT: 'Integrator',
  PMG: 'Property Mgr',
  RET: 'Retailer',
};

// Category colors
export const CATEGORY_COLORS = {
  'Residential Locks': '#1e3a5f',
  'Commercial Hardware': '#4a7c59',
  'Access Control': '#d4a84b',
  'Automotive': '#6b8e9f',
  'Safes & Security': '#7a9f6b',
  'Key Machines & Supplies': '#c9a227',
};
