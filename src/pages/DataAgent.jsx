import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  loadAllData,
  computeMonthlyRevenue,
  computeCategoryBreakdown,
  getTopProducts,
  getTopCustomers,
  getRecentOrders,
} from '../utils/dataLoader';
import {
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatNumber,
  formatMonthShort,
  customerTypeLabel,
} from '../utils/formatters';

// ── Suggested questions ──────────────────────────────────────────────────────
const QUESTIONS = [
  { id: 1, text: 'Who are the top 10 customers by revenue?' },
  { id: 2, text: 'Show me revenue by month for 2025.' },
  { id: 3, text: 'What are the top 10 products by revenue?' },
  { id: 4, text: 'What are margins by product category?' },
  { id: 5, text: 'How many orders were placed in 2025?' },
  { id: 6, text: 'Which state generates the most revenue?' },
  { id: 7, text: 'What is the year-over-year revenue growth?' },
  { id: 8, text: 'Who are the top 5 manufacturers by revenue?' },
  { id: 9, text: 'Show me the 10 most recent orders.' },
  { id: 10, text: 'What is the average order value by customer type?' },
];

// ── Answer generators ────────────────────────────────────────────────────────
// Each returns { text: string, table?: { headers: string[], rows: string[][] } }

function answerTopCustomers({ orders, customers }) {
  const top = getTopCustomers(orders, customers, 10);
  return {
    text: `Here are the top 10 customers by total revenue across all years:`,
    table: {
      headers: ['Rank', 'Company', 'Type', 'Location', 'Orders', 'Revenue'],
      rows: top.map((c, i) => [
        `${i + 1}`,
        c.company_name,
        customerTypeLabel(c.customer_type),
        `${c.city}, ${c.state}`,
        formatNumber(c.orders),
        formatCurrency(c.revenue),
      ]),
    },
  };
}

function answerRevenue2025({ orders }) {
  const monthly = computeMonthlyRevenue(orders).filter((m) => m.month.startsWith('2025'));
  const total = monthly.reduce((s, m) => s + m.revenue, 0);
  return {
    text: `Monthly revenue for 2025 — full-year total: ${formatCurrency(total)}`,
    table: {
      headers: ['Month', 'Revenue', 'Orders', 'Avg Order'],
      rows: monthly.map((m) => [
        formatMonthShort(m.month),
        formatCurrency(m.revenue),
        formatNumber(m.orders),
        formatCurrency(m.orders > 0 ? m.revenue / m.orders : 0),
      ]),
    },
  };
}

function answerTopProducts({ orderLines, products }) {
  const top = getTopProducts(orderLines, products, 10);
  return {
    text: 'Top 10 products ranked by total revenue:',
    table: {
      headers: ['Rank', 'SKU', 'Product', 'Category', 'Units', 'Revenue'],
      rows: top.map((p, i) => [
        `${i + 1}`,
        p.sku,
        p.name.length > 35 ? p.name.substring(0, 35) + '...' : p.name,
        p.category,
        formatNumber(p.units),
        formatCurrency(p.revenue),
      ]),
    },
  };
}

function answerCategoryMargins({ orderLines, products }) {
  const cats = computeCategoryBreakdown(orderLines, products);
  return {
    text: 'Margin performance by product category:',
    table: {
      headers: ['Category', 'Revenue', 'Cost', 'Margin $', 'Margin %'],
      rows: cats.map((c) => {
        const margin = c.revenue > 0 ? (c.revenue - c.cost) / c.revenue : 0;
        return [
          c.category,
          formatCurrency(c.revenue),
          formatCurrency(c.cost),
          formatCurrency(c.revenue - c.cost),
          formatPercent(margin),
        ];
      }),
    },
  };
}

function answerOrderCount2025({ orders }) {
  const year = orders.filter(
    (o) => o.order_date?.startsWith('2025') && o.status !== 'CANCELLED'
  );
  const total = year.reduce((s, o) => s + (o.total || 0), 0);
  const avgOrder = year.length > 0 ? total / year.length : 0;
  return {
    text:
      `In 2025, there were **${formatNumber(year.length)}** orders placed ` +
      `(excluding cancelled). Total revenue: ${formatCurrency(total)}. ` +
      `Average order value: ${formatCurrency(avgOrder)}.`,
  };
}

