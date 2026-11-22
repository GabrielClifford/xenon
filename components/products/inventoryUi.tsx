'use client';

// Small shared pieces for the Inventory pages.
import { Badge } from '@/components/products/ui';
import { type State } from '@/lib/inventory';

export function downloadCsv(name: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);

export function StateBadge({ state }: { state: State }) {
  if (state === 'out') return <Badge tone="red">Out of stock</Badge>;
  if (state === 'low') return <Badge tone="amber">Low stock</Badge>;
  if (state === 'untracked') return <Badge tone="grey">Not tracked</Badge>;
  return <Badge tone="green">In stock</Badge>;
}

export function Thumb({ url, size = 'h-10 w-10' }: { url: string | null; size?: string }) {
  return (
    <span className={`${size} shrink-0 overflow-hidden rounded-lg bg-slate-100`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  );
}

export function Stat({ label, value, hint, onClick, active }: { label: string; value: string; hint?: string; onClick?: () => void; active?: boolean }) {
  const body = (
    <>
      <span className="block text-xs font-medium text-slate-500">{label}</span>
      <span className="mt-1 block font-display text-xl font-bold text-slate-900">{value}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
    </>
  );
  const cls = `rounded-2xl border bg-white p-4 text-left shadow-sm ${active ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} transition hover:border-slate-300`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
