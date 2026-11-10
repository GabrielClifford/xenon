'use client';

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';

type Item = { id: string; name: string; price: number; quantity: number };
type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  address: string | null;
  note: string | null;
  payment_method: 'cod' | 'transfer';
  status: 'new' | 'preparing' | 'delivered' | 'cancelled';
  total: number;
    tax_amount: number;
  tax_included: boolean;
  tax_label: string | null;
    credit_used: number;
  request_type: 'cancel' | 'return' | null;
  request_note: string | null;
    email: string | null;
  company: string | null;
  address2: string | null;
  alt_phone: string | null;
  tip: number;
  opt_email: boolean;
  opt_sms: boolean;
  opt_whatsapp: boolean;
       discount_code: string | null;
     discount_amount: number;
  created_at: string;
  order_items: Item[];
};

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const statuses = ['new', 'preparing', 'delivered', 'cancelled'] as const;
const badge: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';

export default function OrdersPanel({ user, active = true }: { user: User; active?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'all' | (typeof statuses)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [bank, setBank] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [bankMsg, setBankMsg] = useState('');

  async function load(bid: string) {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('business_id', bid)
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const { data: b } = await supabase
        .from('businesses')
        .select('id, bank_name, account_number, account_name')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (b) {
        setBusinessId(b.id);
        setBank({
          bank_name: b.bank_name ?? '',
          account_number: b.account_number ?? '',
          account_name: b.account_name ?? '',
        });
        await load(b.id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);
  
  useEffect(() => {
    if (active && businessId) load(businessId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  async function setStatus(o: Order, status: Order['status']) {
    await supabase.from('orders').update({ status }).eq('id', o.id);
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status } : x)));
  }
  async function clearRequest(o: Order) {
    await supabase.from('orders').update({ request_type: null, request_note: null, request_at: null }).eq('id', o.id);
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, request_type: null, request_note: null } : x)));
  }
  async function saveBank() {
    if (!businessId) return;
    const { error } = await supabase
      .from('businesses')
      .update({
        bank_name: bank.bank_name.trim() || null,
        account_number: bank.account_number.trim() || null,
        account_name: bank.account_name.trim() || null,
      })
      .eq('id', businessId);
    setBankMsg(error ? error.message : 'Saved. Bank transfer is now offered at checkout.');
  }

    if (loading) return <PageSkeleton />;
  if (!businessId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Create your website first (My website), then orders will show here.
      </div>
    );
  }

  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
        <button
          onClick={() => load(businessId)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...statuses] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${
              filter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {s}
            {s !== 'all' && ` (${orders.filter((o) => o.status === s).length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No orders here yet.
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((o) => (
            <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold">Order #{o.order_number}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(o.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[o.status]}`}>
                  {o.status}
                </span>
              </div>

              <div className="mt-3 text-sm">
                <p className="font-medium">{o.customer_name}</p>
                <a href={`tel:${o.phone}`} className="text-blue-600">{o.phone}</a>
                                {o.alt_phone && <p className="text-slate-600">Second phone: {o.alt_phone}</p>}
                {o.email && <p className="text-slate-600">{o.email}</p>}
                {o.company && <p className="text-slate-600">{o.company}</p>}
                {o.address && <p className="text-slate-600">{o.address}{o.address2 ? `, ${o.address2}` : ''}</p>}
                {o.note && <p className="mt-1 text-slate-500">Note: {o.note}</p>}
              </div>

              <div className="mt-3 divide-y divide-slate-100 rounded-xl bg-slate-50 px-3 text-sm">
                {o.order_items.map((i) => (
                  <div key={i.id} className="flex justify-between py-2">
                    <span>{i.quantity} × {i.name}</span>
                    <span>{naira(i.price * i.quantity)}</span>
                  </div>
                ))}
              </div>
              
                 {o.discount_amount > 0 && (
     <p className="mt-2 text-sm text-green-700">
       Discount ({o.discount_code}): −{naira(o.discount_amount)}
     </p>
   )}
   
                 {o.tip > 0 && <p className="mt-1 text-sm text-slate-600">Tip: {naira(o.tip)}</p>}
                               {o.tax_amount > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  {o.tax_label || 'VAT'}: {naira(o.tax_amount)}
                  {o.tax_included ? ' (included in prices)' : ''}
                </p>
              )}
                               {o.credit_used > 0 && <p className="mt-1 text-sm text-slate-600">Store credit used: {naira(o.credit_used)}</p>}
              {o.request_type && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">
                    Customer asked to {o.request_type === 'cancel' ? 'cancel this order' : 'return this order'}
                  </p>
                  {o.request_note && <p className="mt-1">&ldquo;{o.request_note}&rdquo;</p>}
                  <button onClick={() => clearRequest(o)} className="mt-2 text-xs font-semibold underline">
                    Dismiss request
                  </button>
                </div>
              )}
              
              {(o.opt_email || o.opt_sms || o.opt_whatsapp) && (
                <p className="mt-1 text-xs text-slate-500">
                  Agreed to receive news and offers by:{' '}
                  {[o.opt_email && 'Email', o.opt_sms && 'SMS', o.opt_whatsapp && 'WhatsApp'].filter(Boolean).join(', ')}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {o.payment_method === 'cod' ? 'Pay on delivery' : 'Bank transfer'} ·{' '}
                  <b className="text-slate-900">{naira(o.total)}</b>
                </p>
                <select
                  value={o.status}
                  onChange={(e) => setStatus(o, e.target.value as Order['status'])}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm capitalize"
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Bank transfer details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Fill these in to let customers choose bank transfer at checkout. Leave them empty for pay on delivery only.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <input className={field} placeholder="Bank name" value={bank.bank_name} onChange={(e) => setBank({ ...bank, bank_name: e.target.value })} />
          <input className={field} placeholder="Account number" inputMode="numeric" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} />
          <input className={field} placeholder="Account name" value={bank.account_name} onChange={(e) => setBank({ ...bank, account_name: e.target.value })} />
        </div>
        <button onClick={saveBank} className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Save details
        </button>
        {bankMsg && <p className="mt-2 text-sm text-slate-600">{bankMsg}</p>}
      </div>
    </div>
  );
}