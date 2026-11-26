'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import type { SiteProduct } from '@/components/SiteProducts';
import { productHref } from '@/lib/store/collections';

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

// The cart page. The cart itself lives in the store's hidden cart engine (SiteProducts), which saves it on this device;
// this page shows it and asks the engine to change it, so the drawer and this page always agree.
export default function CartView({ products, slug, businessId, canOrder, minOrder, maxQty = 10 }: { products: SiteProduct[]; slug: string; businessId: string; canOrder: boolean; minOrder: number; maxQty?: number }) {
  const [cart, setCart] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`xenon-cart-${businessId}`);
      setCart(raw ? (JSON.parse(raw) as Record<string, number>) : {});
    } catch { setCart({}); }
    const on = (e: Event) => setCart(((e as CustomEvent).detail as { cart?: Record<string, number> } | undefined)?.cart ?? {});
    window.addEventListener('xenon:cart-changed', on);
    return () => window.removeEventListener('xenon:cart-changed', on);
  }, [businessId]);

  const lines = useMemo(() => (cart ? products.filter((p) => (cart[p.id] ?? 0) > 0 && (p.stock === null || p.stock > 0)).map((p) => ({ p, qty: cart[p.id] })) : []), [products, cart]);
  const subtotal = lines.reduce((n, l) => n + l.p.price * l.qty, 0);
  const saved = lines.reduce((n, l) => n + Math.max(0, (l.p.compare_at_price ?? 0) - l.p.price) * l.qty, 0);
  const setQty = (id: string, qty: number) => window.dispatchEvent(new CustomEvent('xenon:setqty', { detail: { id, qty } }));
  const capOf = (p: SiteProduct) => Math.min(maxQty, p.stock === null ? maxQty : p.stock);

  if (cart === null) return <div className="h-48 animate-pulse rounded-xl" style={{ background: 'var(--xs-border)' }} aria-label="Loading your cart" />;

  if (lines.length === 0) {
    return (
      <div className="py-10 text-center">
        <ShoppingBag className="mx-auto h-10 w-10 opacity-40" aria-hidden />
        <h1 className="xs-h2 mt-4">Your cart is empty</h1>
        <p className="xs-muted mt-2">Add something you like and it will show up here.</p>
        <Link href={`/b/${slug}`} className="xs-btn mt-6 inline-block">Continue shopping</Link>
      </div>
    );
  }

  const belowMin = minOrder > 0 && subtotal < minOrder;
  return (
    <div>
      <h1 className="xs-h2">Your cart</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y" style={{ borderColor: 'var(--xs-border)' }}>
          {lines.map(({ p, qty }) => (
            <li key={p.id} className="flex gap-4 py-5" style={{ borderColor: 'var(--xs-border)' }}>
              <Link href={productHref(slug, p)} className="h-24 w-20 shrink-0 overflow-hidden sm:h-28 sm:w-24" style={{ background: 'var(--xs-border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.photo_url && <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <Link href={productHref(slug, p)} className="xs-pname hover:underline">{p.name}</Link>
                  <p className="shrink-0 font-semibold">{naira(p.price * qty)}</p>
                </div>
                <p className="xs-muted mt-1 text-sm">
                  {p.compare_at_price && p.compare_at_price > p.price && <span className="mr-2 line-through">{naira(p.compare_at_price)}</span>}
                  {naira(p.price)} each
                </p>
                {p.stock !== null && p.stock <= 5 && <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--xs-accent)' }}>Only {p.stock} left</p>}
                <div className="mt-auto flex items-center gap-4 pt-3">
                  <div className="inline-flex items-center border" style={{ borderColor: 'var(--xs-border)' }}>
                    <button type="button" aria-label={`One less ${p.name}`} className="p-2.5 disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty(p.id, qty - 1)}><Minus className="h-4 w-4" /></button>
                    <span className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                    <button type="button" aria-label={`One more ${p.name}`} className="p-2.5 disabled:opacity-30" disabled={qty >= capOf(p)} onClick={() => setQty(p.id, qty + 1)}><Plus className="h-4 w-4" /></button>
                  </div>
                  <button type="button" className="inline-flex items-center gap-1 text-sm underline opacity-70 hover:opacity-100" onClick={() => setQty(p.id, 0)}><Trash2 className="h-4 w-4" />Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="h-fit border p-5" style={{ borderColor: 'var(--xs-border)', background: 'var(--xs-card)' }}>
          <h2 className="xs-h4">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{naira(subtotal)}</dd></div>
            {saved > 0 && <div className="flex justify-between" style={{ color: 'var(--xs-accent)' }}><dt>You save</dt><dd className="font-semibold">{naira(saved)}</dd></div>}
          </dl>
          <p className="xs-muted mt-3 text-xs">Delivery, discount codes and any tax are worked out at checkout.</p>
          {belowMin && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900" role="status">The minimum order is {naira(minOrder)}. Add {naira(minOrder - subtotal)} more to check out.</p>}
          {!canOrder && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900" role="status">This store is not taking orders right now.</p>}
          <button type="button" className="xs-btn mt-5 w-full disabled:opacity-50" disabled={belowMin || !canOrder} onClick={() => window.dispatchEvent(new Event('xenon:open-cart'))}>Checkout</button>
          <Link href={`/b/${slug}`} className="mt-3 block text-center text-sm underline opacity-80 hover:opacity-100">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
