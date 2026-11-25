'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { StoreCard } from '@/components/store/Blocks';
import type { SiteProduct } from '@/components/SiteProducts';

type Sort = 'featured' | 'discount' | 'price-asc' | 'price-desc' | 'newest' | 'az';
const PAGE = 24;

// The page behind every "Shop now" button: all products of one collection, with sorting, filters and the same cart as the home page.
export default function CollectionView({ title, products, slug, others, current }: { title: string; products: SiteProduct[]; slug: string; others: { title: string; href: string; id: string }[]; current: string }) {
  const [sort, setSort] = useState<Sort>('featured');
  const [stockOnly, setStockOnly] = useState(false);
  const [saleOnly, setSaleOnly] = useState(false);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(PAGE);
  const hasSale = products.some((p) => p.compare_at_price && p.compare_at_price > p.price);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = products.filter((p) =>
      (!stockOnly || p.stock === null || p.stock > 0)
      && (!saleOnly || (p.compare_at_price ?? 0) > p.price)
      && (!needle || `${p.name} ${p.product_type ?? ''} ${p.vendor ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(needle)));
    const off = (p: SiteProduct) => (p.compare_at_price && p.compare_at_price > p.price ? (p.compare_at_price - p.price) / p.compare_at_price : 0);
    if (sort === 'price-asc') out = [...out].sort((a, b) => a.price - b.price);
    else if (sort === 'price-desc') out = [...out].sort((a, b) => b.price - a.price);
    else if (sort === 'az') out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'newest') out = [...out].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
    else if (sort === 'discount') out = [...out].sort((a, b) => off(b) - off(a));
    return out;
  }, [products, sort, stockOnly, saleOnly, q]);

  return (
    <div className="xs-wrap py-8">
      <nav className="xs-muted mb-4 text-xs uppercase tracking-widest" aria-label="Breadcrumb">
        <Link href={`/b/${slug}`} className="hover:underline">Home</Link><span className="mx-2">/</span><span>{title}</span>
      </nav>
      <h1 className="xs-h1" style={{ fontSize: 'clamp(28px,5vw,44px)' }}>{title}</h1>
      <p className="xs-muted mt-2 text-sm">{products.length} product{products.length === 1 ? '' : 's'}</p>

      {others.length > 1 && (
        <div className="xs-hscroll mt-6 pb-1">
          {others.map((o) => (
            <Link key={o.id} href={o.href} className="xs-pill whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={o.id === current ? { background: 'var(--xs-primary)', color: 'var(--xs-primary-text)', borderColor: 'var(--xs-primary)' } : undefined}>{o.title}</Link>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-y py-3 text-sm" style={{ borderColor: 'var(--xs-border)' }}>
        <label className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search in this collection" aria-label="Search in this collection" className="w-full py-2 pl-9 pr-3 text-sm" />
        </label>
        <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={stockOnly} onChange={(e) => { setStockOnly(e.target.checked); setShown(PAGE); }} />In stock</label>
        {hasSale && <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={saleOnly} onChange={(e) => { setSaleOnly(e.target.checked); setShown(PAGE); }} />On sale</label>}
        <label className="ml-auto flex items-center gap-2"><span className="xs-muted hidden sm:inline">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="py-2 pl-3 pr-8 text-sm" aria-label="Sort products">
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="az">Name: A to Z</option>
            {hasSale && <option value="discount">Biggest discount</option>}
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="py-20 text-center"><p className="xs-muted">No products match.</p>{(q || stockOnly || saleOnly) && <button className="xs-btn-secondary mt-4" onClick={() => { setQ(''); setStockOnly(false); setSaleOnly(false); }}>Clear filters</button>}</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
            {list.slice(0, shown).map((p) => <StoreCard key={p.id} p={p} slug={slug} portrait />)}
          </div>
          {shown < list.length && <div className="mt-10 text-center"><button className="xs-btn-secondary" onClick={() => setShown((n) => n + PAGE)}>Load more ({list.length - shown} left)</button></div>}
        </>
      )}
    </div>
  );
}
