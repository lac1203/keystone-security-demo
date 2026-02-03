import React from 'react';

function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <SkeletonBlock className="h-8 w-60 mb-2" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <SkeletonBlock key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Wide chart */}
      <SkeletonBlock className="h-80 rounded-xl" />
      {/* 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-72 rounded-xl" />
        <SkeletonBlock className="h-72 rounded-xl" />
      </div>
      {/* Wide table */}
      <SkeletonBlock className="h-64 rounded-xl" />
    </div>
  );
}

export function ProductCatalogSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-8 w-48 mb-2" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      {/* Filter bar */}
      <SkeletonBlock className="h-16 rounded-xl" />
      {/* Result count */}
      <SkeletonBlock className="h-4 w-48" />
      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 space-y-3">
        <SkeletonBlock className="h-8 w-full" />
        {[...Array(10)].map((_, i) => (
          <SkeletonBlock key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function CustomerMapSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-8 w-48 mb-2" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* Map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonBlock className="h-14 rounded-xl" />
          <SkeletonBlock className="h-[350px] sm:h-[500px] rounded-xl" />
        </div>
        <SkeletonBlock className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

export function SalesTrendsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-8 w-40 mb-2" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonBlock key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Wide chart */}
      <SkeletonBlock className="h-80 rounded-xl" />
      {/* 2-col charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-72 rounded-xl" />
        <SkeletonBlock className="h-72 rounded-xl" />
      </div>
      {/* 2-col tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-64 rounded-xl" />
        <SkeletonBlock className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

export function CategoryPerformanceSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-8 w-56 mb-2" />
        <SkeletonBlock className="h-4 w-72" />
      </div>
      {/* Category cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <SkeletonBlock key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      {/* 2-col charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-72 rounded-xl" />
        <SkeletonBlock className="h-72 rounded-xl" />
      </div>
      {/* Wide chart */}
      <SkeletonBlock className="h-80 rounded-xl" />
      {/* Table */}
      <SkeletonBlock className="h-64 rounded-xl" />
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <SkeletonBlock className="h-8 w-48 mb-2" />
        <SkeletonBlock className="h-4 w-64" />
      </div>
      <SkeletonBlock className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonBlock className="h-48 rounded-xl" />
        <SkeletonBlock className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
