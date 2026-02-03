import React from 'react';

export default function Header({ onMenuToggle }) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="flex items-center justify-between px-4 md:px-6 py-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Toggle navigation menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo / Brand - visible on mobile when sidebar is hidden */}
        <div className="flex items-center gap-3 md:hidden">
          <div className="w-8 h-8 bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">KS</span>
          </div>
          <span className="font-semibold text-[#1e3a5f] text-sm">Keystone Security</span>
        </div>

        {/* Page title area - visible on desktop */}
        <div className="hidden md:flex items-center">
          <h1 className="text-lg font-semibold text-gray-800">
            Keystone Security Distribution
          </h1>
          <span className="ml-3 text-xs bg-[#4a7c59] text-white px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
            Demo
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-gray-500">
            Mid-Atlantic Region
          </span>
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
