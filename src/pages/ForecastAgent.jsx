import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadAllData, loadForecast } from '../utils/dataLoader';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from '../utils/formatters';

// ── Seasonality indices from CLAUDE.md ───────────────────────────────────────
const SEASONALITY = {
  1: 0.78, 2: 0.72, 3: 0.92, 4: 1.08, 5: 1.15, 6: 1.22,
  7: 1.18, 8: 1.16, 9: 1.10, 10: 1.05, 11: 0.98, 12: 0.88,
};
const SEASONALITY_SUM = Object.values(SEASONALITY).reduce((a, b) => a + b, 0);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QUARTER_LABELS = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
const QUARTER_MONTHS = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

// ── Data computation helpers ─────────────────────────────────────────────────

function compute2026Actuals(orders, orderLines, products) {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  // Build order lookup for 2026 non-cancelled orders
  const orderMap = new Map();
  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    orderMap.set(o.order_id, o);
  });

  // Monthly totals
  const byMonth = {};
  for (let m = 1; m <= 12; m++) byMonth[m] = { revenue: 0, cost: 0, orders: 0 };

  orders.forEach((o) => {
    if (o.status === 'CANCELLED' || !o.order_date?.startsWith('2026')) return;
    const month = parseInt(o.order_date.substring(5, 7), 10);
    byMonth[month].revenue += o.total || 0;
    byMonth[month].cost += o.total_cost || 0;
    byMonth[month].orders += 1;
  });

  // By category
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

  // Find months with actual data
  const monthsWithData = Object.entries(byMonth)
    .filter(([, v]) => v.orders > 0)
    .map(([m]) => parseInt(m, 10))
    .sort((a, b) => a - b);

  // Find most recent complete quarter
  let mostRecentQuarter = null;
  for (let q = 4; q >= 1; q--) {
    const months = QUARTER_MONTHS[q];
    if (months.every((m) => monthsWithData.includes(m))) {
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

  // Base monthly rate = Q revenue / Q seasonality sum
  const baseRate = qRevenue / qSeasonality;

  // Project each month
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

// ── Suggested questions ──────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 1, text: 'Generate 2026 forecast using the most recent quarter method' },
  { id: 2, text: 'Show year-to-date actuals vs. original budget' },
  { id: 3, text: 'What is the variance from budget by category?' },
  { id: 4, text: 'Which categories are running ahead of budget?' },
  { id: 5, text: 'Which categories are trailing behind budget?' },
  { id: 6, text: 'Show the monthly actuals vs. budget for 2026' },
  { id: 7, text: 'What is the run rate based on the most recent quarter?' },
  { id: 8, text: 'Compare quarterly performance in 2026' },
  { id: 9, text: 'Show forecast accuracy — original budget vs. MRQ projection vs. actuals' },
  { id: 10, text: 'What is the updated full-year revenue projection by category?' },
];

// ── Answer generators ────────────────────────────────────────────────────────

function answerMRQForecast(actuals, forecast, mrq) {
  const qLabel = QUARTER_LABELS[actuals.mostRecentQuarter];
  const qMonths = QUARTER_MONTHS[actuals.mostRecentQuarter];
  const qMonthNames = qMonths.map((m) => MONTH_NAMES[m - 1]).join(', ');
  const budget = forecast.modes.full_year.overall.projected_revenue;
  const variance = mrq.fullYearProjection - budget;
  const variancePct = budget > 0 ? variance / budget : 0;
  const ytdActual = Object.values(actuals.byMonth).reduce((s, m) => s + m.revenue, 0);

  return {
    text: `Using the **Most Recent Quarter method** based on **${qLabel} (${qMonthNames})** actuals of ${formatCurrency(mrq.qRevenue)}, here is the updated 2026 forecast:`,
    table: {
      headers: ['Metric', 'Value'],
      rows: [
        ['Most Recent Quarter', `${qLabel} (${qMonthNames})`],
        [`${qLabel} Actual Revenue`, formatCurrency(mrq.qRevenue)],
        [`${qLabel} Seasonality Weight`, mrq.qSeasonality.toFixed(3)],
        ['Implied Monthly Base Rate', formatCurrency(mrq.baseRate)],
        ['MRQ Full-Year Projection', formatCurrency(mrq.fullYearProjection)],
        ['Original Budget', formatCurrency(budget)],
        ['Variance ($)', formatCurrency(variance)],
        ['Variance (%)', formatPercent(variancePct)],
        ['YTD Actual Revenue', formatCurrency(ytdActual)],
      ],
    },
  };
}

function answerYTDvsBudget(actuals, forecast) {
  const budgetMonths = forecast.modes.full_year.by_month;
  const monthsWithData = actuals.monthsWithData;
  let ytdActual = 0;
  let ytdBudget = 0;

  const rows = monthsWithData.map((m) => {
    const actual = actuals.byMonth[m].revenue;
    const budgetMonth = budgetMonths.find((b) => b.month === `2026-${String(m).padStart(2, '0')}`);
    const bgt = budgetMonth?.projected_revenue || 0;
    ytdActual += actual;
    ytdBudget += bgt;
    const var$ = actual - bgt;
    return [
      MONTH_NAMES[m - 1],
      formatCurrency(actual),
      formatCurrency(bgt),
      formatCurrency(var$),
      formatPercent(bgt > 0 ? var$ / bgt : 0),
    ];
  });

  const totalVar = ytdActual - ytdBudget;
  rows.push(['YTD Total', formatCurrency(ytdActual), formatCurrency(ytdBudget), formatCurrency(totalVar), formatPercent(ytdBudget > 0 ? totalVar / ytdBudget : 0)]);

  return {
    text: `Year-to-date actuals vs. the original 2026 budget for ${monthsWithData.length} months:`,
    table: {
      headers: ['Month', 'Actual', 'Budget', 'Variance $', 'Variance %'],
      rows,
    },
  };
}

function answerVarianceByCategory(actuals, forecast, catForecast) {
  const budgetCats = forecast.modes.full_year.by_category;
  const budgetMap = {};
  budgetCats.forEach((c) => { budgetMap[c.category] = c.projected_revenue; });

  const rows = Object.entries(catForecast)
    .sort((a, b) => b[1].fullYear - a[1].fullYear)
    .map(([cat, data]) => {
      const budget = budgetMap[cat] || 0;
      const mrqProjection = data.fullYear;
      const var$ = mrqProjection - budget;
      const varPct = budget > 0 ? var$ / budget : 0;
      return [cat, formatCurrency(data.actualTotal), formatCurrency(budget), formatCurrency(mrqProjection), formatCurrency(var$), formatPercent(varPct)];
    });

  const totalActual = Object.values(catForecast).reduce((s, d) => s + d.actualTotal, 0);
  const totalBudget = Object.values(budgetMap).reduce((s, v) => s + v, 0);
  const totalMRQ = Object.values(catForecast).reduce((s, d) => s + d.fullYear, 0);
  const totalVar = totalMRQ - totalBudget;
  rows.push(['Total', formatCurrency(totalActual), formatCurrency(totalBudget), formatCurrency(totalMRQ), formatCurrency(totalVar), formatPercent(totalBudget > 0 ? totalVar / totalBudget : 0)]);

  return {
    text: 'Variance from budget by category — comparing the original budget to the MRQ-projected full year:',
    table: {
      headers: ['Category', 'YTD Actual', 'Budget', 'MRQ Projection', 'Variance $', 'Variance %'],
      rows,
    },
  };
}

function answerAheadOfBudget(actuals, forecast, catForecast) {
  const budgetCats = forecast.modes.full_year.by_category;
  const budgetMap = {};
  budgetCats.forEach((c) => { budgetMap[c.category] = c.projected_revenue; });

  const ahead = Object.entries(catForecast)
    .map(([cat, data]) => {
      const budget = budgetMap[cat] || 0;
      return { cat, budget, mrq: data.fullYear, var$: data.fullYear - budget };
    })
    .filter((r) => r.var$ > 0)
    .sort((a, b) => b.var$ - a.var$);

  if (ahead.length === 0) {
    return { text: 'No categories are currently projecting above budget based on the MRQ method.' };
  }

  return {
    text: `**${ahead.length}** categories are projected to exceed their original budget:`,
    table: {
      headers: ['Category', 'Budget', 'MRQ Projection', 'Favorable Variance', '% Above'],
      rows: ahead.map((r) => [
        r.cat,
        formatCurrency(r.budget),
        formatCurrency(r.mrq),
        formatCurrency(r.var$),
        formatPercent(r.budget > 0 ? r.var$ / r.budget : 0),
      ]),
    },
  };
}

function answerBehindBudget(actuals, forecast, catForecast) {
  const budgetCats = forecast.modes.full_year.by_category;
  const budgetMap = {};
  budgetCats.forEach((c) => { budgetMap[c.category] = c.projected_revenue; });

  const behind = Object.entries(catForecast)
    .map(([cat, data]) => {
      const budget = budgetMap[cat] || 0;
      return { cat, budget, mrq: data.fullYear, var$: data.fullYear - budget };
    })
    .filter((r) => r.var$ < 0)
    .sort((a, b) => a.var$ - b.var$);

  if (behind.length === 0) {
    return { text: 'All categories are meeting or exceeding their original budget based on the MRQ method.' };
  }

  return {
    text: `**${behind.length}** categories are projected below their original budget:`,
    table: {
      headers: ['Category', 'Budget', 'MRQ Projection', 'Unfavorable Variance', '% Below'],
      rows: behind.map((r) => [
        r.cat,
        formatCurrency(r.budget),
        formatCurrency(r.mrq),
        formatCurrency(r.var$),
        formatPercent(r.budget > 0 ? r.var$ / r.budget : 0),
      ]),
    },
  };
}

function answerMonthlyActualsVsBudget(actuals, forecast) {
  const budgetMonths = forecast.modes.full_year.by_month;
  const rows = [];

  for (let m = 1; m <= 12; m++) {
    const actual = actuals.byMonth[m].revenue;
    const hasData = actuals.monthsWithData.includes(m);
    const budgetMonth = budgetMonths.find((b) => b.month === `2026-${String(m).padStart(2, '0')}`);
    const bgt = budgetMonth?.projected_revenue || 0;
    const var$ = actual - bgt;

    rows.push([
      MONTH_NAMES[m - 1],
      hasData ? formatCurrency(actual) : '—',
      formatCurrency(bgt),
      hasData ? formatCurrency(var$) : '—',
      hasData ? formatPercent(bgt > 0 ? var$ / bgt : 0) : '—',
      hasData ? (var$ >= 0 ? 'Favorable' : 'Unfavorable') : 'Pending',
    ]);
  }

  return {
    text: 'Monthly actuals vs. original budget for all 2026 months:',
    table: {
      headers: ['Month', 'Actual', 'Budget', 'Variance $', 'Variance %', 'Status'],
      rows,
    },
  };
}

function answerRunRate(actuals, mrq) {
  const qLabel = QUARTER_LABELS[actuals.mostRecentQuarter];
  const qMonths = QUARTER_MONTHS[actuals.mostRecentQuarter];

  const rows = qMonths.map((m) => [
    MONTH_NAMES[m - 1],
    formatCurrency(actuals.byMonth[m].revenue),
    SEASONALITY[m].toFixed(3),
    formatNumber(actuals.byMonth[m].orders),
  ]);

  const qOrders = qMonths.reduce((s, m) => s + actuals.byMonth[m].orders, 0);
  rows.push([`${qLabel} Total`, formatCurrency(mrq.qRevenue), mrq.qSeasonality.toFixed(3), formatNumber(qOrders)]);

  return {
    text: `Run rate analysis based on **${qLabel}** actuals. The implied monthly base rate (seasonality-normalized) is **${formatCurrency(mrq.baseRate)}**, which annualizes to **${formatCurrency(mrq.fullYearProjection)}**.`,
    table: {
      headers: ['Month', 'Revenue', 'Seasonality Index', 'Orders'],
      rows,
    },
  };
}

function answerQuarterlyComparison(actuals) {
  const rows = [];
  for (let q = 1; q <= 4; q++) {
    const months = QUARTER_MONTHS[q];
    const hasData = months.every((m) => actuals.monthsWithData.includes(m));
    if (!hasData) continue;

    const revenue = months.reduce((s, m) => s + actuals.byMonth[m].revenue, 0);
    const cost = months.reduce((s, m) => s + actuals.byMonth[m].cost, 0);
    const orders = months.reduce((s, m) => s + actuals.byMonth[m].orders, 0);
    const margin = revenue > 0 ? (revenue - cost) / revenue : 0;
    const avgOrder = orders > 0 ? revenue / orders : 0;

    rows.push([
      QUARTER_LABELS[q],
      formatCurrency(revenue),
      formatNumber(orders),
      formatCurrency(avgOrder),
      formatPercent(margin),
    ]);
  }

  if (rows.length < 2) {
    return { text: 'Not enough complete quarters available to compare.' };
  }

  return {
    text: `Quarterly performance comparison for 2026 (${rows.length} complete quarters):`,
    table: {
      headers: ['Quarter', 'Revenue', 'Orders', 'Avg Order', 'Margin'],
      rows,
    },
  };
}

function answerForecastAccuracy(actuals, forecast, mrq) {
  const budgetMonths = forecast.modes.full_year.by_month;
  const rows = [];

  for (let m = 1; m <= 12; m++) {
    const hasData = actuals.monthsWithData.includes(m);
    const actual = hasData ? actuals.byMonth[m].revenue : null;
    const budgetMonth = budgetMonths.find((b) => b.month === `2026-${String(m).padStart(2, '0')}`);
    const budget = budgetMonth?.projected_revenue || 0;
    const mrqProj = mrq.projected[m];
    const budgetErr = actual !== null && budget > 0 ? (actual - budget) / budget : null;
    const mrqErr = actual !== null && mrqProj > 0 ? (actual - mrqProj) / mrqProj : null;

    rows.push([
      MONTH_NAMES[m - 1],
      hasData ? formatCurrency(actual) : '—',
      formatCurrency(budget),
      formatCurrency(mrqProj),
      budgetErr !== null ? formatPercent(budgetErr) : '—',
      mrqErr !== null ? formatPercent(mrqErr) : '—',
    ]);
  }

  return {
    text: 'Comparing original budget vs. MRQ projection vs. actual results for each month:',
    table: {
      headers: ['Month', 'Actual', 'Budget', 'MRQ Proj.', 'Budget Error', 'MRQ Error'],
      rows,
    },
  };
}

function answerFullYearByCategory(actuals, forecast, catForecast) {
  const budgetCats = forecast.modes.full_year.by_category;
  const budgetMap = {};
  budgetCats.forEach((c) => { budgetMap[c.category] = c; });

  const rows = Object.entries(catForecast)
    .sort((a, b) => b[1].fullYear - a[1].fullYear)
    .map(([cat, data]) => {
      const budget = budgetMap[cat]?.projected_revenue || 0;
      const share = Object.values(catForecast).reduce((s, d) => s + d.fullYear, 0);
      const catShare = share > 0 ? data.fullYear / share : 0;
      return [
        cat,
        formatCurrency(data.fullYear),
        formatCurrency(budget),
        formatCurrency(data.fullYear - budget),
        formatPercent(catShare),
        formatCurrency(data.fullYear / 12),
      ];
    });

  const totalMRQ = Object.values(catForecast).reduce((s, d) => s + d.fullYear, 0);
  const totalBudget = Object.values(budgetMap).reduce((s, c) => s + c.projected_revenue, 0);
  rows.push(['Total', formatCurrency(totalMRQ), formatCurrency(totalBudget), formatCurrency(totalMRQ - totalBudget), '100.0%', formatCurrency(totalMRQ / 12)]);

  return {
    text: 'Updated full-year projection by category using the most recent quarter method:',
    table: {
      headers: ['Category', 'MRQ Projection', 'Original Budget', 'Variance', 'Share', 'Avg/Month'],
      rows,
    },
  };
}

// ── Chat message components ──────────────────────────────────────────────────

function UserMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div className="bg-[#1e3a5f] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] shadow-sm">
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}

