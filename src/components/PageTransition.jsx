import React from 'react';

export default function PageTransition({ children, locationKey }) {
  return (
    <div key={locationKey} className="page-transition">
      {children}
    </div>
  );
}
