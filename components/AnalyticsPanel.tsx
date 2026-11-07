'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Banknote, Eye, Percent, Receipt, ShoppingCart, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import ChannelBreakdown from '@/components/ChannelBreakdown';
import { SalesBreakdown } from '@/components/SalesPanels';
import { StatsSkeleton } from '@/components/Skeleton';
import type { Tab } from '@/components/DashboardOverview';

type RangeKey = '7d' | '30d' | '90d' | '1y';
const ranges: { key: RangeKey; days: number }[] = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '1y', days: 365 },
];
type MetricKey = 'visits' | 'orders' | 'revenue';

type Point = { day: string; visits: number; uniques: number; orders: number; revenue: number; enquiries: number };
type DayRow = { day: string; visits: number | string; uniques: number | string };
type OrderRow = { created_at: string; total: number; status: string };
type ItemRow = {
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  products: { photo_url: string | null } | null;
};
type TopRow = { key: string; name: string; photo: string | null; sold: number; revenue: number };
type Data = {
  n: number;
  businessId: string;
  published: boolean;
  points: Point[];
  statusCounts: Record<string, number>;
  top: TopRow[];
};
type State = { kind: 'loading' } | { kind: 'none' } | { kind: 'error' } | { kind: 'ready'; data: Data };

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');
const lagosKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const sum = (a: Point[], f: (p: Point) => number) => a.reduce((n, p) => n + f(p), 0);

