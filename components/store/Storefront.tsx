'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, ShieldCheck, Phone, CreditCard, Gift, Clock, Heart, Star, Search, ShoppingBag, ChevronDown, MessageCircle } from 'lucide-react';
import SiteProducts, { type Shop, type SiteProduct } from '@/components/SiteProducts';
import { fontsHref, safeColor, safeHref, strokeWidth, themeCss, type Section, type ThemeData } from '@/lib/store/theme';
import { Markdown, linkFor, type LinkCtx } from '@/lib/store/markdown';

export type StoreInfo = { name: string; slug: string; phone?: string; about?: string; photoUrl?: string };
export type PageLink = { title: string; handle: string };

const ICONS = { truck: Truck, shield: ShieldCheck, phone: Phone, card: CreditCard, gift: Gift, clock: Clock, heart: Heart, star: Star } as const;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export default function Storefront({
  theme, info, products, shop, pages = [], policies = [], storefronts = [], trusted = [], preview = false, mode = 'home', children,
}: {
  theme: ThemeData; info: StoreInfo; products: SiteProduct[]; shop?: Shop; pages?: PageLink[];
  policies?: { label: string; href: string }[]; storefronts?: { name: string; address: string }[]; trusted?: string[];
  preview?: boolean; mode?: 'home' | 'page'; children?: React.ReactNode;
}) {
  const ctx: LinkCtx = { slug: info.slug, trusted };
  const [cart, setCart] = useState({ count: 0 });
  const [q, setQ] = useState('');
  const sw = strokeWidth(theme.settings);

  useEffect(() => {
    const f = (e: Event) => setCart({ count: Number((e as CustomEvent).detail?.count ?? 0) });
    window.addEventListener('xenon:cart', f);
    return () => window.removeEventListener('xenon:cart', f);
  }, []);

  // fonts are loaded once per theme
  useEffect(() => {
    const id = 'xs-fonts';
    let l = document.getElementById(id) as HTMLLinkElement | null;
    if (!l) { l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; document.head.appendChild(l); }
    l.href = fontsHref(theme.settings);
  }, [theme.settings]);

  const link = (href: unknown) => { const l = linkFor(s(href), ctx); return l; };
  const A = ({ href, className, children: c }: { href: unknown; className?: string; children: React.ReactNode }) => {
    const l = link(href);
    return l.href.startsWith('/') ? <Link href={l.href} className={className}>{c}</Link> : <a href={l.href} className={className} {...(l.external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{c}</a>;
  };

  const wrap = (sec: Section, node: React.ReactNode) => (
    <div key={sec.id} data-sid={sec.id} onClickCapture={preview ? (e) => { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ xenon: 'select', id: sec.id }, window.location.origin); } : undefined} className={preview ? 'cursor-pointer hover:outline hover:outline-2 hover:outline-blue-500' : ''}>
      {node}
    </div>
  );

  const render = (sec: Section) => {
    const x = sec.s;
    switch (sec.type) {
      case 'announcement': {
        if (!s(x.text)) return null;
        const bg = safeColor(x.bg, 'var(--xs-primary)'); const col = safeColor(x.color, 'var(--xs-primary-text)');
        const inner = <div className="xs-wrap py-2 text-center text-sm font-medium">{s(x.text)}</div>;
        return <div style={{ background: bg, color: col }}>{s(x.link) ? <A href={x.link}>{inner}</A> : inner}</div>;
      }
      case 'header': {
        const links = arr<{ label: string; href: string }>(x.links);
        const logo = s(x.logoImage);
        return (
          <header className="z-40 border-b" style={{ background: 'var(--xs-bg)', borderColor: 'var(--xs-border)', position: x.sticky && !preview ? 'sticky' : 'static', top: 0 }}>
            <div className={`xs-wrap flex items-center gap-4 py-3 ${x.center ? 'flex-col sm:flex-row sm:justify-between' : ''}`}>
              <A href={`/b/${info.slug}`} className="flex items-center gap-2">
                {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={safeHref(logo, info.slug)} alt={info.name} className="h-9 w-auto" /> : <span className="xs-h4 xs-accent">{s(x.logoText) || info.name}</span>}
              </A>
              <nav className="flex flex-1 flex-wrap items-center justify-center gap-5 text-sm font-medium sm:justify-start" style={x.center ? { justifyContent: 'center' } : undefined}>
                {links.map((l, i) => <A key={i} href={l.href}>{s(l.label)}</A>)}
              </nav>
              <div className="flex items-center gap-3">
                {x.showSearch !== false && (
                  <label className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" strokeWidth={sw} />
                    <input value={q} onChange={(e) => { setQ(e.target.value); window.dispatchEvent(new CustomEvent('xenon:search', { detail: e.target.value })); }} placeholder="Search products" className="w-44 py-2 pl-9 pr-3 text-sm" aria-label="Search products" />
                  </label>
                )}
                {x.showCart !== false && (
                  <button onClick={() => window.dispatchEvent(new Event('xenon:open-cart'))} className="relative p-2" aria-label="Open cart">
                    <ShoppingBag className="h-6 w-6" strokeWidth={sw} />
                    {cart.count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold" style={{ background: 'var(--xs-primary)', color: 'var(--xs-primary-text)' }}>{cart.count}</span>}
                  </button>
                )}
              </div>
            </div>
          </header>
        );
      }
      case 'hero': {
        const img = safeHref(x.image, info.slug); const h = { small: 280, medium: 420, large: 580 }[s(x.height) as 'small'] ?? 420;
        const left = x.align === 'left';
        return (
          <section className="relative flex items-center overflow-hidden" style={{ minHeight: h, background: safeColor(x.bg, 'var(--xs-primary)'), color: safeColor(x.textColor, '#fff') }}>
            {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${Number(x.overlay ?? 0) / 100})` }} />
            <div className={`xs-wrap relative w-full py-12 ${left ? 'text-left' : 'text-center'}`}>
              <h1 className="xs-h1">{s(x.heading)}</h1>
              {s(x.sub) && <p className={`mt-3 max-w-xl text-lg opacity-90 ${left ? '' : 'mx-auto'}`}>{s(x.sub)}</p>}
              {s(x.button) && <div className="mt-6"><A href={x.link} className="xs-btn" ><span>{s(x.button)}</span></A></div>}
            </div>
          </section>
        );
      }
      case 'products':
        return <SiteProducts products={products} shop={shop} heading={s(x.heading) || 'Products'} hideTrack={x.showTrack === false} themed />;
      case 'richtext':
        return (
          <section className="xs-wrap py-14" style={{ textAlign: x.align === 'left' ? 'left' : 'center' }}>
            {s(x.heading) && <h2 className="xs-h2">{s(x.heading)}</h2>}
            <div className={`mt-4 max-w-2xl ${x.align === 'left' ? '' : 'mx-auto'}`}><Markdown text={s(x.text)} ctx={ctx} /></div>
            {s(x.button) && <div className="mt-6"><A href={x.link} className="xs-btn">{s(x.button)}</A></div>}
          </section>
        );
      case 'imagetext': {
        const img = safeHref(x.image, info.slug);
        return (
          <section className="xs-wrap py-14">
            <div className={`grid items-center gap-8 md:grid-cols-2 ${x.imageSide === 'right' ? 'md:[&>*:first-child]:order-2' : ''}`}>
              <div className="aspect-[4/3] overflow-hidden" style={{ background: 'var(--xs-border)', borderRadius: theme.settings.cards.radius }}>
                {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="h-full w-full object-cover" />}
              </div>
              <div>
                <h2 className="xs-h2">{s(x.heading)}</h2>
                <div className="mt-3"><Markdown text={s(x.text)} ctx={ctx} /></div>
                {s(x.button) && <div className="mt-5"><A href={x.link} className="xs-btn">{s(x.button)}</A></div>}
              </div>
            </div>
          </section>
        );
      }
      case 'trust':
        return (
          <section className="border-y py-8" style={{ borderColor: 'var(--xs-border)' }}>
            <div className="xs-wrap grid gap-6 sm:grid-cols-3">
              {arr<{ icon: string; title: string; text: string }>(x.items).map((it, i) => {
                const Ic = ICONS[it.icon as keyof typeof ICONS] ?? Star;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <Ic className="mt-1 h-6 w-6 shrink-0" style={{ color: 'var(--xs-accent)' }} strokeWidth={sw} />
                    <div><p className="xs-sub font-semibold">{s(it.title)}</p><p className="xs-muted text-sm">{s(it.text)}</p></div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      case 'testimonials':
        return (
          <section className="xs-wrap py-14">
            <h2 className="xs-h2 text-center">{s(x.heading)}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {arr<{ name: string; text: string }>(x.items).map((it, i) => (
                <figure key={i} className="xs-card p-5" style={{ background: 'var(--xs-card)', border: '1px solid var(--xs-border)', borderRadius: theme.settings.cards.radius }}>
                  <div className="flex gap-0.5" style={{ color: 'var(--xs-accent)' }}>{[0, 1, 2, 3, 4].map((n) => <Star key={n} className="h-4 w-4 fill-current" />)}</div>
                  <blockquote className="mt-3">{s(it.text)}</blockquote>
                  <figcaption className="xs-muted mt-3 text-sm font-medium">{s(it.name)}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      case 'faq':
        return (
          <section className="xs-wrap max-w-3xl py-14">
            <h2 className="xs-h2 text-center">{s(x.heading)}</h2>
            <div className="mt-6 divide-y" style={{ borderColor: 'var(--xs-border)' }}>
              {arr<{ q: string; a: string }>(x.items).map((it, i) => (
                <details key={i} className="group py-4" style={{ borderColor: 'var(--xs-border)' }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{s(it.q)}<ChevronDown className="h-5 w-5 transition group-open:rotate-180" strokeWidth={sw} /></summary>
                  <p className="xs-muted mt-2">{s(it.a)}</p>
                </details>
              ))}
            </div>
          </section>
        );
      case 'contact': {
        const wa = s(x.whatsapp).replace(/\D/g, '') || (info.phone ?? '').replace(/\D/g, '');
        const waNum = wa.startsWith('0') ? `234${wa.slice(1)}` : wa;
        const phone = s(x.phone) || info.phone || '';
        return (
          <section className="xs-wrap py-14 text-center">
            <h2 className="xs-h2">{s(x.heading)}</h2>
            <p className="xs-muted mx-auto mt-2 max-w-xl">{s(x.text)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {waNum && <a className="xs-btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Hello ${info.name}, I want to place an order.`)}`}><MessageCircle className="h-4 w-4" />{s(x.button) || 'Chat on WhatsApp'}</a>}
              {phone && <a className="xs-btn-secondary" href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" />Call us</a>}
            </div>
          </section>
        );
      }
      case 'footer': {
        const bg = safeColor(x.bg, 'transparent'); const col = safeColor(x.color, '');
        const social = [['Instagram', x.instagram], ['Facebook', x.facebook], ['TikTok', x.tiktok], ['X', x.x]].filter((p) => safeHref(p[1], info.slug));
        return (
          <footer className="mt-8 border-t py-10 text-sm" style={{ borderColor: 'var(--xs-border)', background: bg, color: col || undefined }}>
            <div className="xs-wrap grid gap-8 sm:grid-cols-3">
              <div><p className="xs-h4 xs-accent">{info.name}</p>{(s(x.text) || info.about) && <p className="xs-muted mt-2">{s(x.text) || info.about}</p>}</div>
              <div className="space-y-1">
                {x.showPages !== false && pages.map((p) => <p key={p.handle}><Link href={`/b/${info.slug}/pages/${p.handle}`} className="hover:underline">{p.title}</Link></p>)}
                {x.showPolicies !== false && policies.map((p) => <p key={p.href}><Link href={p.href} className="hover:underline">{p.label}</Link></p>)}
              </div>
              <div className="space-y-1">
                {x.showStorefronts !== false && storefronts.map((st, i) => <p key={i}><span className="font-semibold">{st.name}</span><br /><span className="xs-muted">{st.address}</span></p>)}
                {social.map((p, i) => <p key={i}><A href={p[1]} className="hover:underline">{String(p[0])}</A></p>)}
              </div>
            </div>
            <p className="xs-wrap xs-muted mt-8 text-xs">© {new Date().getFullYear()} {info.name}. Powered by Xenon.</p>
          </footer>
        );
      }
    }
  };

  const secs = theme.sections.filter((sec) => sec.visible);
  return (
    <div className="xs-store">
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme.settings) }} />
      {mode === 'home'
        ? secs.map((sec) => { const n = render(sec); return n ? wrap(sec, n) : null; })
        : (
          <>
            {theme.sections.filter((x) => x.visible && (x.type === 'announcement' || x.type === 'header')).map((sec) => { const n = render(sec); return n ? <div key={sec.id}>{n}</div> : null; })}
            <main className="xs-wrap max-w-3xl py-12">{children}</main>
            {theme.sections.filter((x) => x.type === 'footer').map((sec) => <div key={sec.id}>{render(sec)}</div>)}
          </>
        )}
    </div>
  );
}
