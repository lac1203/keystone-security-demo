import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadAllData, loadForecast } from '../utils/dataLoader';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  customerTypeLabel,
} from '../utils/formatters';
import AgentTabBar from '../components/AgentTabBar';

// ── Constants ────────────────────────────────────────────────────────────────
const SEASONALITY = {
  1: 0.78, 2: 0.72, 3: 0.92, 4: 1.08, 5: 1.15, 6: 1.22,
  7: 1.18, 8: 1.16, 9: 1.10, 10: 1.05, 11: 0.98, 12: 0.88,
};
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_LABELS = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
const QUARTER_MONTHS = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

const MANUAL_OVERRIDES = {
  'Access Control': { pct: 0.025, reason: 'Strong integrator pipeline' },
  'Automotive': { pct: -0.012, reason: 'Supply chain adjustment' },
  'Commercial Hardware': { pct: 0.018, reason: 'New municipal contracts' },
};

// ── Data computation helpers ─────────────────────────────────────────────────

function compute2026Actuals(orders, orderLines, products) {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  const orderMap = new Map();
  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    orderMap.set(o.order_id, o);
  });

  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { revenue: 0, cost: 0, orders: 0 };

  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    const month = parseInt(o.order_date.substring(5, 7), 10);
    byMonth[month].revenue += o.total || 0;
    byMonth[month].cost += o.total_cost || 0;
    byMonth[month].orders += 1;
  });

  const byCategory = {};
  orderLines.forEach((line) => {
    const order = orderMap.get(line.order_id);
    if (!order) return;
    const product = productMap.get(line.product_id);
    if (!product) return;
    const cat = product.category_l1 || 'Unknown';
    const month = parseInt(order.order_date.substring(5, 7), 10);
    if (!byCategory[cat]) byCategory[cat] = { total: 0, cost: 0, byMonth: {} };
    byCategory[cat].total += line.line_total || 0;
    byCategory[cat].cost += line.line_cost || 0;
    if (!byCategory[cat].byMonth[month]) byCategory[cat].byMonth[month] = 0;
    byCategory[cat].byMonth[month] += line.line_total || 0;
  });

  const monthsWithData = Object.entries(byMonth)
    .filter(([, v]) => v.orders > 0)
    .map(([m]) => parseInt(m, 10))
    .sort((a, b) => a - b);

  let mostRecentQuarter = null;
  for (let q = 4; q >= 1; q--) {
    if (QUARTER_MONTHS[q].every((m) => monthsWithData.includes(m))) {
      mostRecentQuarter = q;
      break;
    }
  }

  return { byMonth, byCategory, monthsWithData, mostRecentQuarter };
}

function runMRQForecast(actuals, mostRecentQuarter) {
  const qMonths = QUARTER_MONTHS[mostRecentQuarter];
  const qRevenue = qMonths.reduce((s, m) => s + actuals.byMonth[m].revenue, 0);
  const qSeasonality = qMonths.reduce((s, m) => s + SEASONALITY[m], 0);
  const baseRate = qRevenue / qSeasonality;

  const projected = {};
  let fullYearProjection = 0;
  for (let m = 1; m <= 12; m++) {
    projected[m] = baseRate * SEASONALITY[m];
    fullYearProjection += projected[m];
  }

  return { qRevenue, qSeasonality, baseRate, projected, fullYearProjection };
}

function runMRQForecastByCategory(actuals, mostRecentQuarter) {
  const qMonths = QUARTER_MONTHS[mostRecentQuarter];
  const result = {};

  Object.entries(actuals.byCategory).forEach(([cat, data]) => {
    const qRevenue = qMonths.reduce((s, m) => s + (data.byMonth[m] || 0), 0);
    const qSeasonality = qMonths.reduce((s, m) => s + SEASONALITY[m], 0);
    const baseRate = qSeasonality > 0 ? qRevenue / qSeasonality : 0;

    let fullYear = 0;
    const projected = {};
    for (let m = 1; m <= 12; m++) {
      projected[m] = baseRate * SEASONALITY[m];
      fullYear += projected[m];
    }

    result[cat] = { qRevenue, baseRate, projected, fullYear, actualTotal: data.total };
  });

  return result;
}

// ── Drill-down computation helpers ───────────────────────────────────────────

