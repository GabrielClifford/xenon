'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

type ItemRow = {
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  products: { photo_url: string | null } | null;
};
type Top = { key: string; name: string; photo: string | null; sold: number; revenue: number };

export function TopProducts({ businessId, onViewAll }: { businessId: string; onViewAll: () => void }) {
  const [rows, setRows] = useState<Top[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await createClient()
        .from('order_items')
        .select('product_id, name, price, quantity, products(photo_url), orders!inner(business_id, status)')
        .eq('orders.business_id', businessId)
        .neq('orders.status', 'cancelled')
        .limit(2000);
      const map = new Map<string, Top>();
      for (const r of (data ?? []) as unknown as ItemRow[]) {
        const key = r.product_id ?? r.name;
        const cur = map.get(key) ?? { key, name: r.name, photo: r.products?.photo_url ?? null, sold: 0, revenue: 0 };
        cur.sold += r.quantity;
        cur.revenue += r.price * r.quantity;
        map.set(key, cur);
      }
      setRows([...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5));
    })();
  }, [businessId]);

  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-900">Top products</h2>
        <button onClick={onViewAll} className="text-sm font-medium text-blue-600 hover:underline">
          View all
        </button>
      </div>
      {rows === null ? (
        <p className="mt-3 text-sm text-slate-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Your best sellers will show here once you get orders.</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 py-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {r.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500">{r.sold} sold</p>
              <p className="w-24 text-right text-sm font-semibold">{naira(r.revenue)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SalesBreakdown({ businessId, onViewAll }: { businessId: string; onViewAll: () => void }) {
  const [rows, setRows] = useState<{ label: string; amount: number }[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await createClient()
        .from('orders')
        .select('total, payment_method')
        .eq('business_id', businessId)
        .neq('status', 'cancelled');
      const sums = { cod: 0, transfer: 0 };
      for (const o of data ?? []) sums[o.payment_method as 'cod' | 'transfer'] += Number(o.total);
      setRows(
        [
          { label: 'Pay on delivery', amount: sums.cod },
          { label: 'Bank transfer', amount: sums.transfer },
        ].filter((r) => r.amount > 0)
      );
    })();
  }, [businessId]);

  const total = (rows ?? []).reduce((n, r) => n + r.amount, 0);

  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-slate-900">Total sales breakdown</h2>
        <button onClick={onViewAll} className="text-sm font-medium text-blue-600 hover:underline">
          Orders
        </button>
      </div>
      {rows === null ? (
        <p className="mt-3 text-sm text-slate-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No sales yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-slate-100 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2.5">
              <span>{r.label}</span>
              <span className="flex gap-4">
                <span className="font-medium">{naira(r.amount)}</span>
                <span className="w-10 text-right text-slate-500">{Math.round((r.amount / total) * 100)}%</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type Recent = { id: string; order_number: number; customer_name: string; total: number; created_at: string };

export function RecentActivity({ businessId, createdAt }: { businessId: string; createdAt: string }) {
  const [orders, setOrders] = useState<Recent[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await createClient()
        .from('orders')
        .select('id, order_number, customer_name, total, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5);
      setOrders((data as Recent[]) ?? []);
    })();
  }, [businessId]);

  return (
    <div className={`${card} p-5`}>
      <h2 className="font-display text-lg font-semibold text-slate-900">Recent activity</h2>
      <div className="mt-3 space-y-3">
        {(orders ?? []).map((o) => (
          <div key={o.id} className="text-sm">
            <p className="font-medium text-slate-900">
              New order #{o.order_number} from {o.customer_name}
            </p>
            <p className="text-xs text-slate-500">
              {ago(o.created_at)} · {naira(o.total)}
            </p>
          </div>
        ))}
        <p className="text-sm text-slate-600">
          Business created on{' '}
          {new Date(createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </div>
  );
}