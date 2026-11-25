'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { productHref } from '@/lib/store/collections';
import type { SiteProduct } from '@/components/SiteProducts';

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

// a link that works for both in-store paths and outside addresses (already checked by the storefront)
export function L({ href, className, children, onClick, external }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void; external?: boolean }) {
  return href.startsWith('/') ? <Link href={href} className={className} onClick={onClick}>{children}</Link>
    : <a href={href} className={className} onClick={onClick} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{children}</a>;
}

// the owner can add a custom badge to a product with a tag like  badge:Deal of the day
export const badgeOf = (p: SiteProduct) => {
  const t = (p.tags ?? []).find((x) => /^badge\s*:/i.test(x));
  return t ? t.replace(/^badge\s*:\s*/i, '').trim().slice(0, 24) : '';
};

export function StoreCard({ p, slug, portrait = true, width = '' }: { p: SiteProduct; slug: string; portrait?: boolean; width?: string }) {
  const soldOut = p.stock !== null && p.stock <= 0;
  const was = p.compare_at_price && p.compare_at_price > p.price ? p.compare_at_price : 0;
  const custom = badgeOf(p);
  const href = productHref(slug, p);
  return (
    <div className={`xs-card group flex flex-col ${width}`}>
      <Link href={href} className="xs-media relative block overflow-hidden" aria-label={p.name}>
        <div className={portrait ? 'aspect-[3/4]' : 'aspect-square'}>
          {p.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt={p.name} loading="lazy" className={`h-full w-full object-cover ${portrait ? 'object-top' : ''}`} />}
        </div>
        {soldOut ? <span className="xs-badge">Sold out</span>
          : was > 0 ? <span className="xs-badge xs-sale">Sale</span>
          : custom ? <span className="xs-badge">{custom}</span>
          : p.stock !== null && p.stock <= 5 ? <span className="xs-badge">Only {p.stock} left</span> : null}
        {!soldOut && was > 0 && custom && <span className="xs-badge" style={{ top: 34 }}>{custom}</span>}
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <Link href={href} className="xs-pname line-clamp-2">{p.name}</Link>
        {p.product_type && <p className="xs-muted mt-0.5 text-xs">{p.product_type}</p>}
        <p className="mt-1.5 text-sm">
          {was > 0 && <span className="xs-muted mr-2 line-through">{naira(was)}</span>}
          <span className={`font-semibold ${was > 0 ? 'xs-sale-price' : ''}`}>{naira(p.price)}</span>
        </p>
        {was > 0 && <div className="xs-sale-price mt-0.5 text-[11px] font-bold uppercase tracking-wide">Save {naira(was - p.price)}</div>}
        <button
          type="button"
          disabled={soldOut}
          onClick={() => window.dispatchEvent(new CustomEvent('xenon:add', { detail: { id: p.id } }))}
          className="xs-add xs-btn-secondary mt-3 !w-full !justify-center !py-2 !text-xs uppercase tracking-widest disabled:opacity-40"
        >
          {soldOut ? 'Sold out' : <><Plus className="h-3.5 w-3.5" />Add to cart</>}
        </button>
      </div>
    </div>
  );
}

// a row you swipe (or use the arrows on a computer)
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (d: number) => { const el = ref.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: 'smooth' }); };
  return (
    <div className="relative" aria-label={label}>
      <div ref={ref} className="xs-hscroll pb-1">{children}</div>
      <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-1 top-[38%] hidden h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow md:flex"><ChevronLeft className="h-5 w-5" /></button>
      <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-1 top-[38%] hidden h-10 w-10 items-center justify-center rounded-full bg-white/95 text-black shadow md:flex"><ChevronRight className="h-5 w-5" /></button>
    </div>
  );
}

const CARD_W = 'w-[62%] sm:w-[34%] md:w-[26%] lg:w-[21.5%]';

export function SectionHead({ heading, button, href }: { heading: string; button?: string; href?: string }) {
  if (!heading && !button) return null;
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h2 className="xs-h2">{heading}</h2>
      {button && href && <L href={href} className="xs-btn !px-5 !py-2.5 !text-xs !tracking-widest">{button}</L>}
    </div>
  );
}