function computeTopCustomersPriorMonth(orders, customers, monthsWithData) {
  const recentMonth = monthsWithData[monthsWithData.length - 1];
  const customerMap = new Map(customers.map((c) => [c.customer_id, c]));

  const revenue = {};
  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    const month = parseInt(o.order_date.substring(5, 7), 10);
    if (month !== recentMonth) return;
    const cid = o.customer_id;
    if (!revenue[cid]) revenue[cid] = { revenue: 0, orders: 0 };
    revenue[cid].revenue += o.total || 0;
    revenue[cid].orders += 1;
  });

  return Object.entries(revenue)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 10)
    .map(([cid, d], i) => {
      const c = customerMap.get(parseInt(cid));
      return {
        rank: i + 1,
        name: c?.company_name || 'Unknown',
        type: c?.customer_type || '',
        city: c?.city || '',
        state: c?.state || '',
        revenue: d.revenue,
        orders: d.orders,
      };
    });
}

function computePotentiallyLostCustomers(orders, customers, monthsWithData) {
  const recentMonth = monthsWithData[monthsWithData.length - 1];
  const priorMonth = monthsWithData.length >= 2 ? monthsWithData[monthsWithData.length - 2] : null;
  if (!priorMonth) return [];

  const customerMap = new Map(customers.map((c) => [c.customer_id, c]));
  const priorRev = {};
  const recentRev = {};

  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    const month = parseInt(o.order_date.substring(5, 7), 10);
    const cid = o.customer_id;
    if (month === priorMonth) priorRev[cid] = (priorRev[cid] || 0) + (o.total || 0);
    if (month === recentMonth) recentRev[cid] = (recentRev[cid] || 0) + (o.total || 0);
  });

  return Object.entries(priorRev)
    .filter(([cid]) => !recentRev[cid] || recentRev[cid] < priorRev[cid] * 0.3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cid, revenue], i) => {
      const c = customerMap.get(parseInt(cid));
      return {
        rank: i + 1,
        name: c?.company_name || 'Unknown',
        type: c?.customer_type || '',
        city: c?.city || '',
        state: c?.state || '',
        priorRevenue: revenue,
        recentRevenue: recentRev[cid] || 0,
      };
    });
}

function computeProductChanges(orders, orderLines, products, monthsWithData) {
  const recentMonth = monthsWithData[monthsWithData.length - 1];
  const priorMonth = monthsWithData.length >= 2 ? monthsWithData[monthsWithData.length - 2] : null;
  if (!priorMonth) return { positive: [], negative: [] };

  const productMap = new Map(products.map((p) => [p.product_id, p]));
  const recentOrders = new Set();
  const priorOrders = new Set();

  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    const month = parseInt(o.order_date.substring(5, 7), 10);
    if (month === recentMonth) recentOrders.add(o.order_id);
    if (month === priorMonth) priorOrders.add(o.order_id);
  });

  const recentRev = {};
  const priorRev = {};
  orderLines.forEach((line) => {
    if (recentOrders.has(line.order_id)) {
      recentRev[line.product_id] = (recentRev[line.product_id] || 0) + (line.line_total || 0);
    }
    if (priorOrders.has(line.order_id)) {
      priorRev[line.product_id] = (priorRev[line.product_id] || 0) + (line.line_total || 0);
    }
  });

  const allPids = new Set([...Object.keys(recentRev).map(Number), ...Object.keys(priorRev).map(Number)]);
  const changes = [...allPids]
    .map((pid) => {
      const recent = recentRev[pid] || 0;
      const prior = priorRev[pid] || 0;
      if (prior === 0 && recent === 0) return null;
      const change = recent - prior;
      const pctChange = prior > 0 ? change / prior : recent > 0 ? 1 : 0;
      const p = productMap.get(pid);
      return {
        name: p?.name || 'Unknown',
        sku: p?.sku || '',
        category: p?.category_l1 || '',
        manufacturer: p?.manufacturer || '',
        priorRevenue: prior,
        recentRevenue: recent,
        change,
        pctChange,
      };
    })
    .filter(Boolean);

  const positive = [...changes].filter((c) => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 10);
  const negative = [...changes].filter((c) => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 10);

  return { positive, negative };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4a84b] to-[#c9a227] flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </div>
  );
}

