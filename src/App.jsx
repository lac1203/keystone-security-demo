import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductCatalog = lazy(() => import('./pages/ProductCatalog'));
const CustomerMapPage = lazy(() => import('./pages/CustomerMapPage'));
const SalesTrends = lazy(() => import('./pages/SalesTrends'));
const CategoryPerformance = lazy(() => import('./pages/CategoryPerformance'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const RevenueForecast = lazy(() => import('./pages/RevenueForecast'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a5f]" />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<ProductCatalog />} />
            <Route path="/customers" element={<CustomerMapPage />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/sales-trends" element={<SalesTrends />} />
            <Route path="/category-performance" element={<CategoryPerformance />} />
            <Route path="/forecast" element={<RevenueForecast />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
