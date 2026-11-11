'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { defaultOptions, type CheckoutOptions, type FieldMode } from '@/lib/checkout';
import { defaultAccounts, type AccountsOptions } from '@/lib/accounts';
import { defaultTax, type TaxSettings } from '@/lib/tax';

export type SiteProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  stock: number | null;
  taxable: boolean;
};

export type Bank = { bank_name: string; account_number: string; account_name: string };
export type CheckoutSettings = {
  requireAddress: boolean;
  showNote: boolean;
  accepting: boolean;
  minOrder: number;
  thankYou: string | null;
  options: CheckoutOptions;
};
export type Shop = {
  businessId: string;
  slug: string;
  bank: Bank | null;
  checkout: CheckoutSettings;
  accounts: AccountsOptions;
  tax: TaxSettings;
  policies: { label: string; href: string }[];
};

type Tracked = { status: string; total: number; created_at: string; items: { name: string; quantity: number }[] };
type Account = { id: string; full_name: string | null; email: string | null; phone: string | null; credit: number };

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';
const statusText: Record<string, string> = {
  new: 'Order received',
  preparing: 'Being prepared',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
const ph = (text: string, mode: FieldMode) => (mode === 'required' ? `${text} *` : `${text} (optional)`);
const tipChoices = ['none', '5', '10', '15', 'custom'] as const;
const emptyForm = {
  first: '', last: '', name: '', phone: '', altPhone: '', email: '', company: '', address: '', address2: '', note: '',
};

export default function SiteProducts({ products, shop }: { products: SiteProduct[]; shop?: Shop }) {
  const opt = shop?.checkout.options ?? defaultOptions;
  const acc = shop?.accounts ?? defaultAccounts;
  const taxCfg = shop?.tax ?? defaultTax;

  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'details' | 'done' | 'track'>('cart');
  const [form, setForm] = useState(emptyForm);
  const [payment, setPayment] = useState<'cod' | 'transfer'>('cod');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ number: number; total: number; method: string; thankYou: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState('');
  const [optIn, setOptIn] = useState({
    email: opt.optEmail === 'checked',
    sms: opt.optSms === 'checked',
    whatsapp: opt.optWhatsapp === 'checked',
  });
  const [tipChoice, setTipChoice] = useState<(typeof tipChoices)[number]>('none');
  const [customTip, setCustomTip] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [track, setTrack] = useState({ number: '', phone: '' });
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const [trackMsg, setTrackMsg] = useState('');
  const [trackBusy, setTrackBusy] = useState(false);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [useCredit, setUseCredit] = useState(false);

  // restore a saved cart (buy again, or coming back from sign-in) and load the signed-in customer
  useEffect(() => {
    if (!shop) return;
    try {
      const key = `xenon-again-${shop.businessId}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        window.localStorage.removeItem(key);
        const saved = JSON.parse(raw) as { t: number; items: { id: string; qty: number }[] };
        if (Date.now() - saved.t < 3600000) {
          const next: Record<string, number> = {};
          for (const w of saved.items) {
            const p = products.find((x) => x.id === w.id);
            if (!p || (p.stock !== null && p.stock <= 0)) continue;
            next[p.id] = Math.max(1, Math.min(w.qty, opt.maxQty, p.stock ?? opt.maxQty));
          }
          if (Object.keys(next).length > 0) {
            setCart(next);
            setStep('cart');
            setOpen(true);
          }
        }
      }
    } catch {
      /* ignore bad saved data */
    }

    if (!acc.enabled) {
      setAccount(null);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      if (!u || (u.user_metadata as { role?: string } | null)?.role === 'artisan') return setAccount(null);
      const { data: row } = await supabase
        .from('store_customers')
        .select('id,full_name,email,phone,credit')
        .eq('business_id', shop.businessId)
        .eq('user_id', u.id)
        .maybeSingle();
      const r = (row as Account | null) ?? null;
      setAccount(r);
      if (r) {
        const parts = (r.full_name ?? '').trim().split(/\s+/);
        setForm((f) => ({
          ...f,
          name: f.name || r.full_name || '',
          first: f.first || parts[0] || '',
          last: f.last || parts.slice(1).join(' '),
          phone: f.phone || r.phone || '',
          email: f.email || r.email || '',
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.businessId]);

  const lines = useMemo(
    () => products.filter((p) => cart[p.id] > 0).map((p) => ({ p, qty: cart[p.id] })),
    [products, cart]
  );
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
  const payable = Math.max(0, total - (discount?.amount ?? 0));

  // tax: worked out on taxable items after the discount (the server repeats this and has the final say)
  const taxableBase = lines.reduce((n, l) => (l.p.taxable ? n + l.p.price * l.qty : n), 0);
  const taxableAfter = total > 0 ? taxableBase * (1 - (discount?.amount ?? 0) / total) : 0;
  const taxAmount = !taxCfg.enabled
    ? 0
    : Math.round(
        (taxCfg.inclusive
          ? (taxableAfter * taxCfg.rate) / (100 + taxCfg.rate)
          : (taxableAfter * taxCfg.rate) / 100) * 100
      ) / 100;
  const taxAdded = taxCfg.inclusive ? 0 : taxAmount;

  const tipAmount = !opt.tipping
    ? 0
    : tipChoice === 'none'
      ? 0
      : tipChoice === 'custom'
        ? Math.min(total, Math.max(0, Math.round(Number(customTip) || 0)))
        : Math.round((total * Number(tipChoice)) / 100);
  const creditAvailable = acc.enabled && acc.storeCredit && !!account && account.credit > 0;
  const creditApplied =
    useCredit && creditAvailable && account ? Math.min(account.credit, payable + taxAdded + tipAmount) : 0;
  const grand = payable + taxAdded + tipAmount - creditApplied;

  if (products.length === 0) return null;

  const canOrder = !!shop && shop.checkout.accepting;
  const minOrder = shop?.checkout.minOrder ?? 0;
  const belowMin = total < minOrder;
  const needSignIn = acc.enabled && acc.requireSignIn && account === null;
  const accountHref = shop ? `/b/${shop.slug}/account` : '#';
  const maxFor = (p: SiteProduct) => Math.min(opt.maxQty, p.stock === null ? opt.maxQty : p.stock);

  function saveCartForReturn() {
    if (!shop || lines.length === 0) return;
    try {
      window.localStorage.setItem(
        `xenon-again-${shop.businessId}`,
        JSON.stringify({ t: Date.now(), items: lines.map((l) => ({ id: l.p.id, qty: l.qty })) })
      );
    } catch {
      /* storage blocked */
    }
  }

  function setQty(p: SiteProduct, qty: number) {
    const q = Math.max(0, Math.min(qty, maxFor(p)));
    setCart((c) => ({ ...c, [p.id]: q }));
    setDiscount(null);
    setCodeMsg('');
  }

  async function applyCode() {
    if (!shop || !code.trim()) return;
    setCodeMsg('');
    const { data, error: err } = await createClient().rpc('check_discount', {
      p_business_id: shop.businessId,
      p_code: code,
      p_subtotal: total,
    });
    if (err) {
      setDiscount(null);
      return setCodeMsg(err.message);
    }
    setDiscount({ code: code.trim().toUpperCase(), amount: data.amount });
    setCodeMsg('Discount applied.');
  }

  async function placeOrder() {
    if (!shop) return;
    if (needSignIn) return setError('Please sign in to place an order.');
    const split = opt.nameMode === 'first_last';
    const fullName = split ? `${form.first.trim()} ${form.last.trim()}`.trim() : form.name.trim();
    if (split ? !form.first.trim() || !form.last.trim() : !fullName)
      return setError(split ? 'Please enter your first and last name.' : 'Please enter your name.');
    if (!form.phone.trim()) return setError('Please enter your phone number.');
    if (opt.altPhone === 'required' && !form.altPhone.trim()) return setError('Please enter your second phone number.');
    if (opt.email === 'required' && !form.email.trim()) return setError('Please enter your email address.');
    if (opt.email !== 'off' && form.email.trim() && !form.email.includes('@'))
      return setError('Please enter a valid email address.');
    if (opt.company === 'required' && !form.company.trim()) return setError('Please enter your company name.');
    if (shop.checkout.requireAddress && !form.address.trim()) return setError('Please enter your delivery address.');
    if (opt.address2 === 'required' && !form.address2.trim()) return setError('Please enter your apartment or unit.');
    if (opt.ageCheck && !ageOk) return setError('Please confirm that you are 18 or older.');

    setBusy(true);
    setError('');
    const usedCredit = creditApplied;
    const { data, error: err } = await createClient().rpc('place_order', {
      p_business_id: shop.businessId,
      p_name: fullName,
      p_phone: form.phone,
      p_address: form.address,
      p_note: form.note,
      p_payment: payment,
      p_items: lines.map((l) => ({ product_id: l.p.id, quantity: l.qty })),
      p_code: discount?.code ?? null,
      p_email: opt.email === 'off' ? null : form.email,
      p_company: opt.company === 'off' ? null : form.company,
      p_address2: opt.address2 === 'off' ? null : form.address2,
      p_alt_phone: opt.altPhone === 'off' ? null : form.altPhone,
      p_tip: tipAmount,
      p_opt_email: opt.optEmail !== 'off' && opt.email !== 'off' && optIn.email,
      p_opt_sms: opt.optSms !== 'off' && optIn.sms,
      p_opt_whatsapp: opt.optWhatsapp !== 'off' && optIn.whatsapp,
      p_age_ok: opt.ageCheck ? ageOk : false,
      p_use_credit: usedCredit > 0,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setResult({ number: data.order_number, total: data.total, method: payment, thankYou: data.thank_you ?? null });
    if (usedCredit > 0) setAccount((a) => (a ? { ...a, credit: Math.max(0, a.credit - usedCredit) } : a));
    setUseCredit(false);
    setCart({});
    setDiscount(null);
    setCode('');
    setCodeMsg('');
    setTipChoice('none');
    setCustomTip('');
    setStep('done');
  }

  async function trackOrder() {
    if (!shop) return;
    setTrackMsg('');
    setTracked(null);
    const num = parseInt(track.number.replace(/\D/g, ''), 10);
    if (!num || !track.phone.trim()) return setTrackMsg('Enter your order number and phone number.');
    setTrackBusy(true);
    const { data, error: err } = await createClient().rpc('track_order', {
      p_business_id: shop.businessId,
      p_order_number: num,
      p_phone: track.phone,
    });
    setTrackBusy(false);
    if (err) return setTrackMsg(err.message);
    setTracked(data as Tracked);
  }

  function closeAll() {
    setOpen(false);
    if (step === 'done' || step === 'track') setStep('cart');
  }

  const groups = new Map<string, SiteProduct[]>();
  for (const pr of products) {
    const key = pr.category?.trim() || 'Products';
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  }

  const marketingShown =
    (opt.optEmail !== 'off' && opt.email !== 'off') || opt.optSms !== 'off' || opt.optWhatsapp !== 'off';

  return (
    <>
      <section id="products" className="bg-white px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Products</h2>
            <div className="flex items-center gap-5">
              {shop && acc.enabled && acc.showSignIn && (
                <Link href={accountHref} className="text-sm font-medium text-blue-600 hover:underline">
                  {account ? 'My account' : 'Sign in'}
                </Link>
              )}
              {shop && opt.trackOrders && (
                <button
                  onClick={() => {
                    setStep('track');
                    setOpen(true);
                  }}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Track my order
                </button>
              )}
            </div>
          </div>
          {shop && !shop.checkout.accepting && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              We are not taking orders right now. Please check back soon.
            </p>
          )}
          {[...groups.entries()].map(([category, items]) => (
            <div key={category} className="mt-8">
              {groups.size > 1 && <h3 className="mb-4 text-lg font-semibold text-slate-700">{category}</h3>}
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {items.map((pr) => {
                  const soldOut = pr.stock !== null && pr.stock <= 0;
                  const qty = cart[pr.id] ?? 0;
                  return (
                    <div key={pr.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="relative aspect-square bg-slate-100">
                        {pr.photo_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pr.photo_url} alt={pr.name} className="h-full w-full object-cover" />
                        )}
                        {soldOut && (
                          <span className="absolute left-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                            Sold out
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-slate-900">{pr.name}</p>
                        {pr.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{pr.description}</p>}
                        <p className="mt-2 font-bold text-slate-900">{naira(pr.price)}</p>
                        {taxCfg.enabled && taxCfg.inclusive && pr.taxable && (
                          <p className="text-[11px] text-slate-400">incl. {taxCfg.label}</p>
                        )}
                        {canOrder && !soldOut && (
                          qty === 0 ? (
                            <button
                              onClick={() => setQty(pr, 1)}
                              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                              Add to cart
                            </button>
                          ) : (
                            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-300 p-1">
                              <button onClick={() => setQty(pr, qty - 1)} className="rounded-md p-2 hover:bg-slate-100" aria-label="Less">
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="text-sm font-semibold">{qty}</span>
                              <button onClick={() => setQty(pr, qty + 1)} className="rounded-md p-2 hover:bg-slate-100" aria-label="More">
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {canOrder && count > 0 && !open && (
        <button
          onClick={() => {
            setStep('cart');
            setOpen(true);
          }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl hover:bg-blue-700"
        >
          <ShoppingBag className="h-5 w-5" /> Cart ({count}) · {naira(total)}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={closeAll}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-bold text-slate-900">
                {step === 'cart' ? 'Your cart' : step === 'details' ? 'Checkout' : step === 'done' ? 'Order placed' : 'Track your order'}
              </h3>
              <button onClick={closeAll} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {step === 'cart' && (
                lines.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">Your cart is empty.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {lines.map(({ p, qty }) => (
                      <div key={p.id} className="flex items-center gap-3 py-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {p.photo_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-slate-500">{naira(p.price)}</p>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-slate-300 p-0.5">
                          <button onClick={() => setQty(p, qty - 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Less">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{qty}</span>
                          <button onClick={() => setQty(p, qty + 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="More">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {step === 'details' && (
                <div className="space-y-4">
                  {acc.enabled &&
                    (account ? (
                      <p className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-900">
                        Signed in as <b>{account.full_name || account.email}</b>
                      </p>
                    ) : acc.showSignIn ? (
                      <p className="text-sm text-slate-600">
                        Have an account?{' '}
                        <Link href={accountHref} onClick={saveCartForReturn} className="font-semibold text-blue-600 underline">
                          Sign in
                        </Link>
                      </p>
                    ) : null)}

                  {opt.nameMode === 'first_last' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input className={field} placeholder="First name *" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} />
                      <input className={field} placeholder="Last name *" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} />
                    </div>
                  ) : (
                    <input className={field} placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  )}
                  {opt.company !== 'off' && (
                    <input className={field} placeholder={ph('Company name', opt.company)} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  )}
                  <input className={field} placeholder="Phone number *" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  {opt.altPhone !== 'off' && (
                    <input className={field} placeholder={ph('Second phone number', opt.altPhone)} inputMode="tel" value={form.altPhone} onChange={(e) => setForm({ ...form, altPhone: e.target.value })} />
                  )}
                  {opt.email !== 'off' && (
                    <input className={field} type="email" placeholder={ph('Email address', opt.email)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  )}
                  <textarea
                    className={field}
                    rows={2}
                    placeholder={shop?.checkout.requireAddress ? 'Delivery address *' : 'Delivery address (optional)'}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  {opt.address2 !== 'off' && (
                    <input className={field} placeholder={ph('Apartment, unit, etc.', opt.address2)} value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
                  )}
                  {shop?.checkout.showNote && (
                    <textarea className={field} rows={2} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  )}

                  {marketingShown && (
                    <div className="space-y-2">
                      {opt.optEmail !== 'off' && opt.email !== 'off' && (
                        <label className="flex items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="mt-0.5" checked={optIn.email} onChange={(e) => setOptIn({ ...optIn, email: e.target.checked })} />
                          {opt.optEmailLabel || 'Email me with news and offers'}
                        </label>
                      )}
                      {opt.optSms !== 'off' && (
                        <label className="flex items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="mt-0.5" checked={optIn.sms} onChange={(e) => setOptIn({ ...optIn, sms: e.target.checked })} />
                          Text me with news and offers
                        </label>
                      )}
                      {opt.optWhatsapp !== 'off' && (
                        <label className="flex items-start gap-2 text-sm text-slate-700">
                          <input type="checkbox" className="mt-0.5" checked={optIn.whatsapp} onChange={(e) => setOptIn({ ...optIn, whatsapp: e.target.checked })} />
                          Message me on WhatsApp with news and offers
                        </label>
                      )}
                    </div>
                  )}

                  {opt.tipping && (
                    <div>
                      <p className="mb-2 text-sm font-medium">
                        Add a tip <span className="font-normal text-slate-500">(optional)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tipChoices.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setTipChoice(c)}
                            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                              tipChoice === c ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {c === 'none' ? 'No tip' : c === 'custom' ? 'Custom' : `${c}%`}
                          </button>
                        ))}
                      </div>
                      {tipChoice === 'custom' && (
                        <input type="number" min="0" className={`${field} mt-2`} placeholder="Tip amount (₦)" value={customTip} onChange={(e) => setCustomTip(e.target.value)} />
                      )}
                      {tipAmount > 0 && <p className="mt-2 text-xs text-slate-500">Tip: {naira(tipAmount)}</p>}
                    </div>
                  )}

                  {opt.ageCheck && (
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="mt-0.5" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
                      I confirm that I am 18 years or older *
                    </label>
                  )}

                  {creditAvailable && account && (
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" className="mt-0.5" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                      Use my store credit ({naira(account.credit)} available)
                    </label>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-medium">How will you pay?</p>
                    <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 p-3 text-sm">
                      <input type="radio" checked={payment === 'cod'} onChange={() => setPayment('cod')} /> Pay on delivery
                    </label>
                    {shop?.bank && (
                      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 p-3 text-sm">
                        <input type="radio" checked={payment === 'transfer'} onChange={() => setPayment('transfer')} /> Bank transfer
                      </label>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
              )}

              {step === 'done' && result && (
                <div className="space-y-4 text-sm text-slate-700">
                  <p className="text-base font-semibold text-slate-900">Thank you! Your order #{result.number} has been received.</p>
                  {result.thankYou && <p className="whitespace-pre-line">{result.thankYou}</p>}
                  <p>Total: <b>{naira(result.total)}</b></p>
                  {result.method === 'transfer' && shop?.bank && result.total > 0 ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">Please transfer to:</p>
                      <p className="mt-2">{shop.bank.bank_name}</p>
                      <p className="text-lg font-bold">{shop.bank.account_number}</p>
                      <p>{shop.bank.account_name}</p>
                      <p className="mt-2 text-xs text-slate-500">Use order #{result.number} as the reference.</p>
                    </div>
                  ) : result.total > 0 ? (
                    <p>You will pay when your order is delivered. The business will contact you shortly.</p>
                  ) : (
                    <p>Your store credit covered this order. The business will contact you shortly.</p>
                  )}
                  {opt.trackOrders && (
                    <p className="text-xs text-slate-500">
                      Keep your order number. You can use it with your phone number to track this order.
                    </p>
                  )}
                </div>
              )}

              {step === 'track' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">Enter your order number and the phone number you used when ordering.</p>
                  <input className={field} inputMode="numeric" placeholder="Order number, e.g. 1001" value={track.number} onChange={(e) => setTrack({ ...track, number: e.target.value })} />
                  <input className={field} inputMode="tel" placeholder="Phone number" value={track.phone} onChange={(e) => setTrack({ ...track, phone: e.target.value })} />
                  {trackMsg && <p className="text-sm text-red-600">{trackMsg}</p>}
                  <button
                    onClick={trackOrder}
                    disabled={trackBusy}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {trackBusy ? 'Checking...' : 'Track order'}
                  </button>
                  {tracked && (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm">
                      <p className="text-base font-semibold text-slate-900">{statusText[tracked.status] ?? tracked.status}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Placed {new Date(tracked.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                      <ul className="mt-3 space-y-1 text-slate-700">
                        {tracked.items.map((i, idx) => (
                          <li key={idx}>{i.quantity} × {i.name}</li>
                        ))}
                      </ul>
                      <p className="mt-3 font-semibold text-slate-900">Total: {naira(tracked.total)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {step !== 'done' && step !== 'track' && lines.length > 0 && (
              <div className="border-t border-slate-200 p-4">
                <div className="mb-3 flex gap-2">
                  <input
                    className={field}
                    placeholder="Discount code"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setDiscount(null);
                      setCodeMsg('');
                    }}
                  />
                  <button onClick={applyCode} className="rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50">
                    Apply
                  </button>
                </div>
                {codeMsg && <p className={`mb-3 text-xs ${discount ? 'text-green-700' : 'text-red-600'}`}>{codeMsg}</p>}
                {discount && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Discount ({discount.code})</span>
                    <span className="text-green-700">−{naira(discount.amount)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">
                      {taxCfg.label}
                      {taxCfg.inclusive ? ' (included)' : ` (${taxCfg.rate}%)`}
                    </span>
                    <span>{naira(taxAmount)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Tip</span>
                    <span>{naira(tipAmount)}</span>
                  </div>
                )}
                {creditApplied > 0 && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Store credit</span>
                    <span className="text-green-700">−{naira(creditApplied)}</span>
                  </div>
                )}
                <div className="mb-3 flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold">{naira(grand)}</span>
                </div>
                {taxCfg.enabled && taxCfg.vatNumber && (
                  <p className="mb-3 text-[11px] text-slate-400">
                    {taxCfg.label} registration no. {taxCfg.vatNumber}
                  </p>
                )}
                                {shop && shop.policies.length > 0 && (
                  <p className="mb-3 text-[11px] text-slate-400">
                    {shop.policies.map((p, i) => (
                      <span key={p.href}>
                        {i > 0 && ' · '}
                        <a href={p.href} target="_blank" rel="noopener noreferrer" className="underline">
                          {p.label}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                
                {belowMin && (
                  <p className="mb-3 text-xs text-amber-700">
                    The minimum order is {naira(minOrder)}. Add {naira(minOrder - total)} more to check out.
                  </p>
                )}
                {needSignIn && (
                  <p className="mb-3 text-xs text-amber-700">
                    Please{' '}
                    <Link href={accountHref} onClick={saveCartForReturn} className="font-semibold underline">
                      sign in or create an account
                    </Link>{' '}
                    to check out.
                  </p>
                )}
                {step === 'cart' ? (
                  <button
                    onClick={() => setStep('details')}
                    disabled={belowMin || needSignIn}
                    className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    Checkout
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setStep('cart');
                        setError('');
                      }}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium"
                    >
                      Back
                    </button>
                    <button
                      onClick={placeOrder}
                      disabled={busy || belowMin || needSignIn}
                      className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy ? 'Placing order...' : opt.buttonText || 'Place order'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}