function percentChange(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <p className="mt-1 text-xs text-slate-400">No earlier data</p>;
  const up = pct >= 0;
  return (
    <p className={`mt-1 text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% vs previous period
    </p>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  pct,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  pct: number | null;
}) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-display truncate text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      <Change pct={pct} />
    </div>
  );
}

type Bucket = { label: string; visits: number; orders: number; revenue: number };

function bucketize(pts: Point[], size: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = 0; i < pts.length; i += size) {
    const chunk = pts.slice(i, i + size);
    out.push({
      label:
        size === 1
          ? fmtDay(chunk[0].day)
          : `${fmtDay(chunk[0].day)} – ${fmtDay(chunk[chunk.length - 1].day)}`,
      visits: sum(chunk, (p) => p.visits),
      orders: sum(chunk, (p) => p.orders),
      revenue: sum(chunk, (p) => p.revenue),
    });
  }
  return out;
}

function Bars({
  items,
  format,
  color,
}: {
  items: { label: string; value: number }[];
  format: (n: number) => string;
  color: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((n, i) => n + i.value, 0);
  const mid = items[Math.floor(items.length / 2)];

  return (
    <div>
      <p className="mb-3 h-5 text-sm text-slate-600">
        {hover !== null ? (
          <>
            {items[hover].label}: <b className="text-slate-900">{format(items[hover].value)}</b>
          </>
        ) : (
          <>
            Total: <b className="text-slate-900">{format(total)}</b>
          </>
        )}
      </p>
      <div className="flex h-52 items-end gap-1" onPointerLeave={() => setHover(null)}>
        {items.map((it, i) => (
          <div
            key={i}
            className="flex h-full flex-1 items-end"
            onPointerEnter={() => setHover(i)}
            onClick={() => setHover(i)}
          >
            <div
              className="w-full rounded-t-md transition-opacity"
              style={{
                height: `${Math.max(2, (it.value / max) * 100)}%`,
                background: color,
                opacity: hover === null || hover === i ? 1 : 0.4,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{items[0].label.split(' – ')[0]}</span>
        {items.length > 4 && <span>{mid.label.split(' – ')[0]}</span>}
        <span>{items[items.length - 1].label.split(' – ')[0]}</span>
      </div>
    </div>
  );
}

const metrics: Record<MetricKey, { label: string; color: string; fmt: (n: number) => string }> = {
  visits: { label: 'Visits', color: '#2563eb', fmt: (n) => n.toLocaleString() },
  orders: { label: 'Orders', color: '#0ea5e9', fmt: (n) => n.toLocaleString() },
  revenue: { label: 'Revenue', color: '#6366f1', fmt: naira },
};

const statusRows = [
  { key: 'new', label: 'New', color: '#2563eb' },
  { key: 'preparing', label: 'Preparing', color: '#f59e0b' },
  { key: 'delivered', label: 'Delivered', color: '#16a34a' },
  { key: 'cancelled', label: 'Cancelled', color: '#94a3b8' },
];

export default function AnalyticsPanel({
  user,
  active = true,
  onNavigate,
}: {
  user: User;
  active?: boolean;
  onNavigate?: (tab: Tab) => void;
}) {
  const [range, setRange] = useState<RangeKey>('7d');
  const [metric, setMetric] = useState<MetricKey>('visits');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  const n = ranges.find((r) => r.key === range)!.days;

  useEffect(() => {
    if (!active && loaded.current) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      setBusy(true);
      const { data: biz } = await supabase
        .from('businesses')
        .select('id,published')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!biz) {
        setState({ kind: 'none' });
        setBusy(false);
        loaded.current = true;
        return;
      }

      const total = n * 2;
      const now = Date.now();
      const keys = Array.from({ length: total }, (_, i) => lagosKey(new Date(now - (total - 1 - i) * 86400000)));
      const since = new Date(now - (total + 1) * 86400000).toISOString();
      const curStart = now - n * 86400000;
      const sinceCur = new Date(curStart).toISOString();

      const [vis, ord, enq, items] = await Promise.all([
        supabase.rpc('visit_stats', { p_business: biz.id, p_days: total }),
        supabase.from('orders').select('created_at,total,status').eq('business_id', biz.id).gte('created_at', since).limit(5000),
        supabase.from('enquiries').select('created_at').eq('business_id', biz.id).gte('created_at', since).limit(5000),
        supabase
          .from('order_items')
          .select('product_id, name, price, quantity, products(photo_url), orders!inner(business_id, status, created_at)')
          .eq('orders.business_id', biz.id)
          .neq('orders.status', 'cancelled')
          .gte('orders.created_at', sinceCur)
          .limit(2000),
      ]);
      if (cancelled) return;
      if (vis.error) {
        setState({ kind: 'error' });
        setBusy(false);
        return;
      }

      const vmap = new Map<string, { visits: number; uniques: number }>();
      for (const r of (vis.data ?? []) as DayRow[]) {
        vmap.set(String(r.day).slice(0, 10), { visits: Number(r.visits), uniques: Number(r.uniques) });
      }
      const omap = new Map<string, { orders: number; revenue: number }>();
      const statusCounts: Record<string, number> = { new: 0, preparing: 0, delivered: 0, cancelled: 0 };
      for (const o of (ord.data ?? []) as OrderRow[]) {
        if (new Date(o.created_at).getTime() >= curStart) {
          statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
        }
        if (o.status === 'cancelled') continue;
        const k = lagosKey(new Date(o.created_at));
        const c = omap.get(k) ?? { orders: 0, revenue: 0 };
        c.orders += 1;
        c.revenue += Number(o.total);
        omap.set(k, c);
      }
      const emap = new Map<string, number>();
      for (const e of (enq.data ?? []) as { created_at: string }[]) {
        const k = lagosKey(new Date(e.created_at));
        emap.set(k, (emap.get(k) ?? 0) + 1);
      }
      const points: Point[] = keys.map((day) => ({
        day,
        visits: vmap.get(day)?.visits ?? 0,
        uniques: vmap.get(day)?.uniques ?? 0,
        orders: omap.get(day)?.orders ?? 0,
        revenue: omap.get(day)?.revenue ?? 0,
        enquiries: emap.get(day) ?? 0,
      }));

      const agg = new Map<string, TopRow>();
      for (const r of (items.data ?? []) as unknown as ItemRow[]) {
        const key = r.product_id ?? r.name;
        const cur = agg.get(key) ?? { key, name: r.name, photo: r.products?.photo_url ?? null, sold: 0, revenue: 0 };
        cur.sold += r.quantity;
        cur.revenue += r.price * r.quantity;
        agg.set(key, cur);
      }
      const top = [...agg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setState({
        kind: 'ready',
        data: { n, businessId: biz.id, published: biz.published, points, statusCounts, top },
      });
      setBusy(false);
      loaded.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id, n, active]);

  if (state.kind === 'loading') return <StatsSkeleton />;
  if (state.kind === 'none') {
    return (
      <div className={`${card} p-6 text-sm text-slate-600`}>
        Create your website first (My website), then your analytics will show here.
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className={`${card} p-6 text-sm text-slate-500`}>
        We couldn&apos;t load your analytics right now. Please refresh the page.
      </div>
    );
  }

  const { n: days, businessId, published, points, statusCounts, top } = state.data;
  const cur = points.slice(days);
  const prev = points.slice(0, days);

  const visits = sum(cur, (p) => p.visits);
  const visitsPrev = sum(prev, (p) => p.visits);
  const uniques = sum(cur, (p) => p.uniques);
  const uniquesPrev = sum(prev, (p) => p.uniques);
  const orders = sum(cur, (p) => p.orders);
  const ordersPrev = sum(prev, (p) => p.orders);
  const revenue = sum(cur, (p) => p.revenue);
  const revenuePrev = sum(prev, (p) => p.revenue);
  const enquiries = sum(cur, (p) => p.enquiries);
  const enquiriesPrev = sum(prev, (p) => p.enquiries);
  const conv = visits > 0 ? (orders / visits) * 100 : 0;
  const convPrev = visitsPrev > 0 ? (ordersPrev / visitsPrev) * 100 : 0;
  const aov = orders > 0 ? revenue / orders : 0;
  const aovPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;

  const size = days <= 30 ? 1 : days <= 90 ? 7 : 30;
  const buckets = bucketize(cur, size);
  const m = metrics[metric];
  const chartItems = buckets.map((b) => ({ label: b.label, value: b[metric] }));
  const statusTotal = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const span = `${fmtDay(cur[0].day)} – ${fmtDay(cur[cur.length - 1].day)}`;

  return (
    <div className={`space-y-6 transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">{span}</p>
        </div>
        <div className="flex gap-1.5">
          {ranges.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                range === r.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {!published && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your website is not published yet, so there are no visits to measure. Publish it from My website.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <Kpi icon={Eye} label="Visits" value={visits.toLocaleString()} pct={percentChange(visits, visitsPrev)} />
        <Kpi icon={Users} label="Unique visitors" value={uniques.toLocaleString()} pct={percentChange(uniques, uniquesPrev)} />
        <Kpi icon={ShoppingCart} label="Orders" value={orders.toLocaleString()} pct={percentChange(orders, ordersPrev)} />
        <Kpi icon={Banknote} label="Revenue" value={naira(revenue)} pct={percentChange(revenue, revenuePrev)} />
        <Kpi icon={Percent} label="Conversion rate" value={`${conv.toFixed(1)}%`} pct={percentChange(conv, convPrev)} />
        <Kpi icon={Receipt} label="Average order" value={naira(aov)} pct={percentChange(aov, aovPrev)} />
      </div>

      <div className={`${card} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">Performance</h2>
          <div className="flex gap-1.5">
            {(Object.keys(metrics) as MetricKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  metric === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {metrics[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <Bars key={`${metric}-${days}`} items={chartItems} format={m.fmt} color={m.color} />
        </div>
        <p className="mt-3 text-[11px] text-slate-400">
          {size === 1 ? 'One bar per day' : size === 7 ? 'One bar per week' : 'One bar per month'}. Tap or hover a bar for
          the exact number. Nigeria time.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">Best-selling products</h2>
            <button onClick={() => onNavigate?.('products')} className="text-sm font-medium text-blue-600 hover:underline">
              Products
            </button>
          </div>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No sales in this period yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {top.map((r) => (
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

        <div className={`${card} p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900">Orders by status</h2>
            <button onClick={() => onNavigate?.('orders')} className="text-sm font-medium text-blue-600 hover:underline">
              Orders
            </button>
          </div>
          {statusTotal === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No orders in this period yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {statusRows.map((s) => {
                const count = statusCounts[s.key] ?? 0;
                return (
                  <div key={s.key}>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700">{s.label}</span>
                      <span className="font-medium text-slate-900">
                        {count} <span className="text-slate-400">({Math.round((count / statusTotal) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(count / statusTotal) * 100}%`, background: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500">New enquiries from customers</span>
            <span className="font-semibold text-slate-900">
              {enquiries.toLocaleString()}
              {percentChange(enquiries, enquiriesPrev) !== null && (
                <span className="ml-2 text-xs font-medium text-slate-400">
                  ({percentChange(enquiries, enquiriesPrev)! >= 0 ? '+' : ''}
                  {percentChange(enquiries, enquiriesPrev)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChannelBreakdown businessId={businessId} onViewAll={() => onNavigate?.('channels')} />
        <SalesBreakdown businessId={businessId} onViewAll={() => onNavigate?.('orders')} />
      </div>
    </div>
  );
}