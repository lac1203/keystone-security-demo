import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { GenericPageSkeleton } from './components/Skeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ProductCatalog = lazy(() => import('./pages/ProductCatalog'));
const CustomerMapPage = lazy(() => import('./pages/CustomerMapPage'));
const SalesTrends = lazy(() => import('./pages/SalesTrends'));
const CategoryPerformance = lazy(() => import('./pages/CategoryPerformance'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const RevenueForecast = lazy(() => import('./pages/RevenueForecast'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const DataAgent = lazy(() => import('./pages/DataAgent'));
const ForecastAgent = lazy(() => import('./pages/ForecastAgent'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Router basename="/keystone-security-demo">
      <Layout>
        <Suspense fallback={<GenericPageSkeleton />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<ProductCatalog />} />
            <Route path="/customers" element={<CustomerMapPage />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/sales-trends" element={<SalesTrends />} />
            <Route path="/category-performance" element={<CategoryPerformance />} />
            <Route path="/forecast" element={<RevenueForecast />} />
            <Route path="/data-agent" element={<DataAgent />} />
            <Route path="/forecast-agent" element={<ForecastAgent />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
