'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { AccountsOptions } from '@/lib/accounts';

type Store = { id: string; name: string; slug: string; options: AccountsOptions };
type Item = { id: string; product_id: string | null; name: string; price: number; quantity: number };
type Order = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  request_type: 'cancel' | 'return' | null;
  request_note: string | null;
  order_items: Item[];
};
type Customer = { id: string; full_name: string | null; credit: number };

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const statusText: Record<string, string> = {
  new: 'Order received',
  preparing: 'Being prepared',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const statusColor: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function StoreAccount({ store }: { store: Store }) {
  const supabase = useMemo(() => createClient(), []);
  const opt = store.options;
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<{ id: string; type: 'cancel' | 'return' } | null>(null);
  const [note, setNote] = useState('');

  const loadOrders = useCallback(
    async (customerId: string) => {
      const { data } = await supabase
        .from('orders')
        .select('id,order_number,status,total,created_at,request_type,request_note,order_items(id,product_id,name,price,quantity)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      setOrders((data as Order[]) ?? []);
    },
    [supabase]
  );

  const loadAccount = useCallback(
    async (u: User) => {
      const meta = (u.user_metadata ?? {}) as { role?: string; full_name?: string; phone?: string };
      if (meta.role === 'artisan') return; // business owners use the dashboard
      const get = () =>
        supabase
          .from('store_customers')
          .select('id,full_name,credit')
          .eq('business_id', store.id)
          .eq('user_id', u.id)
          .maybeSingle();
      let c = (await get()).data as Customer | null;
      if (!c) {
        const { error } = await supabase.rpc('join_store', {
          p_business_id: store.id,
          p_name: meta.full_name ?? '',
          p_phone: meta.phone ?? '',
        });
        if (error) return setMsg({ t: error.message, ok: false });
        c = (await get()).data as Customer | null;
      }
      if (!c) return;
      setCustomer(c);
      await loadOrders(c.id);
    },
    [supabase, store.id, loadOrders]
  );

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) await loadAccount(data.user);
    });
  }, [supabase, loadAccount]);

  async function signIn() {
    setMsg(null);
    if (!form.email.trim() || !form.password) return setMsg({ t: 'Enter your email and password.', ok: false });
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
    if (error || !data.user) {
      setBusy(false);
      return setMsg({ t: 'Wrong email or password.', ok: false });
    }
    setUser(data.user);
    await loadAccount(data.user);
    setBusy(false);
  }

  async function signUp() {
    setMsg(null);
    if (!form.name.trim()) return setMsg({ t: 'Please enter your name.', ok: false });
    if (!form.email.includes('@')) return setMsg({ t: 'Please enter a valid email address.', ok: false });
    if (form.password.length < 8) return setMsg({ t: 'Your password must be at least 8 characters.', ok: false });
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { role: 'customer', full_name: form.name.trim(), phone: form.phone.trim() } },
    });
    if (error) {
      setBusy(false);
      return setMsg({
        t: /registered|exists/i.test(error.message)
          ? 'This email already has an account. Try signing in.'
          : 'Could not create your account: ' + error.message,
        ok: false,
      });
    }
    if (data.session && data.user) {
      setUser(data.user);
      await loadAccount(data.user);
    } else {
      setMsg({ t: 'Account created. Check your email to confirm it, then sign in.', ok: true });
      setMode('in');
    }
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setCustomer(null);
    setOrders([]);
    setMsg(null);
  }

  function buyAgain(order: Order) {
    const items = order.order_items
      .filter((i) => i.product_id)
      .map((i) => ({ id: i.product_id as string, qty: i.quantity }));
    try {
      window.localStorage.setItem(`xenon-again-${store.id}`, JSON.stringify({ t: Date.now(), items }));
    } catch {
      /* storage blocked */
    }
    window.location.assign(`/b/${store.slug}#products`);
  }

  async function sendRequest() {
    if (!ask) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('request_order_action', {
      p_order_id: ask.id,
      p_type: ask.type,
      p_note: note,
    });
    setBusy(false);
    if (error) return setMsg({ t: error.message, ok: false });
    setAsk(null);
    setNote('');
    const fee = Number((data as { fee?: number } | null)?.fee ?? 0);
    setMsg({
      t:
        fee > 0
          ? `Your request was sent. A fee of ${naira(fee)} may apply under the store's policy. The store will get back to you.`
          : 'Your request was sent. The store will get back to you.',
      ok: true,
    });
    if (customer) await loadOrders(customer.id);
  }

  const isOwner = (user?.user_metadata as { role?: string } | undefined)?.role === 'artisan';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <p className="font-display text-lg font-bold">{store.name}</p>
          <Link href={`/b/${store.slug}`} className="text-sm font-medium text-blue-600 hover:underline">
            Back to store
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-8">
        {!opt.enabled ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            This store does not use customer accounts.
          </div>
        ) : user === undefined ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" />
        ) : isOwner ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <p>You are signed in as a business owner. Customer accounts use a separate login.</p>
            <button onClick={signOut} className="mt-4 rounded-xl border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">
              Sign out to try it as a customer
            </button>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold">{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
            <div className="mt-5 space-y-3">
              {mode === 'up' && (
                <>
                  <input className={field} placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className={field} placeholder="Phone number (optional)" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </>
              )}
              <input className={field} type="email" placeholder="Email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input
                className={field}
                type="password"
                placeholder={mode === 'up' ? 'Password (at least 8 characters)' : 'Password'}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {msg && <p className={`mt-3 text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.t}</p>}
            <button
              onClick={mode === 'in' ? signIn : signUp}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Please wait...' : mode === 'in' ? 'Sign in' : 'Create account'}
            </button>
            {(mode === 'up' || opt.allowSignup) && (
              <p className="mt-4 text-center text-sm text-slate-600">
                {mode === 'in' ? 'New here? ' : 'Already have an account? '}
                <button
                  onClick={() => {
                    setMode(mode === 'in' ? 'up' : 'in');
                    setMsg(null);
                  }}
                  className="font-semibold text-blue-600 underline"
                >
                  {mode === 'in' ? 'Create an account' : 'Sign in'}
                </button>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold">Hello, {customer?.full_name || user.email}</h1>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <button onClick={signOut} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">
                Sign out
              </button>
            </div>

            {msg && (
              <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{msg.t}</p>
            )}

            {opt.storeCredit && customer && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Store credit</p>
                <p className="font-display text-3xl font-bold">{naira(customer.credit)}</p>
                <p className="mt-1 text-xs text-slate-500">You can use it at checkout.</p>
              </div>
            )}

            <div>
              <h2 className="font-display text-lg font-semibold">Your orders</h2>
              {orders.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  You have no orders yet. Orders you place while signed in will show here.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {orders.map((o) => (
                    <div key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-bold">Order #{o.order_number}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(o.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[o.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {statusText[o.status] ?? o.status}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-slate-700">
                        {o.order_items.map((i) => (
                          <li key={i.id}>{i.quantity} × {i.name}</li>
                        ))}
                      </ul>
                      <p className="mt-3 text-sm font-semibold">Total: {naira(o.total)}</p>

                      {o.request_type && (
                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {o.request_type === 'cancel' ? 'Cancellation' : 'Return'} requested. Waiting for the store to reply.
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {opt.allowBuyAgain && o.order_items.some((i) => i.product_id) && (
                          <button onClick={() => buyAgain(o)} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
                            Buy again
                          </button>
                        )}
                        {opt.allowCancel && o.status === 'new' && !o.request_type && (
                          <button onClick={() => { setAsk({ id: o.id, type: 'cancel' }); setNote(''); }} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            Cancel order
                          </button>
                        )}
                        {opt.allowReturn && o.status === 'delivered' && !o.request_type && (
                          <button onClick={() => { setAsk({ id: o.id, type: 'return' }); setNote(''); }} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                            Return order
                          </button>
                        )}
                      </div>

                      {ask?.id === o.id && (
                        <div className="mt-4 rounded-xl bg-slate-50 p-4">
                          <p className="text-sm font-medium">
                            {ask.type === 'cancel' ? 'Why do you want to cancel?' : 'Why do you want to return it?'}
                          </p>
                          <textarea className={`${field} mt-2`} rows={2} placeholder="Add a short note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                          <div className="mt-3 flex gap-2">
                            <button onClick={sendRequest} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                              {busy ? 'Sending...' : 'Send request'}
                            </button>
                            <button onClick={() => setAsk(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium">
                              Never mind
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}