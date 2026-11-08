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
        <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[10px] font-medium text-blue-200 sm:px-3 sm:text-xs">
          Simple &amp; Transparent Pricing
        </span>
        <h2 className="font-display mt-3 text-[26px] font-bold leading-tight text-white sm:mt-4 sm:text-4xl">Plans for Every Business</h2>
        <p className="mt-2 text-xs text-slate-300 sm:text-sm">Choose the plan that fits your store and upgrade as you grow.</p>
      </div>

      <div className="mx-auto mt-9 grid max-w-5xl grid-cols-3 gap-2 sm:mt-12 sm:gap-4 md:gap-6">
        {plans.map((p) => {
          const on = selected === p.id;
          const popular = p.id === 'professional';
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p.id)}
              onFocusCapture={() => setSelected(p.id)}
              className={`relative cursor-pointer rounded-xl border bg-[#0a1230] p-2.5 transition sm:rounded-2xl sm:p-6 ${
                on
                  ? 'border-blue-500 shadow-[0_0_35px_-8px_rgba(59,130,246,0.7)]'
                  : 'border-white/10 hover:border-blue-400/50'
              }`}
            >
              {popular && (
                <span className="absolute -top-2.5 right-1.5 rounded-md bg-blue-600 px-1.5 py-0.5 text-[8px] font-semibold text-white sm:-top-3 sm:right-5 sm:px-3 sm:py-1 sm:text-[11px]">
                  Most Popular
                </span>
              )}
              <h3 className="font-display text-[12px] font-bold text-white sm:text-lg">{p.name}</h3>
              <p className="font-display mt-1.5 text-[16px] font-bold leading-none text-white sm:mt-3 sm:text-4xl">
                ₦{p.price}
                <span className="mt-0.5 block text-[9px] font-normal text-slate-400 sm:ml-1 sm:inline sm:text-sm">/month</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[10px] leading-snug text-slate-300 sm:mt-6 sm:space-y-3 sm:text-sm">
                {p.items.map((it) => (
                  <li key={it.t} className="flex items-start gap-1 sm:gap-2">
                    <Check className="mt-px h-3 w-3 shrink-0 text-blue-400 sm:mt-0.5 sm:h-4 sm:w-4" />
                    <span>
                      {it.t}
                      {it.soon && (
                        <span className="ml-1 rounded-full bg-white/10 px-1.5 py-px text-[8px] font-semibold text-slate-300 sm:ml-2 sm:px-2 sm:py-0.5 sm:text-[10px]">
                          Soon
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-4 block rounded-lg py-2 text-center text-[10px] font-semibold transition sm:mt-7 sm:py-3 sm:text-sm ${
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