import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loadAllData,
  loadForecast,
  computeMonthlyRevenue,
  computeCategoryBreakdown,
  getTopProducts,
  getTopCustomers,
  getRecentOrders,
} from '../utils/dataLoader';
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters';

// ── Suggested questions shown as quick-reply chips ───────────────────────────
const SUGGESTED_QUESTIONS = [
  'What was total revenue last year?',
  'Who are our top 5 customers?',
  'Which product categories perform best?',
  'Show me the 2026 forecast',
  'How many orders did we process?',
  'What are our best-selling products?',
];

// ── Typing delay range (ms) to simulate "thinking" ──────────────────────────
const TYPING_DELAY_MIN = 800;
const TYPING_DELAY_MAX = 1800;

function randomDelay() {
  return TYPING_DELAY_MIN + Math.random() * (TYPING_DELAY_MAX - TYPING_DELAY_MIN);
}

// ── Response engine: match user input to data queries ────────────────────────
async function generateResponse(input) {
  const q = input.toLowerCase().trim();

  try {
    // Revenue / sales questions
    if (q.includes('revenue') || q.includes('sales') || q.includes('total revenue')) {
      const { orders } = await loadAllData();
      const monthly = computeMonthlyRevenue(orders);
      const byYear = {};
      monthly.forEach(({ month, revenue }) => {
        const year = month.substring(0, 4);
        byYear[year] = (byYear[year] || 0) + revenue;
      });
      const years = Object.keys(byYear).sort();
      const latest = years[years.length - 1];
      const prev = years.length > 1 ? years[years.length - 2] : null;
      const growth = prev ? ((byYear[latest] - byYear[prev]) / byYear[prev]) : null;

      let text = `Here's our revenue breakdown by year:\n\n`;
      years.forEach((y) => {
        text += `  ${y}: ${formatCurrency(byYear[y])}\n`;
      });
      if (growth !== null) {
        text += `\nYear-over-year growth (${prev} to ${latest}): ${formatPercent(growth)}`;
      }
      return { text, link: { path: '/sales-trends', label: 'View Sales Trends' } };
    }

    // Top customers
    if (q.includes('top') && q.includes('customer')) {
      const { orders, customers } = await loadAllData();
      const top = getTopCustomers(orders, customers, 5);
      let text = `Here are our top 5 customers by revenue:\n\n`;
      top.forEach((c, i) => {
        text += `  ${i + 1}. ${c.company_name} (${c.city}, ${c.state}) — ${formatCurrency(c.revenue)} across ${formatNumber(c.orders)} orders\n`;
      });
      return { text, link: { path: '/customers', label: 'View Customer Map' } };
    }

    // Category performance
    if (q.includes('categor') || q.includes('breakdown')) {
      const { orderLines, products } = await loadAllData();
      const cats = computeCategoryBreakdown(orderLines, products);
      const totalRev = cats.reduce((sum, c) => sum + c.revenue, 0);
      let text = `Revenue by product category:\n\n`;
      cats.forEach((c) => {
        const pct = c.revenue / totalRev;
        const margin = (c.revenue - c.cost) / c.revenue;
        text += `  ${c.category}: ${formatCurrency(c.revenue)} (${formatPercent(pct)} share, ${formatPercent(margin)} margin)\n`;
      });
      return { text, link: { path: '/category-performance', label: 'View Category Details' } };
    }

    // Forecast
    if (q.includes('forecast') || q.includes('2026') || q.includes('projection')) {
      try {
        const forecast = await loadForecast();
        const months = forecast.monthly || [];
        const totalForecast = months.reduce((sum, m) => sum + (m.forecast || 0), 0);
        const totalActual = months.reduce((sum, m) => sum + (m.actual || 0), 0);
        const monthsWithActuals = months.filter((m) => m.actual > 0).length;

        let text = `2026 Revenue Forecast:\n\n`;
        text += `  Full-year forecast: ${formatCurrency(totalForecast)}\n`;
        if (monthsWithActuals > 0) {
          text += `  Actuals through ${monthsWithActuals} month${monthsWithActuals > 1 ? 's' : ''}: ${formatCurrency(totalActual)}\n`;
          const variance = ((totalActual - months.slice(0, monthsWithActuals).reduce((s, m) => s + (m.forecast || 0), 0)) /
            months.slice(0, monthsWithActuals).reduce((s, m) => s + (m.forecast || 0), 0));
          text += `  Variance from plan: ${formatPercent(variance)}`;
        }
        return { text, link: { path: '/forecast', label: 'View Full Forecast' } };
      } catch {
        return { text: 'The 2026 forecast data is still being prepared. Check back soon.', link: { path: '/forecast', label: 'View Forecast Page' } };
      }
    }

    // Order count / volume
    if (q.includes('order') && (q.includes('how many') || q.includes('count') || q.includes('volume') || q.includes('process'))) {
      const { orders } = await loadAllData();
      const active = orders.filter((o) => o.status !== 'CANCELLED');
      const byYear = {};
      active.forEach((o) => {
        const year = o.order_date?.substring(0, 4);
        if (year) byYear[year] = (byYear[year] || 0) + 1;
      });
      let text = `Order volume summary:\n\n`;
      text += `  Total orders (all time): ${formatNumber(active.length)}\n\n`;
      Object.keys(byYear).sort().forEach((y) => {
        text += `  ${y}: ${formatNumber(byYear[y])} orders\n`;
      });
      return { text, link: { path: '/', label: 'View Dashboard' } };
    }

    // Best-selling / top products
    if (q.includes('product') || q.includes('best-sell') || q.includes('best sell') || q.includes('top') && q.includes('sell')) {
      const { orderLines, products } = await loadAllData();
      const top = getTopProducts(orderLines, products, 5);
      let text = `Top 5 products by revenue:\n\n`;
      top.forEach((p, i) => {
        text += `  ${i + 1}. ${p.name} (${p.sku}) — ${formatCurrency(p.revenue)}, ${formatNumber(p.units)} units sold\n`;
      });
      return { text, link: { path: '/products', label: 'View Product Catalog' } };
    }

    // Margin questions
    if (q.includes('margin') || q.includes('profit')) {
      const { orders } = await loadAllData();
      const active = orders.filter((o) => o.status !== 'CANCELLED');
      const totalRev = active.reduce((s, o) => s + (o.total || 0), 0);
      const totalCost = active.reduce((s, o) => s + (o.total_cost || 0), 0);
      const avgMargin = (totalRev - totalCost) / totalRev;
      let text = `Overall margin analysis:\n\n`;
      text += `  Total revenue: ${formatCurrency(totalRev)}\n`;
      text += `  Total cost: ${formatCurrency(totalCost)}\n`;
      text += `  Gross profit: ${formatCurrency(totalRev - totalCost)}\n`;
      text += `  Average margin: ${formatPercent(avgMargin)}\n`;
      return { text, link: { path: '/category-performance', label: 'View Margin Details' } };
    }

    // Recent orders
    if (q.includes('recent') && q.includes('order')) {
      const { orders, customers } = await loadAllData();
      const recent = getRecentOrders(orders, customers, 5);
      let text = `5 most recent orders:\n\n`;
      recent.forEach((o) => {
        text += `  ${o.order_number} — ${o.customer_name} — ${formatCurrency(o.total)} (${o.status})\n`;
      });
      return { text, link: { path: '/', label: 'View Dashboard' } };
    }

    // Customer count
    if (q.includes('customer') && (q.includes('how many') || q.includes('count') || q.includes('total'))) {
      const { customers } = await loadAllData();
      const byType = {};
      customers.forEach((c) => {
        byType[c.customer_type] = (byType[c.customer_type] || 0) + 1;
      });
      const typeLabels = { LSH: 'Locksmith Shops', INT: 'Security Integrators', PMG: 'Property Managers', RET: 'Hardware Retailers' };
      let text = `We serve ${formatNumber(customers.length)} active accounts:\n\n`;
      Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
        text += `  ${typeLabels[type] || type}: ${count} accounts\n`;
      });
      return { text, link: { path: '/customers', label: 'View Customer Map' } };
    }

    // Company info / about
    if (q.includes('about') || q.includes('company') || q.includes('keystone') || q.includes('who')) {
      return {
        text: `Keystone Security Distribution has been the Mid-Atlantic's trusted security hardware partner since 1987.\n\nHeadquartered in King of Prussia, PA with a branch in Cherry Hill, NJ, we serve locksmiths, security integrators, property managers, and retailers across PA, NJ, DE, MD, VA, and DC.\n\nWe distribute products from leading manufacturers including Allegion (Schlage, Von Duprin), ASSA ABLOY (Yale, Corbin Russwin), dormakaba, and more.`,
        link: { path: '/about', label: 'Learn More About Us' },
      };
    }

    // Help / greeting
    if (q.includes('help') || q.includes('hello') || q.includes('hi') || q === 'hey') {
      return {
        text: `I can help you explore Keystone Security's business data. Try asking about:\n\n  - Revenue and sales trends\n  - Top customers or products\n  - Category performance and margins\n  - 2026 forecast and projections\n  - Order volume and history\n\nOr click one of the suggested questions below.`,
      };
    }

    // Fallback
    return {
      text: `I'm not sure how to answer that specifically, but I can help with revenue trends, customer analytics, product performance, margins, forecasts, and order history. Try asking one of the suggested questions or rephrase your query.`,
    };
  } catch (err) {
    console.error('Chat response error:', err);
    return {
      text: `I ran into an issue loading the data. Please try again in a moment.`,
    };
  }
}