function AgentBubble({ children }) {
  return (
    <div className="flex justify-start gap-2.5">
      <AgentAvatar />
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-3 sm:px-4 py-3 max-w-[92%] sm:max-w-[85%] shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ToolStepRow({ step, status }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 transition-all duration-300 ${status === 'pending' ? 'opacity-0 h-0 py-0 overflow-hidden' : 'opacity-100'}`}>
      <div className="mt-0.5 flex-shrink-0">
        {status === 'running' ? (
          <div className="w-5 h-5 border-2 border-[#d4a84b] border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[#2e8b57] flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-mono font-medium ${status === 'complete' ? 'text-gray-800' : 'text-[#b8922e]'}`}>
            {step.name}
          </span>
          {status === 'complete' && (
            <span className="text-xs text-gray-400 font-mono flex-shrink-0">{step.duration}</span>
          )}
          {status === 'running' && (
            <span className="text-xs text-[#d4a84b] font-medium flex-shrink-0">Running...</span>
          )}
        </div>
        {status === 'running' && (
          <p className="text-xs text-gray-400 mt-0.5">{step.label}</p>
        )}
        {status === 'complete' && step.detail && (
          <p className="text-xs text-gray-500 mt-0.5">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

function ComparisonTable({ comparison }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse min-w-[440px]">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Category</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Previous</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Updated</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Change</th>
            <th className="text-right py-1.5 px-2 font-semibold text-gray-600">%</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5 px-2 text-gray-700 whitespace-nowrap">{row.category}</td>
              <td className="py-1.5 px-2 text-gray-500 text-right whitespace-nowrap">{formatCurrency(row.previous)}</td>
              <td className="py-1.5 px-2 text-gray-800 font-medium text-right whitespace-nowrap">{formatCurrency(row.updated)}</td>
              <td className={`py-1.5 px-2 text-right whitespace-nowrap ${row.change >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}`}>
                {row.change >= 0 ? '+' : ''}{formatCurrency(row.change)}
              </td>
              <td className={`py-1.5 px-2 text-right whitespace-nowrap ${row.pctChange >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}`}>
                {row.pctChange >= 0 ? '+' : ''}{formatPercent(row.pctChange)}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 font-medium">
            <td className="py-1.5 px-2 text-gray-800">Total</td>
            <td className="py-1.5 px-2 text-gray-600 text-right">{formatCurrency(comparison.totalPrev)}</td>
            <td className="py-1.5 px-2 text-gray-800 text-right">{formatCurrency(comparison.totalUpd)}</td>
            <td className={`py-1.5 px-2 text-right ${comparison.totalChange >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}`}>
              {comparison.totalChange >= 0 ? '+' : ''}{formatCurrency(comparison.totalChange)}
            </td>
            <td className={`py-1.5 px-2 text-right ${comparison.totalPctChange >= 0 ? 'text-[#2e8b57]' : 'text-[#c44536]'}`}>
              {comparison.totalPctChange >= 0 ? '+' : ''}{formatPercent(comparison.totalPctChange)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ForecastAgent() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Interaction state
  const [phase, setPhase] = useState('idle'); // idle, running, complete
  const [completedSteps, setCompletedSteps] = useState(0);
  const [activeStep, setActiveStep] = useState(-1);
  const [drillCategory, setDrillCategory] = useState(null); // 'customers' | 'products'
  const [drillView, setDrillView] = useState(null); // 'top10' | 'lost' | 'positive' | 'negative'

  const endRef = useRef(null);
  const timersRef = useRef([]);

  useEffect(() => {
    Promise.all([loadAllData(), loadForecast()])
      .then(([allData, fc]) => {
        setData(allData);
        setForecast(fc);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [completedSteps, drillCategory, drillView, phase]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  const computed = useMemo(() => {
    if (!data || !forecast) return null;
    const actuals = compute2026Actuals(data.orders, data.orderLines, data.products);
    if (!actuals.mostRecentQuarter) return { actuals, mrq: null, catForecast: null };
    const mrq = runMRQForecast(actuals, actuals.mostRecentQuarter);
    const catForecast = runMRQForecastByCategory(actuals, actuals.mostRecentQuarter);
    return { actuals, mrq, catForecast };
  }, [data, forecast]);

  const toolSteps = useMemo(() => {
    if (!computed || !data) return [];
    const { actuals, mrq } = computed;
    const qLabel = actuals.mostRecentQuarter ? QUARTER_LABELS[actuals.mostRecentQuarter] : 'Q4';
    return [
      {
        name: 'connect_warehouse',
        label: 'Establishing secure connection to data warehouse...',
        detail: `Connected. ${actuals.monthsWithData.length} months of 2026 data detected.`,
        duration: '1.2s',
        delay: 1200,
      },
      {
        name: 'load_historical_data',
        label: 'Querying orders, customers, products, line items...',
        detail: `${formatNumber(data.orders.length)} orders | ${formatNumber(data.orderLines.length)} line items | ${data.customers.length} customers | ${data.products.length} products`,
        duration: '2.1s',
        delay: 1800,
      },
      {
        name: 'run_mrq_forecast',
        label: 'Computing MRQ-based revenue projections...',
        detail: mrq
          ? `Base: ${qLabel} | Rate: ${formatCurrency(mrq.baseRate)}/mo | Projection: ${formatCurrency(mrq.fullYearProjection)}`
          : 'Insufficient data for MRQ',
        duration: '2.8s',
        delay: 2200,
      },
      {
        name: 'apply_seasonality',
        label: 'Normalizing with 12 monthly seasonality indices...',
        detail: 'Peak: June (1.22x) | Trough: February (0.72x)',
        duration: '1.1s',
        delay: 1400,
      },
      {
        name: 'process_overrides',
        label: 'Applying 3 category-level manual adjustments...',
        detail: 'Access Control +2.5% | Automotive -1.2% | Commercial Hardware +1.8%',
        duration: '1.4s',
        delay: 1600,
      },
      {
        name: 'generate_report',
        label: 'Building comparison report...',
        detail: `${Object.keys(computed.catForecast || {}).length} categories analyzed. Report ready.`,
        duration: '0.8s',
        delay: 1000,
      },
    ];
  }, [computed, data]);

  const forecastComparison = useMemo(() => {
    if (!computed || !forecast) return null;
    const { catForecast, mrq } = computed;
    if (!catForecast || !mrq) return null;

    const budgetCats = forecast.modes.full_year.by_category;
    const budgetMap = {};
    budgetCats.forEach((c) => {
      budgetMap[c.category] = c.projected_revenue;
    });

    const rows = Object.entries(catForecast)
      .sort((a, b) => b[1].fullYear - a[1].fullYear)
      .map(([cat, d]) => {
        const previous = budgetMap[cat] || 0;
        const override = MANUAL_OVERRIDES[cat];
        const updated = d.fullYear * (1 + (override?.pct || 0));
        const change = updated - previous;
        const pctChange = previous > 0 ? change / previous : 0;
        return { category: cat, previous, updated, change, pctChange };
      });

    const totalPrev = rows.reduce((s, r) => s + r.previous, 0);
    const totalUpd = rows.reduce((s, r) => s + r.updated, 0);

    return {
      rows,
      totalPrev,
      totalUpd,
      totalChange: totalUpd - totalPrev,
      totalPctChange: totalPrev > 0 ? (totalUpd - totalPrev) / totalPrev : 0,
    };
  }, [computed, forecast]);

  const drillData = useMemo(() => {
    if (!data || !computed) return {};
    const { actuals } = computed;
    const topCustomers = computeTopCustomersPriorMonth(data.orders, data.customers, actuals.monthsWithData);
    const lostCustomers = computePotentiallyLostCustomers(data.orders, data.customers, actuals.monthsWithData);
    const productChanges = computeProductChanges(data.orders, data.orderLines, data.products, actuals.monthsWithData);
    return { topCustomers, lostCustomers, ...productChanges };
  }, [data, computed]);

  const recentMonthLabel = useMemo(() => {
    if (!computed) return '';
    const { actuals } = computed;
    const m = actuals.monthsWithData[actuals.monthsWithData.length - 1];
    return m ? MONTH_NAMES[m - 1] : '';
  }, [computed]);

  const priorMonthLabel = useMemo(() => {
    if (!computed) return '';
    const { actuals } = computed;
    const m = actuals.monthsWithData.length >= 2 ? actuals.monthsWithData[actuals.monthsWithData.length - 2] : null;
    return m ? MONTH_NAMES[m - 1] : '';
  }, [computed]);

  const handleRunForecast = useCallback(() => {
    setPhase('running');
    setActiveStep(0);
    setCompletedSteps(0);

    let totalDelay = 0;
    const newTimers = [];
    toolSteps.forEach((step, i) => {
      totalDelay += step.delay;
      const timer = setTimeout(() => {
        setCompletedSteps(i + 1);
        if (i < toolSteps.length - 1) {
          setActiveStep(i + 1);
        } else {
          setActiveStep(-1);
          setPhase('complete');
        }
      }, totalDelay);
      newTimers.push(timer);
    });
    timersRef.current = newTimers;
  }, [toolSteps]);

  const handleReset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase('idle');
    setActiveStep(-1);
    setCompletedSteps(0);
    setDrillCategory(null);
    setDrillView(null);
  }, []);

  const handleDrillCategory = useCallback((cat) => {
    setDrillCategory(cat);
    setDrillView(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#d4a84b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading forecast model...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Failed to load data</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <AgentTabBar />

      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Forecast Agent</h2>
        <p className="text-gray-500 text-sm mt-1">
          AI-powered revenue forecasting with automated data analysis and manual override support.
        </p>
      </div>

      {/* Content area */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Phase: Idle ── */}
          {phase === 'idle' && (
            <AgentBubble>
              <p className="text-sm text-gray-700 mb-3">
                Hi, I'm the <strong>Forecast Agent</strong>. I can generate an updated 2026 revenue forecast
                by analyzing your historical data, applying the Most Recent Quarter (MRQ) methodology,
                and incorporating manual category overrides.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                When ready, click the button below to kick off the forecast run.
              </p>
              <button
                onClick={handleRunForecast}
                className="bg-[#1e3a5f] hover:bg-[#2a4a73] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Run 2026 Forecast
              </button>
            </AgentBubble>
          )}

          {/* ── Phase: Running / Complete — Tool execution ── */}
          {(phase === 'running' || phase === 'complete') && (
            <>
              {/* Agent intro message */}
              <AgentBubble>
                <p className="text-sm text-gray-700">
                  Starting 2026 forecast run. Connecting to the data warehouse and executing tools...
                </p>
              </AgentBubble>

              {/* Tool execution card */}
              <div className="ml-10 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#c44536]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#d4a84b]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2e8b57]" />
                  </div>
                  <span className="text-xs text-gray-400 font-mono ml-2">forecast-agent — tool execution</span>
                </div>
                <div className="px-4 py-2 divide-y divide-gray-100">
                  {toolSteps.map((step, i) => {
                    let status = 'pending';
                    if (i < completedSteps) status = 'complete';
                    else if (i === activeStep) status = 'running';
                    return <ToolStepRow key={step.name} step={step} status={status} />;
                  })}
                </div>
                {phase === 'complete' && (
                  <div className="bg-[#f0fdf4] border-t border-[#bbf7d0] px-4 py-2.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2e8b57]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-[#2e8b57]">
                      Forecast complete — all 6 tools executed successfully ({toolSteps.reduce((s, t) => s + parseFloat(t.duration), 0).toFixed(1)}s total)
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Phase: Complete — Forecast comparison ── */}
          {phase === 'complete' && forecastComparison && (
            <>
              <AgentBubble>
                <p className="text-sm text-gray-700 mb-3">
                  Forecast complete. Here's how the updated projection compares to the previous forecast:
                </p>
                <ComparisonTable comparison={forecastComparison} />
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Previous = Original CAGR-based budget &nbsp;|&nbsp; Updated = MRQ projection + manual overrides
                </div>
              </AgentBubble>

              {/* Category choice prompt */}
              {!drillCategory && (
                <AgentBubble>
                  <p className="text-sm text-gray-700 mb-3">
                    Would you like to learn more about <strong>customers</strong> or <strong>products</strong>?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handleDrillCategory('customers')}
                      className="flex-1 border-2 border-gray-200 hover:border-[#1e3a5f] rounded-xl px-4 py-3 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1e3a5f]/10 flex items-center justify-center group-hover:bg-[#1e3a5f]/20 transition-colors">
                          <svg className="w-5 h-5 text-[#1e3a5f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Customers</p>
                          <p className="text-xs text-gray-500">Account activity & retention</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDrillCategory('products')}
                      className="flex-1 border-2 border-gray-200 hover:border-[#4a7c59] rounded-xl px-4 py-3 transition-colors group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#4a7c59]/10 flex items-center justify-center group-hover:bg-[#4a7c59]/20 transition-colors">
                          <svg className="w-5 h-5 text-[#4a7c59]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Products</p>
                          <p className="text-xs text-gray-500">Performance & trends</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </AgentBubble>
              )}

              {/* ── Drill: Customers ── */}
              {drillCategory === 'customers' && (
                <>
                  {/* Sub-option buttons */}
                  {!drillView && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-3">
                        Select a customer report to view:
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setDrillView('top10')}
                          className="w-full border border-gray-200 hover:border-[#1e3a5f] hover:bg-[#1e3a5f]/5 rounded-lg px-4 py-3 transition-colors text-left flex items-center gap-3"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Top 10 Largest Customers</p>
                            <p className="text-xs text-gray-500">Highest revenue accounts from {recentMonthLabel} 2026</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setDrillView('lost')}
                          className="w-full border border-gray-200 hover:border-[#c44536] hover:bg-[#c44536]/5 rounded-lg px-4 py-3 transition-colors text-left flex items-center gap-3"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#c44536] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Top 10 Potentially Lost Customers</p>
                            <p className="text-xs text-gray-500">Accounts with significant revenue drop from {priorMonthLabel} to {recentMonthLabel}</p>
                          </div>
                        </button>
                      </div>
                    </AgentBubble>
                  )}

                  {/* Top 10 Largest */}
                  {drillView === 'top10' && drillData.topCustomers && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-3">
                        <strong>Top 10 Largest Customers — {recentMonthLabel} 2026</strong>
                      </p>
                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs border-collapse min-w-[440px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">#</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Customer</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Type</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Location</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Revenue</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Orders</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillData.topCustomers.map((c) => (
                              <tr key={c.rank} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 px-2 text-gray-400">{c.rank}</td>
                                <td className="py-1.5 px-2 text-gray-800 font-medium whitespace-nowrap">{c.name}</td>
                                <td className="py-1.5 px-2">
                                  <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                    {customerTypeLabel(c.type)}
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{c.city}, {c.state}</td>
                                <td className="py-1.5 px-2 text-gray-800 text-right font-medium whitespace-nowrap">{formatCurrency(c.revenue)}</td>
                                <td className="py-1.5 px-2 text-gray-500 text-right">{c.orders}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AgentBubble>
                  )}

                  {/* Potentially Lost */}
                  {drillView === 'lost' && drillData.lostCustomers && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-1">
                        <strong>Top 10 Potentially Lost Customers</strong>
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        Accounts with significant revenue decline from {priorMonthLabel} to {recentMonthLabel} 2026
                      </p>
                      {drillData.lostCustomers.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No significant customer losses detected between {priorMonthLabel} and {recentMonthLabel}.</p>
                      ) : (
                        <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-xs border-collapse min-w-[480px]">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-1.5 px-2 font-semibold text-gray-600">#</th>
                                <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Customer</th>
                                <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Type</th>
                                <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Location</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{priorMonthLabel} Rev</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{recentMonthLabel} Rev</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Change</th>
                              </tr>
                            </thead>
                            <tbody>
                              {drillData.lostCustomers.map((c) => {
                                const change = c.recentRevenue - c.priorRevenue;
                                const pct = c.priorRevenue > 0 ? change / c.priorRevenue : 0;
                                return (
                                  <tr key={c.rank} className="border-b border-gray-100 last:border-0">
                                    <td className="py-1.5 px-2 text-gray-400">{c.rank}</td>
                                    <td className="py-1.5 px-2 text-gray-800 font-medium whitespace-nowrap">{c.name}</td>
                                    <td className="py-1.5 px-2">
                                      <span className="inline-block bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-medium">
                                        {customerTypeLabel(c.type)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{c.city}, {c.state}</td>
                                    <td className="py-1.5 px-2 text-gray-500 text-right whitespace-nowrap">{formatCurrency(c.priorRevenue)}</td>
                                    <td className="py-1.5 px-2 text-gray-800 text-right whitespace-nowrap">{formatCurrency(c.recentRevenue)}</td>
                                    <td className="py-1.5 px-2 text-[#c44536] text-right whitespace-nowrap">
                                      {formatPercent(pct)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </AgentBubble>
                  )}
                </>
              )}

              {/* ── Drill: Products ── */}
              {drillCategory === 'products' && (
                <>
                  {!drillView && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-3">
                        Select a product report to view:
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setDrillView('positive')}
                          className="w-full border border-gray-200 hover:border-[#2e8b57] hover:bg-[#2e8b57]/5 rounded-lg px-4 py-3 transition-colors text-left flex items-center gap-3"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#2e8b57] text-white flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Biggest Positive Change</p>
                            <p className="text-xs text-gray-500">Products with the largest revenue increase from {priorMonthLabel} to {recentMonthLabel}</p>
                          </div>
                        </button>
                        <button
                          onClick={() => setDrillView('negative')}
                          className="w-full border border-gray-200 hover:border-[#c44536] hover:bg-[#c44536]/5 rounded-lg px-4 py-3 transition-colors text-left flex items-center gap-3"
                        >
                          <span className="w-8 h-8 rounded-full bg-[#c44536] text-white flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-800">Worst Change</p>
                            <p className="text-xs text-gray-500">Products with the largest revenue decline from {priorMonthLabel} to {recentMonthLabel}</p>
                          </div>
                        </button>
                      </div>
                    </AgentBubble>
                  )}

                  {/* Positive change table */}
                  {drillView === 'positive' && drillData.positive && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-1">
                        <strong>Top 10 Products — Biggest Positive Change</strong>
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        {priorMonthLabel} vs. {recentMonthLabel} 2026 revenue comparison
                      </p>
                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs border-collapse min-w-[520px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">#</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Product</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Category</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{priorMonthLabel}</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{recentMonthLabel}</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Change</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillData.positive.map((p, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 px-2 text-gray-400">{i + 1}</td>
                                <td className="py-1.5 px-2 text-gray-800 font-medium">
                                  <div className="whitespace-nowrap">{p.name}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{p.sku}</div>
                                </td>
                                <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{p.category}</td>
                                <td className="py-1.5 px-2 text-gray-500 text-right whitespace-nowrap">{formatCurrency(p.priorRevenue)}</td>
                                <td className="py-1.5 px-2 text-gray-800 text-right whitespace-nowrap">{formatCurrency(p.recentRevenue)}</td>
                                <td className="py-1.5 px-2 text-[#2e8b57] text-right whitespace-nowrap">+{formatCurrency(p.change)}</td>
                                <td className="py-1.5 px-2 text-[#2e8b57] text-right whitespace-nowrap">
                                  {p.pctChange >= 1 ? 'New' : `+${formatPercent(p.pctChange)}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AgentBubble>
                  )}

                  {/* Negative change table */}
                  {drillView === 'negative' && drillData.negative && (
                    <AgentBubble>
                      <p className="text-sm text-gray-700 mb-1">
                        <strong>Top 10 Products — Worst Change</strong>
                      </p>
                      <p className="text-xs text-gray-500 mb-3">
                        {priorMonthLabel} vs. {recentMonthLabel} 2026 revenue comparison
                      </p>
                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs border-collapse min-w-[520px]">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">#</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Product</th>
                              <th className="text-left py-1.5 px-2 font-semibold text-gray-600">Category</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{priorMonthLabel}</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">{recentMonthLabel}</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">Change</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-gray-600">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drillData.negative.map((p, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 px-2 text-gray-400">{i + 1}</td>
                                <td className="py-1.5 px-2 text-gray-800 font-medium">
                                  <div className="whitespace-nowrap">{p.name}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{p.sku}</div>
                                </td>
                                <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{p.category}</td>
                                <td className="py-1.5 px-2 text-gray-500 text-right whitespace-nowrap">{formatCurrency(p.priorRevenue)}</td>
                                <td className="py-1.5 px-2 text-gray-800 text-right whitespace-nowrap">{formatCurrency(p.recentRevenue)}</td>
                                <td className="py-1.5 px-2 text-[#c44536] text-right whitespace-nowrap">{formatCurrency(p.change)}</td>
                                <td className="py-1.5 px-2 text-[#c44536] text-right whitespace-nowrap">
                                  {formatPercent(p.pctChange)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AgentBubble>
                  )}
                </>
              )}

              {/* Back / Reset controls */}
              {(drillView || drillCategory) && (
                <div className="ml-10 flex gap-2">
                  {drillView && (
                    <button
                      onClick={() => setDrillView(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to options
                    </button>
                  )}
                  {drillCategory && !drillView && (
                    <button
                      onClick={() => setDrillCategory(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Customers / Products
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="text-xs text-[#d4a84b] hover:text-[#c9a227] bg-white border border-[#d4a84b]/30 hover:border-[#d4a84b] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Start Over
                  </button>
                </div>
              )}
            </>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Footer methodology note */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
        <div className="flex gap-2 items-start">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Demo:</span> This is a mocked agent workflow. In production,
            the forecast agent would connect to live data sources, run ML models, and apply real-time
            overrides. The data shown here is computed from the synthetic dataset.
          </p>
        </div>
      </div>
    </div>
  );
}
