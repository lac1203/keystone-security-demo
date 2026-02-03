import React from 'react';
import { NavLink } from 'react-router-dom';

const agents = [
  {
    name: 'Data Agent',
    path: '/data-agent',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    color: 'from-[#4a7c59] to-[#2e8b57]',
    activeRing: 'ring-[#4a7c59]',
  },
  {
    name: 'Forecast Agent',
    path: '/forecast-agent',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
      </svg>
    ),
    color: 'from-[#d4a84b] to-[#c9a227]',
    activeRing: 'ring-[#d4a84b]',
  },
];

export default function AgentTabBar() {
  return (
    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl border border-gray-200">
      {agents.map((agent) => (
        <NavLink
          key={agent.path}
          to={agent.path}
          className={({ isActive }) =>
            `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
            }`
          }
        >
          <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white">{agent.icon}</span>
          </span>
          <span className="whitespace-nowrap">{agent.name}</span>
        </NavLink>
      ))}
    </div>
  );
}