function answerStateRevenue({ orders, customers }) {
  const customerMap = new Map();
  customers.forEach((c) => customerMap.set(c.customer_id, c));

  const byState = {};
  orders.forEach((o) => {
    if (o.status === 'CANCELLED') return;
    const cust = customerMap.get(o.customer_id);
    const state = cust?.state || 'Unknown';
    if (!byState[state]) byState[state] = { state, revenue: 0, orders: 0 };
    byState[state].revenue += o.total || 0;
    byState[state].orders += 1;
  });
  const sorted = Object.values(byState).sort((a, b) => b.revenue - a.revenue);
  const grandTotal = sorted.reduce((s, r) => s + r.revenue, 0);

  return {
    text: 'Revenue breakdown by state:',
    table: {
      headers: ['State', 'Revenue', 'Orders', '% of Total'],
      rows: sorted.map((s) => [
        s.state,
        formatCurrency(s.revenue),
        formatNumber(s.orders),
        formatPercent(grandTotal > 0 ? s.revenue / grandTotal : 0),
      ]),
    },
  };
}

function answerYoYGrowth({ orders }) {
  const monthly = computeMonthlyRevenue(orders);
  const byYear = {};
  monthly.forEach((m) => {
    const year = m.month.substring(0, 4);
    if (!byYear[year]) byYear[year] = 0;
    byYear[year] += m.revenue;
  });
  const years = Object.keys(byYear).sort();

  return {
    text: 'Year-over-year revenue growth:',
    table: {
      headers: ['Year', 'Revenue', 'Growth $', 'Growth %'],
      rows: years.map((y, i) => {
        const prev = i > 0 ? byYear[years[i - 1]] : null;
        const growth = prev ? byYear[y] - prev : null;
        const pct = prev && prev > 0 ? growth / prev : null;
        return [
          y,
          formatCurrency(byYear[y]),
          growth !== null ? formatCurrency(growth) : '—',
          pct !== null ? formatPercent(pct) : '—',
        ];
      }),
    },
  };
}

function answerTopManufacturers({ orderLines, products }) {
  const productMap = new Map();
  products.forEach((p) => productMap.set(p.product_id, p));

  const byMfr = {};
  orderLines.forEach((line) => {
    const product = productMap.get(line.product_id);
    if (!product) return;
    const mfr = product.manufacturer || 'Unknown';
    if (!byMfr[mfr]) byMfr[mfr] = { manufacturer: mfr, revenue: 0, products: new Set() };
    byMfr[mfr].revenue += line.line_total || 0;
    byMfr[mfr].products.add(line.product_id);
  });

  const sorted = Object.values(byMfr)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    text: 'Top 5 manufacturers by revenue:',
    table: {
      headers: ['Rank', 'Manufacturer', 'SKUs Sold', 'Revenue'],
      rows: sorted.map((m, i) => [
        `${i + 1}`,
        m.manufacturer,
        formatNumber(m.products.size),
        formatCurrency(m.revenue),
      ]),
    },
  };
}

function answerRecentOrders({ orders, customers }) {
  const recent = getRecentOrders(orders, customers, 10);
  return {
    text: 'The 10 most recent orders:',
    table: {
      headers: ['Order #', 'Date', 'Customer', 'Total', 'Status'],
      rows: recent.map((o) => [
        o.order_number,
        o.order_date,
        o.customer_name.length > 30 ? o.customer_name.substring(0, 30) + '...' : o.customer_name,
        formatCurrencyFull(o.total),
        o.status,
      ]),
    },
  };
}

