'use client';

import { useEffect, useState } from 'react';
import { Banknote, Eye, Lightbulb, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Tab } from '@/components/DashboardOverview';
import { StatsSkeleton } from '@/components/Skeleton';

type RangeKey = '7d' | '30d' | '90d' | '1y';
const ranges: { key: RangeKey; days: number }[] = [
  { key: '7d', days: 7 },
  { key: '30d', days: 30 },
  { key: '90d', days: 90 },
  { key: '1y', days: 365 },
];

type Point = { day: string; visits: number; uniques: number; orders: number; revenue: number; enquiries: number };
type Top = { name: string; photo: string | null; share: number };
type DayRow = { day: string; visits: number | string; uniques: number | string };
type ItemRow = {
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  products: { photo_url: string | null } | null;
};
type State =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'ready'; published: boolean; points: Point[]; top: Top | null };

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');
const lagosKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const sum = (a: Point[], f: (p: Point) => number) => a.reduce((n, p) => n + f(p), 0);

function niceMax(m: number) {
  if (m <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  const n = m / pow;
  const step = n <= 2 ? 2 : n <= 4 ? 4 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return step * pow;
}

function percentChange(now: number, before: number): number | null {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <p className="text-xs text-slate-400">No earlier data</p>;
  const up = pct >= 0;
  return (
    <p className={`text-xs font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}%
    </p>
  );
}

function Spark({ values }: { values: number[] }) {
  const W = 120;
  const H = 40;
  const max = Math.max(1, ...values);
  const pts = values
    .map((v, i) => `${(i * W) / Math.max(1, values.length - 1)},${H - 4 - (v / max) * (H - 8)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  pct,
  values,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  pct: number | null;
  values: number[];
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`${card} p-4 text-left transition hover:shadow-md`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="font-display truncate text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <Change pct={pct} />
        <div className="w-20">
          <Spark values={values} />
        </div>
      </div>
    </button>
  );
}

const series = [
  { key: 'visits', label: 'Visits', color: '#2563eb' },
  { key: 'orders', label: 'Orders', color: '#0ea5e9' },
  { key: 'revenue', label: 'Revenue', color: '#818cf8' },
] as const;
type SeriesKey = (typeof series)[number]['key'];

function curve(vals: number[], x: (i: number) => number, y: (v: number) => number) {
  let d = `M ${x(0)} ${y(vals[0])}`;
  for (let i = 1; i < vals.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C ${cx} ${y(vals[i - 1])}, ${cx} ${y(vals[i])}, ${x(i)} ${y(vals[i])}`;
  }
  return d;
}

function Chart({
  pts,
  show,
  hover,
  setHover,
}: {
  pts: Point[];
  show: Record<SeriesKey, boolean>;
  hover: number | null;
  setHover: (i: number | null) => void;
}) {
  const W = 700;
  const H = 240;
  const padX = 10;
  const padY = 16;
  const last = Math.max(1, pts.length - 1);
  const x = (i: number) => padX + (i * (W - padX * 2)) / last;

  const vMax = niceMax(Math.max(0, ...pts.map((p) => p.visits)));
  const oMax = Math.max(1, ...pts.map((p) => p.orders));
  const rMax = Math.max(1, ...pts.map((p) => p.revenue));
  const yFor = (scale: number) => (v: number) => H - padY - (v / scale) * (H - padY * 2);
  const yv = yFor(vMax);

  const lines: Record<SeriesKey, string> = {
    visits: curve(pts.map((p) => p.visits), x, yv),
    orders: curve(pts.map((p) => p.orders), x, yFor(oMax)),
    revenue: curve(pts.map((p) => p.revenue), x, yFor(rMax)),
  };
  const ticks = [vMax, vMax / 2, 0];
  const labelIdx = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * last));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * last);
    setHover(Math.max(0, Math.min(last, i)));
  }

  const hp = hover !== null ? pts[hover] : null;
  const frac = hover !== null ? x(hover) / W : 0;

  return (
    <div>
      <div className="relative">
        {show.visits &&
          ticks.map((t) => (
            <span
              key={t}
              className="absolute left-0 -translate-y-1/2 text-[10px] text-slate-400"
              style={{ top: `${(yv(t) / H) * 100}%` }}
            >
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </span>
          ))}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="ml-8 block w-[calc(100%-2rem)] touch-pan-y"
          role="img"
          aria-label="Business growth chart"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1={0} x2={W} y1={yv(t)} y2={yv(t)} stroke="#e2e8f0" strokeWidth={1} />
          ))}
          {show.visits && <path d={`${lines.visits} L ${x(last)} ${H - padY} L ${x(0)} ${H - padY} Z`} fill="url(#growthFill)" />}
          {series.map(
            (s) =>
              show[s.key] && (
                <path
                  key={s.key}
                  d={lines[s.key]}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
          )}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padY} y2={H - padY} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
          )}
        </svg>
        {hp && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-40 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg"
            style={{
              left: `calc(2rem + ${frac} * (100% - 2rem))`,
              transform: `translateX(${frac > 0.75 ? '-100%' : frac < 0.25 ? '0%' : '-50%'})`,
            }}
          >
            <p className="font-semibold text-slate-900">{fmtDay(hp.day)}</p>
            <p className="mt-1 text-slate-600">Visits: {hp.visits.toLocaleString()}</p>
            <p className="text-slate-600">Orders: {hp.orders.toLocaleString()}</p>
            <p className="text-slate-600">Revenue: {naira(hp.revenue)}</p>
          </div>
        )}
      </div>
      <div className="ml-8 mt-2 flex justify-between text-[10px] text-slate-400">
        {labelIdx.map((i, k) => (
          <span key={k}>{fmtDay(pts[i].day)}</span>
        ))}
      </div>
    </div>
  );
}

export default function VisitsOverview({
  userId,
  onNavigate,
}: {
  userId: string;
  onNavigate?: (tab: Tab) => void;
}) {
  const [range, setRange] = useState<RangeKey>('7d');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState<Record<SeriesKey, boolean>>({ visits: true, orders: true, revenue: true });
  const [hover, setHover] = useState<number | null>(null);
  const n = ranges.find((r) => r.key === range)!.days;

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      setBusy(true);
      const { data: biz } = await supabase
        .from('businesses')
        .select('id,published')
        .eq('owner_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (!biz) {
        setState({ kind: 'none' });
        setBusy(false);
        return;
      }

      const total = n * 2;
      const keys = Array.from({ length: total }, (_, i) =>
        lagosKey(new Date(Date.now() - (total - 1 - i) * 86400000))
      );
      const since = new Date(Date.now() - (total + 1) * 86400000).toISOString();
      const sinceCur = new Date(Date.now() - n * 86400000).toISOString();

      const [vis, ord, enq, items] = await Promise.all([
        supabase.rpc('visit_stats', { p_business: biz.id, p_days: total }),
        supabase
          .from('orders')
          .select('created_at,total')
          .eq('business_id', biz.id)
          .neq('status', 'cancelled')
          .gte('created_at', since)
          .limit(5000),
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
      for (const o of (ord.data ?? []) as { created_at: string; total: number }[]) {
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

      const agg = new Map<string, { name: string; photo: string | null; revenue: number }>();
      let allRevenue = 0;
      for (const r of (items.data ?? []) as unknown as ItemRow[]) {
        const key = r.product_id ?? r.name;
        const cur = agg.get(key) ?? { name: r.name, photo: r.products?.photo_url ?? null, revenue: 0 };
        cur.revenue += r.price * r.quantity;
        allRevenue += r.price * r.quantity;
        agg.set(key, cur);
      }
      const best = [...agg.values()].sort((a, b) => b.revenue - a.revenue)[0];
      const top: Top | null = best
        ? { name: best.name, photo: best.photo, share: allRevenue ? Math.round((best.revenue / allRevenue) * 100) : 0 }
        : null;

      setState({ kind: 'ready', published: biz.published, points, top });
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, n]);

   if (state.kind === 'loading') return <StatsSkeleton />;
  if (state.kind === 'none') {
    return (
      <div className={`${card} p-6`}>
        <h2 className="font-display text-lg font-semibold text-slate-900">Business growth</h2>
        <p className="mt-2 text-sm text-slate-500">Create and publish your website to start seeing visits and orders here.</p>
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className={`${card} p-6 text-sm text-slate-500`}>
        We couldn&apos;t load your stats right now. Please refresh the page.
      </div>
    );
  }

  if (state.points.length !== n * 2) return <StatsSkeleton />;
  
  const { points, published, top } = state;
  const cur = points.slice(n);
  const prev = points.slice(0, n);
  const visits = sum(cur, (p) => p.visits);
  const visitsPrev = sum(prev, (p) => p.visits);
  const uniques = sum(cur, (p) => p.uniques);
  const orders = sum(cur, (p) => p.orders);
  const ordersPrev = sum(prev, (p) => p.orders);
  const revenue = sum(cur, (p) => p.revenue);
  const revenuePrev = sum(prev, (p) => p.revenue);
  const enquiries = sum(cur, (p) => p.enquiries);
  const enquiriesPrev = sum(prev, (p) => p.enquiries);
  const today = cur[cur.length - 1]?.visits ?? 0;

  const vPct = percentChange(visits, visitsPrev);
  const oPct = percentChange(orders, ordersPrev);
  const prevLabel = range === '1y' ? 'year' : `${n} days`;
  const rangeLabel = range === '1y' ? 'Last year' : `Last ${n} days`;
  const span = `${fmtDay(cur[0].day)} – ${fmtDay(cur[cur.length - 1].day)}`;

  const trafficTitle =
    vPct === null ? (visits === 0 ? 'Get your first visitors' : 'Traffic is picking up') : vPct > 0 ? 'Your traffic is up!' : vPct === 0 ? 'Your traffic is steady' : 'Your traffic is down';
  const trafficText =
    vPct === null
      ? visits === 0
        ? 'Share your website link on WhatsApp and Instagram.'
        : `No visits in the previous ${prevLabel} to compare with.`
      : vPct === 0
        ? `Same number of visits as the previous ${prevLabel}.`
        : `${vPct > 0 ? '+' : '-'}${Math.abs(vPct)}% ${vPct > 0 ? 'more' : 'fewer'} visits compared to the previous ${prevLabel}.`;

  const salesTitle =
    oPct === null ? (orders === 0 ? 'No orders yet' : 'Orders are coming in') : oPct > 0 ? 'Sales are growing' : oPct === 0 ? 'Orders are steady' : 'Orders are down';
  const salesText =
    oPct === null
      ? orders === 0
        ? 'Add products and share your link to get your first order.'
        : `No orders in the previous ${prevLabel} to compare with.`
      : oPct === 0
        ? `Same number of orders as the previous ${prevLabel}.`
        : `${oPct > 0 ? '+' : '-'}${Math.abs(oPct)}% ${oPct > 0 ? 'increase' : 'decrease'} in orders compared to the previous ${prevLabel}.`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi icon={Eye} label="Visits" value={visits.toLocaleString()} pct={vPct} values={cur.map((p) => p.visits)} onClick={() => onNavigate?.('channels')} />
        <Kpi icon={ShoppingCart} label="Orders" value={orders.toLocaleString()} pct={oPct} values={cur.map((p) => p.orders)} onClick={() => onNavigate?.('orders')} />
        <Kpi icon={Users} label="Customers" value={enquiries.toLocaleString()} pct={percentChange(enquiries, enquiriesPrev)} values={cur.map((p) => p.enquiries)} onClick={() => onNavigate?.('customers')} />
        <Kpi icon={Banknote} label="Revenue" value={naira(revenue)} pct={percentChange(revenue, revenuePrev)} values={cur.map((p) => p.revenue)} onClick={() => onNavigate?.('orders')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className={`${card} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">Business growth</h2>
              <p className="text-xs text-slate-500">
                {rangeLabel} · {span}
              </p>
            </div>
            <div className="flex gap-1.5">
              {ranges.map((r) => (
                <button
                  key={r.key}
                  onClick={() => {
                    setHover(null);
                    setRange(r.key);
                  }}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                    range === r.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {r.key}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {series.map((s) => (
              <button
                key={s.key}
                onClick={() => setShow((v) => ({ ...v, [s.key]: !v[s.key] }))}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  show[s.key] ? 'border-slate-300 text-slate-700' : 'border-slate-200 text-slate-400'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: show[s.key] ? s.color : '#cbd5e1' }} />
                {s.label}
              </button>
            ))}
          </div>

          <div className={`mt-4 transition-opacity ${busy ? 'opacity-50' : ''}`}>
            <Chart pts={cur} show={show} hover={hover} setHover={setHover} />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Visits use the left scale. Orders and revenue are scaled to their own peak, so tap or hover a day for exact numbers.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-xs text-slate-500">Unique visitors</p>
              <p className="font-display text-lg font-bold text-slate-900">{uniques.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Visits today</p>
              <p className="font-display text-lg font-bold text-slate-900">{today.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400">Nigeria time</p>
            </div>
          </div>

          {visits === 0 && (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {published
                ? 'No visits yet. Share your website link on WhatsApp and Instagram to get your first visitors.'
                : 'Your website is not published yet. Publish it, then share your link to start getting visits.'}
            </p>
          )}
        </div>

        <div className={`${card} p-5`}>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
            <Lightbulb className="h-5 w-5 text-blue-600" /> Insights
          </h2>
          <div className="mt-4 space-y-5">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{trafficTitle}</p>
                <p className="text-xs text-slate-600">{trafficText}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ShoppingCart className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{salesTitle}</p>
                <p className="text-xs text-slate-600">{salesText}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Top product</p>
              {top ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {top.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={top.photo} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{top.name}</p>
                    <p className="text-xs text-slate-500">{top.share}% of sales</p>
                  </div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Your top product will show here once you get orders.</p>
              )}
              <button
                onClick={() => onNavigate?.('products')}
                className="mt-3 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                View details →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}