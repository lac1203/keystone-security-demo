import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CUSTOMER_TYPE_COLORS, CUSTOMER_TYPE_LABELS } from './colors';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Create a colored circle marker icon for a customer type.
 */
const createCustomIcon = (L, color) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });

/**
 * Build HTML content for marker popup.
 */
const buildPopupContent = (customer) => `
  <div style="min-width: 180px; font-family: 'Open Sans', sans-serif;">
    <div style="font-weight: 600; font-size: 14px; color: #1a1a1a; margin-bottom: 4px;">
      ${customer.company_name}
    </div>
    <div style="font-size: 12px; color: #4a4a4a; margin-bottom: 2px;">
      ${customer.city}, ${customer.state}
    </div>
    <div style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 500; margin-top: 4px; color: white; background-color: ${
      CUSTOMER_TYPE_COLORS[customer.customer_type] || '#666'
    };">
      ${CUSTOMER_TYPE_LABELS[customer.customer_type] || customer.customer_type}
    </div>
  </div>
`;

/**
 * CustomerMap - Leaflet map showing customer locations in the Mid-Atlantic region
 *
 * Uses vanilla Leaflet (not react-leaflet) for maximum compatibility.
 * Requires Leaflet CSS to be included in the page:
 *   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
 *
 * @param {Array<{customer_id: number, company_name: string, customer_type: string, city: string, state: string, lat: number, lng: number}>} customers
 * @param {number} [height=400] - Map height in pixels
 * @param {Function} [onMarkerClick] - Callback when a marker is clicked
 */
export default function CustomerMap({ customers = [], height = 400, onMarkerClick }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Initialize map (runs once)
  useEffect(() => {
    if (!mapInstanceRef.current && mapContainerRef.current) {
      // Center on Mid-Atlantic region (approx center of PA/NJ/MD/VA/DE/DC)
      const map = L.map(mapContainerRef.current, {
        center: [39.5, -76.5],
        zoom: 7,
        scrollWheelZoom: true,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // Update markers when customers data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const markersLayer = markersLayerRef.current;

    // Clear existing markers
    markersLayer.clearLayers();

    // Cache icons by customer type to avoid recreating DOM per marker
    const iconCache = {};

    // Track valid markers for bounds fitting
    const validPositions = [];

    customers.forEach((customer) => {
      if (customer.lat != null && customer.lng != null) {
        const type = customer.customer_type || 'UNKNOWN';
        if (!iconCache[type]) {
          const color = CUSTOMER_TYPE_COLORS[type] || '#666666';
          iconCache[type] = createCustomIcon(L, color);
        }
        const icon = iconCache[type];

        const marker = L.marker([customer.lat, customer.lng], { icon })
          .bindPopup(buildPopupContent(customer));

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(customer));
        }

        markersLayer.addLayer(marker);
        validPositions.push([customer.lat, customer.lng]);
      }
    });

    // Fit bounds to show all markers (with padding)
    if (validPositions.length > 0) {
      const bounds = L.latLngBounds(validPositions);
      mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [customers, onMarkerClick]);

  // Handle empty state
  if (!customers || customers.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Locations</h3>
        <div
          className="flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg"
          style={{ height }}
        >
          No customer data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Customer Locations</h3>
        <span className="text-sm text-gray-500">
          {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        ref={mapContainerRef}
        role="img"
        aria-label="Map of customer locations across the Mid-Atlantic region"
        style={{ height, borderRadius: '8px', zIndex: 0 }}
      />

      {/* Legend */}
      <div className="flex gap-4 mt-4 flex-wrap">
        {Object.entries(CUSTOMER_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm text-gray-600">
              {CUSTOMER_TYPE_LABELS[type] || type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
