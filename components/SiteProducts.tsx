'use client';

import { useMemo, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type SiteProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  stock: number | null;
};

export type Bank = { bank_name: string; account_number: string; account_name: string };
export type CheckoutSettings = {
  requireAddress: boolean;
  showNote: boolean;
  accepting: boolean;
  minOrder: number;
  thankYou: string | null;
};
export type Shop = { businessId: string; bank: Bank | null; checkout: CheckoutSettings };

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500';

export default function SiteProducts({ products, shop }: { products: SiteProduct[]; shop?: Shop }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'cart' | 'details' | 'done'>('cart');
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [payment, setPayment] = useState<'cod' | 'transfer'>('cod');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ number: number; total: number; method: string; thankYou: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState('');

  const lines = useMemo(
    () => products.filter((p) => cart[p.id] > 0).map((p) => ({ p, qty: cart[p.id] })),
    [products, cart]
  );
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
  const payable = Math.max(0, total - (discount?.amount ?? 0));

  if (products.length === 0) return null;

  const canOrder = !!shop && shop.checkout.accepting;
  const minOrder = shop?.checkout.minOrder ?? 0;
  const belowMin = total < minOrder;
  const maxFor = (p: SiteProduct) => (p.stock === null ? 99 : p.stock);

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
    if (!form.name.trim() || !form.phone.trim()) return setError('Please enter your name and phone number.');
    if (shop.checkout.requireAddress && !form.address.trim()) return setError('Please enter your delivery address.');
    setBusy(true);
    setError('');
    const { data, error: err } = await createClient().rpc('place_order', {
      p_business_id: shop.businessId,
      p_name: form.name,
      p_phone: form.phone,
      p_address: form.address,
      p_note: form.note,
      p_payment: payment,
      p_items: lines.map((l) => ({ product_id: l.p.id, quantity: l.qty })),
      p_code: discount?.code ?? null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    setResult({ number: data.order_number, total: data.total, method: payment, thankYou: data.thank_you ?? null });
    setCart({});
    setDiscount(null);
    setCode('');
    setCodeMsg('');
    setStep('done');
  }

  function closeAll() {
    setOpen(false);
    if (step === 'done') setStep('cart');
  }

  const groups = new Map<string, SiteProduct[]>();
  for (const pr of products) {
    const key = pr.category?.trim() || 'Products';
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  }

  return (
    <>
      <section id="products" className="bg-white px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-slate-900">Products</h2>
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
                {step === 'cart' ? 'Your cart' : step === 'details' ? 'Checkout' : 'Order placed'}
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
                  <input className={field} placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <input className={field} placeholder="Phone number *" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  <textarea
                    className={field}
                    rows={2}
                    placeholder={shop?.checkout.requireAddress ? 'Delivery address *' : 'Delivery address (optional)'}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  {shop?.checkout.showNote && (
                    <textarea className={field} rows={2} placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
                  {result.method === 'transfer' && shop?.bank ? (
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">Please transfer to:</p>
                      <p className="mt-2">{shop.bank.bank_name}</p>
                      <p className="text-lg font-bold">{shop.bank.account_number}</p>
                      <p>{shop.bank.account_name}</p>
                      <p className="mt-2 text-xs text-slate-500">Use order #{result.number} as the reference.</p>
                    </div>
                  ) : (
                    <p>You will pay when your order is delivered. The business will contact you shortly.</p>
                  )}
                </div>
              )}
            </div>

            {step !== 'done' && lines.length > 0 && (
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
                  <button
                    onClick={applyCode}
                    className="rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
                  >
                    Apply
                  </button>
                </div>
                {codeMsg && (
                  <p className={`mb-3 text-xs ${discount ? 'text-green-700' : 'text-red-600'}`}>{codeMsg}</p>
                )}
                {discount && (
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-slate-500">Discount ({discount.code})</span>
                    <span className="text-green-700">−{naira(discount.amount)}</span>
                  </div>
                )}
                <div className="mb-3 flex justify-between text-sm">
                  <span className="text-slate-500">Total</span>
                  <span className="font-bold">{naira(payable)}</span>
                </div>
                {belowMin && (
                  <p className="mb-3 text-xs text-amber-700">
                    The minimum order is {naira(minOrder)}. Add {naira(minOrder - total)} more to check out.
                  </p>
                )}
                {step === 'cart' ? (
                  <button
                    onClick={() => setStep('details')}
                    disabled={belowMin}
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
                      disabled={busy || belowMin}
                      className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy ? 'Placing order...' : 'Place order'}
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