export function CollectionRow({ products, slug, heading, button, href, portrait }: { products: SiteProduct[]; slug: string; heading: string; button: string; href: string; portrait: boolean }) {
  if (products.length === 0) return null;
  return (
    <section className="xs-wrap py-10">
      <SectionHead heading={heading} button={button} href={href} />
      <Rail label={heading || 'Products'}>{products.map((p) => <StoreCard key={p.id} p={p} slug={slug} portrait={portrait} width={CARD_W} />)}</Rail>
    </section>
  );
}

export type Tab = { label: string; href: string; products: SiteProduct[] };
export function CollectionTabs({ tabs, slug, heading, button, portrait }: { tabs: Tab[]; slug: string; heading: string; button: string; portrait: boolean }) {
  const [i, setI] = useState(0);
  const cur = tabs[Math.min(i, tabs.length - 1)];
  if (!cur) return null;
  return (
    <section className="xs-wrap py-10">
      {heading && <h2 className="xs-h2 mb-5">{heading}</h2>}
      <div className="mb-6 flex flex-wrap gap-x-7 gap-y-2 border-b pb-3" style={{ borderColor: 'var(--xs-border)' }} role="tablist">
        {tabs.map((t, k) => (
          <button key={k} role="tab" aria-selected={k === i} onClick={() => setI(k)} className="text-xs font-bold uppercase tracking-[0.2em] transition" style={{ opacity: k === i ? 1 : 0.45, borderBottom: k === i ? '2px solid currentColor' : '2px solid transparent', paddingBottom: 10, marginBottom: -13 }}>{t.label}</button>
        ))}
      </div>
      {cur.products.length === 0 ? <p className="xs-muted py-10 text-center text-sm">Nothing here yet.</p> : <Rail label={cur.label}>{cur.products.map((p) => <StoreCard key={p.id} p={p} slug={slug} portrait={portrait} width={CARD_W} />)}</Rail>}
      {button && <div className="mt-7 text-center"><L href={cur.href} className="xs-btn">{button}</L></div>}
    </section>
  );
}

export type Tile = { title: string; image: string; href: string; button: string };
export function CollectionTiles({ tiles, heading, columns }: { tiles: Tile[]; heading: string; columns: number }) {
  if (tiles.length === 0) return null;
  const cols = columns >= 4 ? 'lg:grid-cols-4' : columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <section className="xs-wrap py-10">
      {heading && <h2 className="xs-h2 mb-6">{heading}</h2>}
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {tiles.map((t, i) => (
          <L key={i} href={t.href} className="group block">
            <div className="xs-media relative aspect-[3/4] overflow-hidden">
              {t.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.image} alt="" loading="lazy" className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />}
            </div>
            <p className="xs-pname mt-3">{t.title}</p>
            {t.button && <span className="mt-1 inline-block border-b border-current pb-0.5 text-[11px] font-bold uppercase tracking-[0.2em]">{t.button}</span>}
          </L>
        ))}
      </div>
    </section>
  );
}

