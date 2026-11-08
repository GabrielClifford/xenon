'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';

type Menu = { label: string; href?: string; items?: { label: string; href: string }[] };

// Laptop menu (unchanged)
const menus: Menu[] = [
  {
    label: 'Templates',
    items: [
      { label: 'Fashion & Apparel', href: '#templates' },
      { label: 'Electronics', href: '#templates' },
      { label: 'Beauty & Skincare', href: '#templates' },
    ],
  },
  {
    label: 'Features',
    items: [
      { label: 'Products & orders', href: '#features' },
      { label: 'Discount codes', href: '#features' },
      { label: 'Analytics', href: '#features' },
    ],
  },
  { label: 'Pricing', href: '#pricing' },
  {
    label: 'Resources',
    items: [
      { label: 'Customer reviews', href: '#reviews' },
      { label: 'FAQs', href: '#faq' },
    ],
  },
];

// Phone menu: change the order or the words here
const mobileLinks = [
  { label: 'FAQs', href: '#faq' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Customer Reviews', href: '#reviews' },
];

export function Logo({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="xenonX" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M4 4h10l6 9 6-9h10L25 20l11 16H26l-6-9-6 9H4l11-16z" fill="url(#xenonX)" />
    </svg>
  );
}

export default function HomeNav() {
  const [open, setOpen] = useState(false);

  function goHome() {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#030816]/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-xl font-bold text-white">Xenon</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-200 lg:flex">
          {menus.map((m) =>
            m.items ? (
              <div key={m.label} className="group relative">
                <button className="flex items-center gap-1 py-2 hover:text-white">
                  {m.label} <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="invisible absolute left-0 top-full z-10 w-52 rounded-xl border border-white/10 bg-[#0a1230] p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {m.items.map((i) => (
                    <a key={i.label} href={i.href} className="block rounded-lg px-3 py-2 text-slate-200 hover:bg-white/10">
                      {i.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={m.label} href={m.href} className="py-2 hover:text-white">
                {m.label}
              </a>
            )
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/login" className="hidden px-2 text-sm font-medium text-slate-200 hover:text-white sm:block">
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Get Started
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#030816] px-5 py-4 lg:hidden">
          <button
            onClick={goHome}
            className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/10"
          >
            Home
          </button>
          {mobileLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-slate-200 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-blue-400/40 py-3 text-center text-sm font-semibold text-white hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500"
            >
              Sign Up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}