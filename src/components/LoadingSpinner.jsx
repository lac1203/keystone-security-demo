import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
    </div>
  );
}