export type Person = { image: string; name: string; tag: string; role: string; verified: boolean; href: string };
export function PeopleRail({ items, heading, subtitle }: { items: Person[]; heading: string; subtitle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  if (items.length === 0) return null;
  const go = (d: number) => { const el = ref.current; if (el) el.scrollBy({ left: d * el.clientWidth * 0.85, behavior: 'smooth' }); };
  return (
    <section className="py-12" style={{ background: 'color-mix(in srgb, var(--xs-border) 45%, transparent)' }}>
      <div className="xs-wrap">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div><h2 className="xs-h2">{heading}</h2>{subtitle && <p className="xs-muted mt-2 text-sm">{subtitle}</p>}</div>
          <div className="hidden gap-2 md:flex">
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="flex h-10 w-10 items-center justify-center rounded-full border border-current"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="flex h-10 w-10 items-center justify-center rounded-full border border-current"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
        <div ref={ref} className="xs-hscroll" onScroll={(e) => { const el = e.currentTarget; setPage(Math.round(el.scrollLeft / Math.max(1, el.scrollWidth / items.length))); }}>
          {items.map((it, i) => {
            const inner = (
              <>
                <div className="xs-media relative aspect-[3/4] overflow-hidden">
                  {it.image ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={it.image} alt={it.name} loading="lazy" className="h-full w-full object-cover object-top" /> : <span className="flex h-full items-center justify-center text-4xl font-bold opacity-30">{it.name.charAt(0).toUpperCase()}</span>}
                  {it.tag && <span className="absolute bottom-3 left-3 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-black">{it.tag}</span>}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">{it.name}{it.verified && <BadgeCheck className="h-4 w-4 text-sky-500" aria-label="Verified" />}</p>
                {it.role && <p className="xs-muted text-xs">{it.role}</p>}
              </>
            );
            const w = 'w-[70%] sm:w-[40%] md:w-[28%] lg:w-[22%]';
            return it.href ? <L key={i} href={it.href} className={w}>{inner}</L> : <div key={i} className={w}>{inner}</div>;
          })}
        </div>
        <div className="mt-5 flex justify-center gap-2" aria-hidden>{items.map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor', opacity: i === Math.min(page, items.length - 1) ? 1 : 0.25 }} />)}</div>
      </div>
    </section>
  );
}

export type TickerItem = { text: string; href: string };
export function Ticker({ items, seconds, bg, color }: { items: TickerItem[]; seconds: number; bg: string; color: string }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), Math.max(2, seconds) * 1000);
    return () => clearInterval(t);
  }, [n, seconds, paused]);
  if (n === 0) return null;
  const cur = items[i % n];
  const text = <span className="text-xs font-medium tracking-wide">{cur.text}</span>;
  return (
    <div className="border-b" style={{ background: bg || 'var(--xs-bg)', color: color || 'var(--xs-text)', borderColor: 'var(--xs-border)' }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-live="polite">
      <div className="xs-wrap flex items-center justify-between py-2">
        <button type="button" onClick={() => setI((i - 1 + n) % n)} aria-label="Previous message" className={`p-1 ${n < 2 ? 'invisible' : ''}`}><ChevronLeft className="h-4 w-4" /></button>
        {cur.href ? <L href={cur.href} className="px-2 text-center">{text}</L> : <span className="px-2 text-center">{text}</span>}
        <button type="button" onClick={() => setI((i + 1) % n)} aria-label="Next message" className={`p-1 ${n < 2 ? 'invisible' : ''}`}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Gallery({ items, heading, handleText, link }: { items: { image: string; href: string }[]; heading: string; handleText: string; link: string }) {
  if (items.length === 0) return null;
  return (
    <section className="py-10">
      <div className="xs-wrap">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="xs-h2">{heading || (handleText ? `Follow ${handleText}` : '')}</h2>
          {link && <L href={link} external className="text-[11px] font-bold uppercase tracking-[0.2em] underline">Follow us</L>}
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((g, i) => {
            const img = /* eslint-disable-next-line @next/next/no-img-element */ <img src={g.image} alt="" loading="lazy" className="aspect-square w-full object-cover" />;
            return g.href ? <L key={i} href={g.href} external>{img}</L> : <div key={i}>{img}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

export function NewsletterForm({ slug, button, success, preview, dark }: { slug: string; button: string; success: string; preview: boolean; dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'bad'>('idle');
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return setState('ok');
    setState('busy');
    const { data, error } = await createClient().rpc('xenon_store_subscribe', { p_slug: slug, p_email: email });
    setState(!error && data === 'ok' ? 'ok' : 'bad');
  }
  if (state === 'ok') return <p className="text-sm font-medium">{success || 'Thank you for subscribing!'}</p>;
  return (
    <div>
    <form onSubmit={go} className="flex">
      <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setState('idle'); }} placeholder="Your email address" aria-label="Email address" className="min-w-0 flex-1 px-3 py-3 text-sm" style={dark ? { background: 'transparent', color: 'inherit', borderColor: 'currentColor' } : undefined} />
      <button disabled={state === 'busy'} className="flex shrink-0 items-center justify-center px-4 text-sm font-semibold uppercase tracking-widest disabled:opacity-60" style={{ background: dark ? '#fff' : 'var(--xs-primary)', color: dark ? '#111' : 'var(--xs-primary-text)' }} aria-label={button || 'Subscribe'}>
        {button ? <span className="hidden sm:inline">{button}</span> : null}<ArrowRight className="h-4 w-4 sm:ml-2" />
      </button>
    </form>
    {state === 'bad' && <p className="mt-2 text-xs" role="alert">Please check your email address and try again.</p>}
    </div>
  );
}