function AgentMessage({ answer }) {
  return (
    <div className="flex justify-start gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4a84b] to-[#c9a227] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] shadow-sm">
        <p className="text-sm text-gray-700 mb-2">{answer.text}</p>
        {answer.table && (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs border-collapse min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-200">
                  {answer.table.headers.map((h, i) => (
                    <th key={i} className="text-left py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.table.rows.map((row, ri) => {
                  const isTotal = row[0] === 'Total' || row[0] === 'YTD Total' || row[0]?.includes('Total');
                  return (
                    <tr key={ri} className={`border-b border-gray-100 last:border-0 ${isTotal ? 'bg-gray-50 font-medium' : ''}`}>
                      {row.map((cell, ci) => {
                        const isNegative = typeof cell === 'string' && cell.startsWith('-');
                        const isPositiveVar = typeof cell === 'string' && cell.startsWith('+');
                        const isFavorable = cell === 'Favorable';
                        const isUnfavorable = cell === 'Unfavorable';
                        let colorClass = 'text-gray-700';
                        if (isNegative || isUnfavorable) colorClass = 'text-[#c44536]';
                        else if (isFavorable) colorClass = 'text-[#2e8b57]';
                        return (
                          <td key={ci} className={`py-1.5 px-2 whitespace-nowrap ${colorClass}`}>{cell}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4a84b] to-[#c9a227] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main page component ──────────────────────────────────────────────────────

export default function ForecastAgent() {
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [askedIds, setAskedIds] = useState(new Set());
  const chatEndRef = useRef(null);

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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Pre-compute forecast model
  const computed = useMemo(() => {
    if (!data || !forecast) return null;
    const actuals = compute2026Actuals(data.orders, data.orderLines, data.products);
    if (!actuals.mostRecentQuarter) return { actuals, mrq: null, catForecast: null };
    const mrq = runMRQForecast(actuals, actuals.mostRecentQuarter);
    const catForecast = runMRQForecastByCategory(actuals, actuals.mostRecentQuarter);
    return { actuals, mrq, catForecast };
  }, [data, forecast]);

  const availableQuestions = useMemo(
    () => QUESTIONS.filter((q) => !askedIds.has(q.id)),
    [askedIds]
  );

  const handleQuestion = useCallback(
    (question) => {
      if (!computed || isTyping) return;
      const { actuals, mrq, catForecast } = computed;

      setMessages((prev) => [...prev, { role: 'user', text: question.text }]);
      setAskedIds((prev) => new Set([...prev, question.id]));
      setIsTyping(true);

      const delay = 1000 + Math.random() * 1500;
      setTimeout(() => {
        let answer;
        switch (question.id) {
          case 1: answer = answerMRQForecast(actuals, forecast, mrq); break;
          case 2: answer = answerYTDvsBudget(actuals, forecast); break;
          case 3: answer = answerVarianceByCategory(actuals, forecast, catForecast); break;
          case 4: answer = answerAheadOfBudget(actuals, forecast, catForecast); break;
          case 5: answer = answerBehindBudget(actuals, forecast, catForecast); break;
          case 6: answer = answerMonthlyActualsVsBudget(actuals, forecast); break;
          case 7: answer = answerRunRate(actuals, mrq); break;
          case 8: answer = answerQuarterlyComparison(actuals); break;
          case 9: answer = answerForecastAccuracy(actuals, forecast, mrq); break;
          case 10: answer = answerFullYearByCategory(actuals, forecast, catForecast); break;
          default: answer = { text: 'Question not recognized.' };
        }
        setMessages((prev) => [...prev, { role: 'agent', answer }]);
        setIsTyping(false);
      }, delay);
    },
    [computed, forecast, isTyping]
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setAskedIds(new Set());
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

  const qLabel = computed?.actuals?.mostRecentQuarter
    ? QUARTER_LABELS[computed.actuals.mostRecentQuarter]
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Forecast Agent</h2>
        <p className="text-gray-500 text-sm mt-1">
          Revenue forecasting using the Most Recent Quarter (MRQ) method — comparing actuals
          against budget with seasonality-adjusted projections.
          {qLabel && (
            <span className="ml-1 inline-block bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded">
              Using {qLabel} as base
            </span>
          )}
        </p>
      </div>

      {/* Chat container */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="flex justify-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4a84b] to-[#c9a227] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] shadow-sm">
                <p className="text-sm text-gray-700">
                  Hi, I'm the forecast agent. I use the <strong>Most Recent Quarter method</strong> to
                  generate updated revenue projections for 2026. I compare the seasonality-adjusted
                  run rate from the latest complete quarter against the original budget to identify
                  variances by category. Select a question below to begin.
                </p>
                {qLabel && (
                  <p className="text-xs text-gray-500 mt-2">
                    Detected <strong>{qLabel}</strong> as the most recent complete quarter with {computed?.actuals?.monthsWithData?.length || 0} months of 2026 data available.
                  </p>
                )}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <UserMessage key={i} text={msg.text} />
            ) : (
              <AgentMessage key={i} answer={msg.answer} />
            )
          )}

          {isTyping && <TypingIndicator />}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 bg-white rounded-b-xl p-4">
          {availableQuestions.length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {availableQuestions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handleQuestion(q)}
                    disabled={isTyping}
                    className="text-xs bg-white border border-gray-300 hover:border-[#d4a84b] hover:text-[#9a7a1c] text-gray-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                All questions answered. Reset the conversation to start over.
              </p>
              <button
                onClick={handleReset}
                className="text-xs bg-[#d4a84b] hover:bg-[#c9a227] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Reset Chat
              </button>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Free-form forecasting queries coming soon — select a question above"
              disabled
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 cursor-not-allowed"
            />
            <button
              disabled
              className="bg-gray-200 text-gray-400 px-4 py-2 rounded-lg text-sm cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
        <div className="flex gap-2 items-start">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Methodology:</span> The Most Recent Quarter (MRQ) method
            takes the latest complete quarter's actual revenue, normalizes it by removing seasonality,
            then re-applies monthly seasonality indices to project the full year. This produces a
            run-rate forecast that reflects the most current business trends.
          </p>
        </div>
      </div>
    </div>
  );
}