function answerAvgOrderByType({ orders, customers }) {
  const customerMap = new Map();
  customers.forEach((c) => customerMap.set(c.customer_id, c));

  const byType = {};
  orders.forEach((o) => {
    if (o.status === 'CANCELLED') return;
    const cust = customerMap.get(o.customer_id);
    const type = cust?.customer_type || 'Unknown';
    if (!byType[type]) byType[type] = { type, revenue: 0, orders: 0 };
    byType[type].revenue += o.total || 0;
    byType[type].orders += 1;
  });

  const sorted = Object.values(byType).sort((a, b) => b.revenue - a.revenue);
  return {
    text: 'Average order value by customer type:',
    table: {
      headers: ['Customer Type', 'Orders', 'Total Revenue', 'Avg Order Value'],
      rows: sorted.map((t) => [
        customerTypeLabel(t.type),
        formatNumber(t.orders),
        formatCurrency(t.revenue),
        formatCurrency(t.orders > 0 ? t.revenue / t.orders : 0),
      ]),
    },
  };
}

const ANSWER_MAP = {
  1: answerTopCustomers,
  2: answerRevenue2025,
  3: answerTopProducts,
  4: answerCategoryMargins,
  5: answerOrderCount2025,
  6: answerStateRevenue,
  7: answerYoYGrowth,
  8: answerTopManufacturers,
  9: answerRecentOrders,
  10: answerAvgOrderByType,
};

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
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4a7c59] to-[#2e8b57] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
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
                    <th
                      key={i}
                      className="text-left py-1.5 px-2 font-semibold text-gray-600 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {answer.table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-gray-100 last:border-0">
                    {row.map((cell, ci) => (
                      <td key={ci} className="py-1.5 px-2 text-gray-700 whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
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
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4a7c59] to-[#2e8b57] flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
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

export default function DataAgent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [askedIds, setAskedIds] = useState(new Set());
  const chatEndRef = useRef(null);

  useEffect(() => {
    loadAllData()
      .then((d) => {
        setData(d);
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

  const availableQuestions = useMemo(
    () => QUESTIONS.filter((q) => !askedIds.has(q.id)),
    [askedIds]
  );

  const handleQuestion = useCallback(
    (question) => {
      if (!data || isTyping) return;

      // Add user message
      setMessages((prev) => [...prev, { role: 'user', text: question.text }]);
      setAskedIds((prev) => new Set([...prev, question.id]));
      setIsTyping(true);

      // Simulate agent "thinking"
      const delay = 800 + Math.random() * 1200;
      setTimeout(() => {
        const answerFn = ANSWER_MAP[question.id];
        if (answerFn) {
          const answer = answerFn(data);
          setMessages((prev) => [...prev, { role: 'agent', answer }]);
        }
        setIsTyping(false);
      }, delay);
    },
    [data, isTyping]
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setAskedIds(new Set());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading data for agent...</p>
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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Data Agent</h2>
        <p className="text-gray-500 text-sm mt-1">
          Ask questions about Keystone Security's data — powered by an AI agent that queries
          orders, products, and customers in real time.
        </p>
      </div>

      {/* Chat container */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="flex justify-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4a7c59] to-[#2e8b57] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.59-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
                </svg>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] shadow-sm">
                <p className="text-sm text-gray-700">
                  Hi, I'm the Keystone Security data agent. I can query our orders, products,
                  and customer data to answer your questions. Select a question below to get started.
                </p>
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) =>
            msg.role === 'user' ? (
              <UserMessage key={i} text={msg.text} />
            ) : (
              <AgentMessage key={i} answer={msg.answer} />
            )
          )}

          {/* Typing indicator */}
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
                    className="text-xs bg-white border border-gray-300 hover:border-[#1e3a5f] hover:text-[#1e3a5f] text-gray-700 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="text-xs bg-[#1e3a5f] hover:bg-[#2a4a73] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Reset Chat
              </button>
            </div>
          )}

          {/* Mock text input (disabled, for visual effect) */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Agent queries are coming soon — select a question above"
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
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <div className="flex gap-2 items-start">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            <span className="font-semibold">Demo:</span> This interface demonstrates how an AI agent
            can be connected to business data sources to answer natural-language queries. In production,
            the agent would accept free-form questions and generate SQL or API calls dynamically.
          </p>
        </div>
      </div>
    </div>
  );
}
