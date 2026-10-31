'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Menu, X, Zap } from 'lucide-react';

const links = [
  { label: 'Home', href: '/' },
  { label: 'Templates', href: '/#templates' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#050b18]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="font-display flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
            X
          </span>
          <span className="leading-tight">
            <span className="font-display block text-xl font-bold text-white">Xenon</span>
            <span className="hidden text-[10px] text-slate-400 sm:block">Build · Grow · Online</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="transition hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="text-white md:hidden" aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col border-t border-white/10 bg-[#050b18] px-5 pb-4 md:hidden">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-white/10 py-3.5 text-sm font-medium text-slate-200"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg border border-white/20 py-2.5 text-center text-sm font-medium text-white">
              Log in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white">
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}