'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { orderError, readOrder, type Order } from '@/lib/orders';
import AllOrders from '@/components/orders/AllOrders';
import DraftsPage from '@/components/orders/DraftsPage';
import AbandonedPage from '@/components/orders/AbandonedPage';
import OrdersSettings from '@/components/orders/OrdersSettings';
import CreateOrder from '@/components/orders/CreateOrder';
import { Err, ListSkeleton, Ok, btn, fetchAll, ghost } from '@/components/orders/ui';

type Tab = 'orders' | 'drafts' | 'abandoned' | 'settings';
type View = { kind: 'tabs' } | { kind: 'create'; draftId: string | null; seed: Order | null };

const TABS: { id: Tab; label: string }[] = [
  { id: 'orders', label: 'All orders' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'abandoned', label: 'Abandoned checkouts' },
  { id: 'settings', label: 'Settings' },
];

export default function OrdersPanel({ user, active = true }: { user: User; active?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [dbl, setDbl] = useState(false);
  const [tab, setTab] = useState<Tab>('orders');
  const [view, setView] = useState<View>({ kind: 'tabs' });
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [spin, setSpin] = useState(false);
  const bizId = useRef<string | null>(null);

  const loadOrders = useCallback(async (bid: string) => {
    // Newer columns come with orders.sql; ask for everything and read it defensively.
    const r = await fetchAll<Record<string, unknown>>((a, z) => supabase.from('orders').select('*, order_items(*)').eq('business_id', bid).order('created_at', { ascending: false }).range(a, z));
    if (r.error) { setErr(orderError(r.error)); return; }
    setErr('');
    setOrders(r.data.map(readOrder));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase.from('businesses').select('id, name, slug, privacy_options, bank_name, account_number, account_name').eq('owner_id', user.id).maybeSingle();
      if (b) {
        bizId.current = b.id;
        setBiz({ id: b.id, name: b.name ?? '', slug: b.slug ?? '' });
        setDbl(!!(b.privacy_options as { doubleOptIn?: boolean } | null)?.doubleOptIn);
        setBank({ bank_name: b.bank_name ?? '', account_number: b.account_number ?? '', account_name: b.account_name ?? '' });
        await loadOrders(b.id);
      }
      setLoading(false);
    })();
  }, [supabase, user.id, loadOrders]);

  useEffect(() => {
    if (active && bizId.current) loadOrders(bizId.current);
  }, [active, loadOrders]);

  const reload = useCallback(async () => { if (bizId.current) await loadOrders(bizId.current); }, [loadOrders]);

  async function refresh() {
    setSpin(true);
    await reload();
    setSpin(false);
  }

  if (loading) return <ListSkeleton />;
  if (!biz) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Create your website first (My website), then orders will show here.</div>;
  }

  const shopUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${biz.slug}`;

  if (view.kind === 'create') {
    return (
      <CreateOrder
        key={`${view.draftId ?? 'new'}-${view.seed?.id ?? ''}`}
        businessId={biz.id}
        storeName={biz.name}
        draftId={view.draftId}
        seed={view.seed}
        onClose={(changed, message) => {
          setView({ kind: 'tabs' });
          if (message) { setNote(message); setTab(/^Draft|^Invoice/.test(message) ? 'drafts' : 'orders'); }
          if (changed) void reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex gap-2">
          <button onClick={refresh} className={ghost} aria-label="Refresh"><RefreshCw size={15} className={spin ? 'animate-spin' : ''} /> Refresh</button>
          <button onClick={() => { setNote(''); setView({ kind: 'create', draftId: null, seed: null }); }} className={btn}>Create order</button>
        </div>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setNote(''); }} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t.label}
            {t.id === 'orders' && orders.filter((o) => o.status === 'new').length > 0 && <span className="ml-1.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{orders.filter((o) => o.status === 'new').length}</span>}
          </button>
        ))}
      </div>

      <Err>{err}</Err>
      <Ok>{note}</Ok>

      {tab === 'orders' && (
        <AllOrders
          orders={orders} businessId={biz.id} storeName={biz.name} bank={bank} doubleOptIn={dbl} onReload={reload}
          onCreate={() => setView({ kind: 'create', draftId: null, seed: null })}
          onDuplicate={(o) => setView({ kind: 'create', draftId: null, seed: o })}
        />
      )}
      {tab === 'drafts' && (
        <DraftsPage businessId={biz.id} storeName={biz.name}
          onEdit={(id) => setView({ kind: 'create', draftId: id, seed: null })}
          onCreate={() => setView({ kind: 'create', draftId: null, seed: null })}
          onOrdersChanged={() => { void reload(); }} />
      )}
      {tab === 'abandoned' && (
        <AbandonedPage businessId={biz.id} storeName={biz.name} shopUrl={shopUrl} onDraftCreated={(id) => setView({ kind: 'create', draftId: id, seed: null })} />
      )}
      {tab === 'settings' && <OrdersSettings businessId={biz.id} bank={bank} onBank={setBank} />}
    </div>
  );
}
