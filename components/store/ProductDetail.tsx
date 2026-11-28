'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { Rail, StoreCard, badgeOf } from '@/components/store/Blocks';
import ProductGallery from '@/components/store/ProductGallery';
import { galleryOf } from '@/lib/store/gallery';
import type { SiteProduct } from '@/components/SiteProducts';

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

export default function ProductDetail({ p, slug, collections, related, canOrder }: { p: SiteProduct; slug: string; collections: { title: string; href: string }[]; related: SiteProduct[]; canOrder: boolean }) {
  const [qty, setQty] = useState(1);
  const soldOut = p.stock !== null && p.stock <= 0;
  const max = p.stock === null ? 10 : Math.max(1, Math.min(10, p.stock));
  const was = p.compare_at_price && p.compare_at_price > p.price ? p.compare_at_price : 0;
  const badge = badgeOf(p);
  return (
    <div className="xs-wrap py-8">
      <nav className="xs-muted mb-5 text-xs uppercase tracking-widest" aria-label="Breadcrumb">
        <Link href={`/b/${slug}`} className="hover:underline">Home</Link>
        {collections[0] && <><span className="mx-2">/</span><Link href={collections[0].href} className="hover:underline">{collections[0].title}</Link></>}
        <span className="mx-2">/</span><span>{p.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-2 lg:gap-14">
        <ProductGallery key={p.id} pics={galleryOf(p)} name={p.name} badge={soldOut ? <span className="xs-badge">Sold out</span> : was > 0 ? <span className="xs-badge xs-sale">Sale</span> : badge ? <span className="xs-badge">{badge}</span> : null} />
        <div>
          {p.vendor && <p className="xs-muted text-xs font-semibold uppercase tracking-[0.25em]">{p.vendor}</p>}
          <h1 className="xs-h2 mt-2">{p.name}</h1>
          {p.product_type && <p className="xs-muted mt-1 text-sm">{p.product_type}</p>}
          <p className="mt-4 text-xl">
            {was > 0 && <span className="xs-muted mr-3 line-through">{naira(was)}</span>}
            <span className={`font-semibold ${was > 0 ? 'xs-sale-price' : ''}`}>{naira(p.price)}</span>
          </p>
          {was > 0 && <p className="xs-sale-price mt-1 text-xs font-bold uppercase tracking-wide">You save {naira(was - p.price)}</p>}
          <p className="xs-muted mt-2 text-sm">{soldOut ? 'Out of stock' : p.stock !== null && p.stock <= 5 ? `Only ${p.stock} left` : 'In stock'}</p>

          {canOrder && !soldOut && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center border" style={{ borderColor: 'var(--xs-text)' }}>
                <button className="p-3" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Less"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                <button className="p-3" onClick={() => setQty((n) => Math.min(max, n + 1))} aria-label="More"><Plus className="h-4 w-4" /></button>
              </div>
              <button className="xs-btn flex-1" onClick={() => window.dispatchEvent(new CustomEvent('xenon:add', { detail: { id: p.id, qty } }))}><ShoppingBag className="h-4 w-4" />Add to cart</button>
            </div>
          )}
          {!canOrder && <p className="mt-6 rounded bg-amber-50 px-4 py-3 text-sm text-amber-800">We are not taking orders right now. Please check back soon.</p>}

          {p.description && <div className="mt-8 border-t pt-6 text-sm leading-relaxed" style={{ borderColor: 'var(--xs-border)' }}><p className="whitespace-pre-line">{p.description}</p></div>}
          {collections.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">{collections.map((c) => <Link key={c.href} href={c.href} className="xs-pill text-[11px] font-semibold uppercase tracking-wider">{c.title}</Link>)}</div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="xs-h2 mb-6">You may also like</h2>
          <Rail label="Related products">{related.map((r) => <StoreCard key={r.id} p={r} slug={slug} width="w-[62%] sm:w-[34%] md:w-[26%] lg:w-[21.5%]" />)}</Rail>
        </section>
      )}
    </div>
  );
}
