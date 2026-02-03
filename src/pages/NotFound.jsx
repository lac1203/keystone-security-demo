import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Shield icon */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-[#d4a84b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z"
          />
        </svg>
      </div>

      <h2 className="text-4xl font-bold text-[#1e3a5f] mb-2">404</h2>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Page Not Found</h3>
      <p className="text-sm text-gray-500 mb-1 max-w-md">
        The page <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{pathname}</code> doesn't exist.
      </p>
      <p className="text-sm text-gray-500 mb-8 max-w-md">
        It may have been moved, or the URL might be incorrect.
      </p>

      <Link
        to="/"
        className="bg-[#1e3a5f] hover:bg-[#2a4a73] text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
