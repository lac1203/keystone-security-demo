import React, { useState } from 'react';
import profileData from '../content/company-profile.json';
import testimonialsData from '../content/testimonials.json';
import faqData from '../content/faq.json';
import newsData from '../content/news-articles.json';

// ---------------------------------------------------------------------------
// Timeline Milestone
// ---------------------------------------------------------------------------
function TimelineMilestone({ year, title, description, isLast }) {
  return (
    <div className="relative pl-8 pb-8">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-[#1e3a5f]/20" />
      )}
      {/* Dot */}
      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[#1e3a5f] border-4 border-white shadow" />
      <div>
        <span className="inline-block text-xs font-bold uppercase tracking-wider text-[#d4a84b] mb-1">
          {year}
        </span>
        <h4 className="text-base font-semibold text-gray-800 mb-1">{title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
function StatCard({ value, label }) {
  return (
    <div className="text-center p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-blue-200 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Value Card
// ---------------------------------------------------------------------------
function ValueCard({ name, description }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <h4 className="text-base font-semibold text-[#1e3a5f] mb-2">{name}</h4>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leader Card
// ---------------------------------------------------------------------------
function LeaderCard({ name, title, bio, yearsWithCompany }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg">{initials}</span>
        </div>
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-gray-800">{name}</h4>
          <p className="text-sm text-[#4a7c59] font-medium">{title}</p>
          {yearsWithCompany && (
            <p className="text-xs text-gray-400 mt-0.5">
              {yearsWithCompany} years with Keystone
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed mt-4">{bio}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Testimonial Card
// ---------------------------------------------------------------------------
function TestimonialCard({ quote, author_name, title, company_name, city, state }) {
  return (
    <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
      <svg className="w-8 h-8 text-[#d4a84b]/40 mb-3" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zm-14.017 0v-7.391c0-5.704 3.731-9.57 8.983-10.609l.998 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H0z" />
      </svg>
      <p className="text-sm text-gray-700 leading-relaxed italic mb-4">"{quote}"</p>
      <div>
        <p className="text-sm font-semibold text-gray-800">{author_name}</p>
        <p className="text-xs text-gray-500">
          {title}, {company_name}
        </p>
        <p className="text-xs text-gray-400">
          {city}, {state}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location Card
// ---------------------------------------------------------------------------
function LocationCard({ name, type, address, squareFeet, capabilities }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <h4 className="text-base font-semibold text-gray-800 mb-1">{name}</h4>
      <p className="text-sm text-[#4a7c59] font-medium mb-3">{type}</p>
      <p className="text-sm text-gray-600 mb-1">{address}</p>
      <p className="text-sm text-gray-500 mb-4">
        {squareFeet.toLocaleString()} sq ft
      </p>
      <div className="flex flex-wrap gap-2">
        {capabilities.map((cap) => (
          <span
            key={cap}
            className="inline-block text-xs bg-[#1e3a5f]/5 text-[#1e3a5f] px-2.5 py-1 rounded-full"
          >
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Differentiator Card
// ---------------------------------------------------------------------------
function DifferentiatorCard({ title, description, index }) {
  const icons = [
    // Shipping
    <svg key="ship" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
    // Expertise
    <svg key="expert" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    // Inventory
    <svg key="inv" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    // Service
    <svg key="service" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  ];

  return (
    <div className="flex gap-4">
      <div className="w-12 h-12 rounded-lg bg-[#1e3a5f]/5 flex items-center justify-center flex-shrink-0 text-[#1e3a5f]">
        {icons[index] || icons[0]}
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-1">{title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ Accordion Item
// ---------------------------------------------------------------------------
function FAQItem({ question, answer, isOpen, onToggle }) {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 py-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800">{question}</span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen ? 'max-h-48 opacity-100 pb-3' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-sm text-gray-600 leading-relaxed pr-8">{answer}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ Section (manages open state)
// ---------------------------------------------------------------------------
function FAQSection() {
  const [openId, setOpenId] = useState(null);
  const [activeCategory, setActiveCategory] = useState(faqData.categories[0]?.name || '');

  const category = faqData.categories.find((c) => c.name === activeCategory);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Frequently Asked Questions</h3>
      <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-thin">
          {faqData.categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => { setActiveCategory(cat.name); setOpenId(null); }}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeCategory === cat.name
                  ? 'border-[#1e3a5f] text-[#1e3a5f]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="px-5 py-2">
          {category?.questions.map((q, i) => {
            const id = `${activeCategory}-${i}`;
            return (
              <FAQItem
                key={id}
                question={q.question}
                answer={q.answer}
                isOpen={openId === id}
                onToggle={() => setOpenId(openId === id ? null : id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// News Article Card
// ---------------------------------------------------------------------------
function NewsArticleCard({ article }) {
  const [expanded, setExpanded] = useState(false);
  const typeColors = {
    announcement: 'bg-blue-100 text-blue-700',
    industry: 'bg-emerald-100 text-emerald-700',
    technical: 'bg-amber-100 text-amber-700',
    milestone: 'bg-purple-100 text-purple-700',
  };
  const badgeClass = typeColors[article.type] || 'bg-gray-100 text-gray-700';
  const date = new Date(article.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badgeClass}`}>
          {article.type}
        </span>
        <span className="text-xs text-gray-400">{date}</span>
      </div>
      <h4 className="text-sm font-semibold text-gray-800 mb-1">{article.title}</h4>
      <p className="text-sm text-gray-600 leading-relaxed">{article.summary}</p>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {article.body.split('\n\n').map((para, i) => (
            <p key={i} className="text-sm text-gray-600 leading-relaxed mb-2 last:mb-0">{para}</p>
          ))}
          <p className="text-xs text-gray-400 mt-3">By {article.author}, {article.authorTitle}</p>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-[#1e3a5f] hover:text-[#2a4a73] mt-2 transition-colors"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About Us Page
// ---------------------------------------------------------------------------
export default function AboutUs() {
  const profile = profileData;
  const testimonials = testimonialsData.testimonials;

  const timeline = [
    {
      year: '1987',
      title: 'Founded by a Locksmith, for Locksmiths',
      description: profile.history.founding,
    },
    {
      year: '1990s-2000s',
      title: 'Building a Reputation Across the Mid-Atlantic',
      description: profile.history.growth,
    },
    {
      year: '2015',
      title: 'Cherry Hill Branch Opens',
      description: profile.history.expansion,
    },
    {
      year: 'Today',
      title: 'A Trusted Regional Partner',
      description: profile.history.today,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">About Keystone Security</h2>
        <p className="text-gray-500 mt-1">{profile.tagline}</p>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2a4a73] rounded-xl p-8 text-white">
        <h3 className="text-xl font-bold mb-3">Our Mission</h3>
        <p className="text-blue-100 leading-relaxed max-w-3xl">{profile.mission}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-8 pt-6 border-t border-white/15">
          <StatCard value={profile.stats.yearsInBusiness} label="Years in Business" />
          <StatCard value={`${profile.stats.activeCustomers}+`} label="Active Customers" />
          <StatCard value={`${(profile.stats.skusInStock / 1000).toFixed(1)}K`} label="SKUs in Stock" />
          <StatCard value={profile.stats.sameDayShipRate} label="Same-Day Ship Rate" />
          <StatCard value={profile.stats.employees} label="Team Members" />
        </div>
      </div>

      {/* Company History Timeline */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">Our History</h3>
        <div className="max-w-3xl">
          {timeline.map((item, idx) => (
            <TimelineMilestone
              key={idx}
              year={item.year}
              title={item.title}
              description={item.description}
              isLast={idx === timeline.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Core Values */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Core Values</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.values.map((value) => (
            <ValueCard key={value.name} name={value.name} description={value.description} />
          ))}
        </div>
      </div>

      {/* What Sets Us Apart */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">What Sets Us Apart</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {profile.differentiators.map((diff, idx) => (
            <DifferentiatorCard
              key={diff.title}
              title={diff.title}
              description={diff.description}
              index={idx}
            />
          ))}
        </div>
      </div>

      {/* Leadership */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Leadership Team</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.leadership.map((leader) => (
            <LeaderCard
              key={leader.name}
              name={leader.name}
              title={leader.title}
              bio={leader.bio}
              yearsWithCompany={leader.yearsWithCompany}
            />
          ))}
        </div>
      </div>

      {/* Locations */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Our Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profile.locations.map((loc) => (
            <LocationCard
              key={loc.name}
              name={loc.name}
              type={loc.type}
              address={loc.address}
              squareFeet={loc.squareFeet}
              capabilities={loc.capabilities}
            />
          ))}
        </div>
      </div>

      {/* Service Territory */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Service Territory</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-3xl">
          {profile.serviceTerritory.description}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-600 font-medium">
                <th className="px-4 py-3 rounded-l-lg">Delivery Zone</th>
                <th className="px-4 py-3">Coverage Area</th>
                <th className="px-4 py-3 rounded-r-lg">Transit Time</th>
              </tr>
            </thead>
            <tbody>
              {profile.serviceTerritory.deliveryZones.map((zone) => (
                <tr key={zone.zone} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{zone.zone}</td>
                  <td className="px-4 py-3 text-gray-600">{zone.radius || zone.area}</td>
                  <td className="px-4 py-3 text-gray-600">{zone.transitTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Testimonials */}
      {testimonials && testimonials.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            What Our Customers Say
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testimonials.slice(0, 6).map((t) => (
              <TestimonialCard
                key={t.id}
                quote={t.quote}
                author_name={t.author_name}
                title={t.title}
                company_name={t.company_name}
                city={t.city}
                state={t.state}
              />
            ))}
          </div>
        </div>
      )}

      {/* Latest News */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Latest News</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {newsData.articles.slice(0, 4).map((article) => (
            <NewsArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>

      {/* FAQ */}
      <FAQSection />

      {/* Contact CTA */}
      <div className="bg-gradient-to-br from-[#4a7c59] to-[#5a8c69] rounded-xl p-8 text-white">
        <div className="max-w-2xl">
          <h3 className="text-xl font-bold mb-2">Ready to Partner with Keystone?</h3>
          <p className="text-green-100 text-sm leading-relaxed mb-6">
            Open a wholesale account and experience the service, expertise, and reliability
            that Mid-Atlantic security professionals have trusted since 1987.
          </p>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-green-200 text-xs uppercase tracking-wide mb-1">Sales & Orders</p>
              <p className="font-semibold">(610) 555-0187</p>
            </div>
            <div>
              <p className="text-green-200 text-xs uppercase tracking-wide mb-1">Technical Support</p>
              <p className="font-semibold">(610) 555-0192</p>
            </div>
            <div>
              <p className="text-green-200 text-xs uppercase tracking-wide mb-1">Email</p>
              <p className="font-semibold">orders@keystonesecurity.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