// ── Chat message component ───────────────────────────────────────────────────
function ChatMessage({ message, onNavigate }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} chat-message-appear`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a7c59] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[9px] font-bold">KS</span>
            </div>
            <span className="text-xs text-gray-400 font-medium">Keystone AI</span>
          </div>
        )}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-[#1e3a5f] text-white rounded-br-md'
              : 'bg-gray-100 text-gray-800 rounded-bl-md'
          }`}
        >
          <pre className="whitespace-pre-wrap font-sans text-sm m-0">{message.text}</pre>
          {message.link && (
            <button
              onClick={() => onNavigate(message.link.path)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1e3a5f] bg-white/80 hover:bg-white px-3 py-1.5 rounded-full transition-colors border border-gray-200"
            >
              {message.link.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex justify-start chat-message-appear">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#4a7c59] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">KS</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">Keystone AI</span>
        </div>
        <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md inline-flex gap-1.5 items-center">
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '150ms' }} />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main ChatPanel component ─────────────────────────────────────────────────
export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Welcome to Keystone Security's data assistant. I can answer questions about revenue, customers, products, margins, and forecasts — all powered by real transactional data.\n\nHow can I help you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async (text) => {
    const question = text || input.trim();
    if (!question || isTyping) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const response = await generateResponse(question);

    await new Promise((r) => setTimeout(r, randomDelay()));

    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      { id: (Date.now() + 1).toString(), role: 'assistant', text: response.text, link: response.link },
    ]);
  }, [input, isTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  const handleChipClick = (question) => {
    handleSend(question);
  };

  // Show suggested chips only when there are few messages
  const showSuggestions = messages.length <= 2 && !isTyping;

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 rotate-0'
            : 'bg-[#1e3a5f] hover:bg-[#2a4a73] chat-fab-pulse'
        }`}
        aria-label={isOpen ? 'Close chat' : 'Open chat assistant'}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-48px)] chat-panel-enter">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '520px' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2a4a73] px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center">
                <span className="text-[#d4a84b] font-bold text-sm">KS</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-sm">Keystone Data Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-blue-200 text-xs">Online — powered by your data</span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors p-1"
                aria-label="Close chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-white">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} onNavigate={handleNavigate} />
              ))}

              {isTyping && <TypingIndicator />}

              {/* Suggested questions */}
              {showSuggestions && (
                <div className="pt-2">
                  <p className="text-xs text-gray-400 mb-2 font-medium">Suggested questions</p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleChipClick(q)}
                        className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-[#1e3a5f] px-3 py-1.5 rounded-full border border-gray-200 hover:border-[#1e3a5f]/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about revenue, customers, products..."
                  disabled={isTyping}
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1e3a5f] focus:ring-1 focus:ring-[#1e3a5f]/20 disabled:opacity-50 placeholder:text-gray-400 transition-all"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="w-10 h-10 bg-[#1e3a5f] hover:bg-[#2a4a73] disabled:bg-gray-300 text-white rounded-xl flex items-center justify-center transition-all disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                  </svg>
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">
                Responses generated from Keystone's transactional data
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
