'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';

type Plan = { id: string; name: string; price: string; items: { t: string; soon?: boolean }[] };

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '10,000',
    items: [{ t: '1 website' }, { t: 'Basic templates' }, { t: 'Photo gallery' }, { t: 'Online support', soon: true }],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '15,000',
    items: [{ t: 'Everything in Starter' }, { t: 'Multiple templates' }, { t: 'Advanced features', soon: true }, { t: 'Priority support', soon: true }],
  },
  {
    id: 'business',
    name: 'Business',
    price: '25,000',
    items: [{ t: 'Everything in Professional' }, { t: 'Analytics & insights', soon: true }, { t: 'Dedicated support', soon: true }],
  },
];

export default function PricingPlans() {
  const [selected, setSelected] = useState<string>('professional');

  return (
    <div>
      <div className="text-center">
        <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
          Simple &amp; Transparent Pricing
        </span>
        <h2 className="font-display mt-4 text-3xl font-bold text-white sm:text-4xl">Plans for Every Business</h2>
        <p className="mt-2 text-sm text-slate-300">Choose the plan that fits your store and upgrade as you grow.</p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const on = selected === p.id;
          const popular = p.id === 'professional';
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              onFocusCapture={() => setSelected(p.id)}
              className={`relative cursor-pointer rounded-2xl border bg-[#0a1230] p-6 transition ${
                on
                  ? 'border-blue-500 shadow-[0_0_45px_-8px_rgba(59,130,246,0.7)]'
                  : 'border-white/10 hover:border-blue-400/50'
              }`}
            >
              {popular && (
                <span className="absolute -top-3 right-5 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-white">{p.name}</h3>
              <p className="font-display mt-3 text-4xl font-bold text-white">
                ₦{p.price}
                <span className="text-sm font-normal text-slate-400"> /month</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {p.items.map((it) => (
                  <li key={it.t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span>
                      {it.t}
                      {it.soon && (
                        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          Soon
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-7 block rounded-lg py-3 text-center text-sm font-semibold transition ${
                  on ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white text-slate-900 hover:bg-blue-50'
                }`}
              >
                Get Started
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}