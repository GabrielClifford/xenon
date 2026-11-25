'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, ShieldCheck, Phone, CreditCard, Gift, Clock, Heart, Star, Search, ShoppingBag, ChevronDown, MessageCircle, Menu, X, User, Music2, ArrowRight } from 'lucide-react';
import { Instagram, Facebook, Youtube } from '@/components/store/SocialIcons';
import SiteProducts, { type Shop, type SiteProduct } from '@/components/SiteProducts';
import FloatChat from '@/components/store/FloatChat';
import Countdown from '@/components/store/Countdown';
import { fontsHref, safeColor, safeHref, strokeWidth, themeCss, type Section, type ThemeData } from '@/lib/store/theme';
import { Markdown, linkFor, type LinkCtx } from '@/lib/store/markdown';

export type StoreInfo = { name: string; slug: string; phone?: string; about?: string; photoUrl?: string };
type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const sw = strokeWidth(theme.settings);
  const hdr = theme.sections.find((z) => z.type === 'header' && z.visible);
  const cartInHeader = !!hdr && hdr.s.showCart !== false;

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
        const centered = x.center === true;
        const accountOn = x.showAccount !== false && !!shop?.accounts?.enabled && !!shop?.accounts?.showSignIn;
        const logoEl = (
          <A href={`/b/${info.slug}`} className="flex items-center gap-2">
            {logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={safeHref(logo, info.slug)} alt={info.name} className="h-9 w-auto" /> : <span className={`xs-h4 xs-accent ${x.wide ? 'uppercase tracking-[0.3em] font-black' : ''}`}>{s(x.logoText) || info.name}</span>}
          </A>
        );
        const cartBtn = x.showCart !== false && (
          <button onClick={() => window.dispatchEvent(new Event('xenon:open-cart'))} className="relative p-2" aria-label="Open cart">
            <ShoppingBag className="h-6 w-6" strokeWidth={sw} />
            {cart.count > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold" style={{ background: 'var(--xs-primary)', color: 'var(--xs-primary-text)' }}>{cart.count}</span>}
          </button>
        );
        return (
          <header className="z-40 border-b" style={{ background: 'var(--xs-bg)', borderColor: 'var(--xs-border)', position: x.sticky && !preview ? 'sticky' : 'static', top: 0 }}>
            {centered ? (
              <div className="xs-wrap grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
                <div className="flex items-center gap-4">
                  {(x.showMenu === true || links.length > 0) && <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-1"><Menu className="h-5 w-5" strokeWidth={sw} /></button>}
                  {x.showSearch !== false && <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-1"><Search className="h-5 w-5" strokeWidth={sw} /></button>}
                </div>
                <div className="text-center">{logoEl}</div>
                <div className="flex items-center justify-end gap-3">
                  {accountOn && <Link href={`/b/${info.slug}/account`} aria-label="My account" className="p-1"><User className="h-5 w-5" strokeWidth={sw} /></Link>}
                  {cartBtn}
                </div>
              </div>
            ) : (
              <div className="xs-wrap flex items-center gap-4 py-3">
                {x.showMenu === true && <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-1 sm:hidden"><Menu className="h-5 w-5" strokeWidth={sw} /></button>}
                {logoEl}
                <nav className="hidden flex-1 flex-wrap items-center gap-5 text-sm font-medium sm:flex">
                  {links.map((l, i) => <A key={i} href={l.href}>{s(l.label)}</A>)}
                </nav>
                <div className="ml-auto flex items-center gap-3">
                  {x.showSearch !== false && (
                    <label className="relative hidden sm:block">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" strokeWidth={sw} />
                      <input value={q} onChange={(e) => { setQ(e.target.value); window.dispatchEvent(new CustomEvent('xenon:search', { detail: e.target.value })); }} placeholder="Search products" className="w-44 py-2 pl-9 pr-3 text-sm" aria-label="Search products" />
                    </label>
                  )}
                  {x.showSearch !== false && <button onClick={() => setSearchOpen(true)} aria-label="Search" className="p-1 sm:hidden"><Search className="h-5 w-5" strokeWidth={sw} /></button>}
                  {accountOn && <Link href={`/b/${info.slug}/account`} aria-label="My account" className="p-1"><User className="h-5 w-5" strokeWidth={sw} /></Link>}
                  {cartBtn}
                </div>
              </div>
            )}
          </header>
        );
      }
      case 'hero': {
        const img = safeHref(x.image, info.slug); const h = { small: 280, medium: 420, large: 580 }[s(x.height) as 'small'] ?? 420;
        const left = x.align === 'left'; const bottom = x.valign === 'bottom';
        return (
          <section className={`relative flex overflow-hidden ${bottom ? 'items-end' : 'items-center'}`} style={{ minHeight: h, background: safeColor(x.bg, 'var(--xs-primary)'), color: safeColor(x.textColor, '#fff') }}>
            {img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${Number(x.overlay ?? 0) / 100})` }} />
            <div className={`xs-wrap relative w-full ${bottom ? 'pb-14 pt-24' : 'py-12'} ${left ? 'text-left' : 'text-center'}`}>
              {s(x.eyebrow) && <span className="xs-sub mb-3 block text-xs font-semibold uppercase tracking-[0.3em] opacity-80">{s(x.eyebrow)}</span>}
              <h1 className="xs-h1">{s(x.heading)}</h1>
              {s(x.sub) && <p className={`mt-3 max-w-xl text-lg opacity-90 ${left ? '' : 'mx-auto'}`}>{s(x.sub)}</p>}
              {s(x.button) && <div className="mt-6"><A href={x.link} className={x.outline === true ? 'xs-btn-outline' : 'xs-btn'}><span>{s(x.button)}</span>{x.outline === true && <ArrowRight className="h-4 w-4" />}</A></div>}
            </div>
          </section>
        );
      }
      case 'products':
        return <SiteProducts products={products} shop={shop} heading={s(x.heading) || 'Products'} hideTrack={x.showTrack === false} themed layout={x.layout === 'rows' ? 'rows' : 'grid'} portrait={x.portrait === true} hideCartPill={cartInHeader} />;
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
      case 'testimonials': {
        const list = arr<{ name: string; text: string; rating?: string }>(x.items);
        const card = (it: { name: string; text: string; rating?: string }, i: number, w = '') => {
          const r = Math.max(1, Math.min(5, Number(it.rating) || 5));
          return (
            <figure key={i} className={`xs-card p-5 ${w}`} style={{ background: 'var(--xs-card)', border: '1px solid var(--xs-border)', borderRadius: theme.settings.cards.radius }}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: 'var(--xs-primary)', color: 'var(--xs-primary-text)' }}>{s(it.name).trim().charAt(0).toUpperCase() || '?'}</span>
                <div><figcaption className="text-sm font-medium">{s(it.name)}</figcaption>
                  <div className="flex gap-0.5" style={{ color: '#F5B301' }} role="img" aria-label={`${r} out of 5 stars`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3.5 w-3.5 ${n <= r ? 'fill-current' : 'opacity-25'}`} />)}</div></div>
              </div>
              <blockquote className="mt-3 text-sm">{s(it.text)}</blockquote>
            </figure>
          );
        };
        const head = (
          <div className="px-6 text-center">
            <h2 className="xs-h2">{s(x.heading)}</h2>
            {s(x.subtitle) && <p className="xs-muted mt-3 text-[10px] uppercase tracking-[0.25em]">{s(x.subtitle)}</p>}
          </div>
        );
        if (x.style === 'marquee' && list.length > 0) {
          return (
            <section className="overflow-hidden py-14" aria-label="Customer reviews">
              <style dangerouslySetInnerHTML={{ __html: '@keyframes xs-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}.xs-track{display:flex;width:max-content;animation:xs-scroll 70s linear infinite}.xs-track:hover{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.xs-track{animation:none}}' }} />
              {head}
              <div className="xs-track mt-8">
                {[0, 1].map((c) => <div key={c} className="flex shrink-0" aria-hidden={c === 1}>{list.map((it, i) => <div key={i} className="mx-2 w-[280px] shrink-0">{card(it, i, 'h-full')}</div>)}</div>)}
              </div>
            </section>
          );
        }
        return (
          <section className="xs-wrap py-14">
            {head}
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{list.map((it, i) => card(it, i))}</div>
          </section>
        );
      }
      case 'marquee': {
        const list = arr<{ text: string }>(x.items).filter((it) => s(it.text));
        if (list.length === 0) return null;
        const secs = Math.max(8, 70 - Number(x.speed ?? 30));
        const group = [...list, ...list];
        return (
          <section aria-label="Highlights" className="overflow-hidden border-y py-4" style={{ borderColor: 'var(--xs-border)', background: safeColor(x.bg, 'var(--xs-card)'), color: safeColor(x.color, '') || undefined }}>
            <style dangerouslySetInnerHTML={{ __html: `@keyframes xs-mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}.xs-mq-track{display:flex;width:max-content;animation:xs-mq ${secs}s linear infinite}@media(prefers-reduced-motion:reduce){.xs-mq-track{animation:none}}` }} />
            <div className="xs-mq-track">
              {[0, 1].map((c) => (
                <div key={c} className="flex shrink-0 items-center" aria-hidden={c === 1}>
                  {group.map((it, i) => <span key={i} className="flex items-center whitespace-nowrap text-xs font-semibold uppercase tracking-[0.3em]"><span className="px-8">{s(it.text)}</span><span className="opacity-40">✦</span></span>)}
                </div>
              ))}
            </div>
          </section>
        );
      }
      case 'countdown': {
        const bg = safeColor(x.bg, 'var(--xs-primary)'); const col = safeColor(x.color, 'var(--xs-primary-text)');
        return (
          <section className="py-8 text-center" style={{ background: bg, color: col }}>
            <div className="xs-wrap">
              <p className="xs-sub text-xs font-semibold uppercase tracking-[0.3em] opacity-90">{s(x.heading)}</p>
              <Countdown ends={s(x.ends)} endedText={s(x.endedText)} />
              {s(x.button) && <div className="mt-4"><A href={x.link} className="xs-btn-outline"><span>{s(x.button)}</span></A></div>}
            </div>
          </section>
        );
      }
      case 'floatchat': {
        const wa = s(x.whatsapp).replace(/\D/g, '') || (info.phone ?? '').replace(/\D/g, '');
        const num = wa.startsWith('0') ? `234${wa.slice(1)}` : wa;
        const tp = /^[a-z0-9]{10,40}$/i.test(s(x.tawkProperty)) ? s(x.tawkProperty) : '';
        const tw = /^[a-z0-9]{3,40}$/i.test(s(x.tawkWidget)) ? s(x.tawkWidget) : '';
        return <FloatChat number={x.showWhatsapp === false ? '' : num} message={s(x.message)} tawk={tp && tw ? `${tp}/${tw}` : ''} preview={preview} />;
      }
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
        const wa = s(x.whatsapp).replace(/\D/g, '') || (info.phone ?? '').replace(/\D/g, '');
        const waNum = wa.startsWith('0') ? `234${wa.slice(1)}` : wa;
        const social: [string, string, IconType][] = ([['Instagram', s(x.instagram), Instagram], ['Facebook', s(x.facebook), Facebook], ['TikTok', s(x.tiktok), Music2], ['YouTube', s(x.youtube), Youtube], ['X', s(x.x), X]] as [string, string, IconType][])
          .filter((p) => safeHref(p[1], info.slug));
        if (waNum && x.whatsapp !== undefined) social.unshift(['WhatsApp', `https://wa.me/${waNum}`, MessageCircle]);
        const pay = s(x.payments).split(/[,\n]+/).map((z) => z.trim()).filter(Boolean).slice(0, 10);
        const support = x.showSupport === true ? pages : [];
        return (
          <footer className="mt-8 border-t py-10 text-sm" style={{ borderColor: 'var(--xs-border)', background: bg, color: col || undefined }}>
            <div className="xs-wrap grid gap-8 sm:grid-cols-3">
              <div><p className="xs-h4 xs-accent">{info.name}</p>{(s(x.text) || info.about) && <p className="xs-muted mt-2 max-w-xs">{s(x.text) || info.about}</p>}</div>
              <div className="space-y-1">
                {x.showPages !== false && pages.map((p) => <p key={p.handle}><Link href={`/b/${info.slug}/pages/${p.handle}`} className="hover:underline">{p.title}</Link></p>)}
                {x.showPolicies !== false && policies.map((p) => <p key={p.href}><Link href={p.href} className="hover:underline">{p.label}</Link></p>)}
                {support.length === 0 && null}
              </div>
              <div className="space-y-1">
                {x.showStorefronts !== false && storefronts.map((st, i) => <p key={i}><span className="font-semibold">{st.name}</span><br /><span className="xs-muted">{st.address}</span></p>)}
                {info.phone && <p className="xs-muted">{info.phone}</p>}
              </div>
            </div>
            {social.length > 0 && (
              <div className="xs-wrap mt-10">
                <p className="mb-3 font-medium">Follow us</p>
                <div className="flex flex-wrap items-center gap-3">
                  {social.map(([name, href, Ic]) => (
                    <a key={name} href={linkFor(href, ctx).href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} className="flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-80" style={{ background: 'var(--xs-text)', color: 'var(--xs-bg)' }}><Ic className="h-5 w-5" strokeWidth={sw} /></a>
                  ))}
                </div>
              </div>
            )}
            {pay.length > 0 && (
              <div className="xs-wrap mt-8">
                <p className="mb-3 font-medium">Payment methods</p>
                <div className="flex flex-wrap gap-2">{pay.map((p) => <span key={p} className="rounded-md border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--xs-border)', background: 'var(--xs-card)' }}>{p}</span>)}</div>
              </div>
            )}
            <p className="xs-wrap xs-muted mt-8 text-xs">© {new Date().getFullYear()} {info.name}. Powered by Xenon.</p>
          </footer>
        );
      }
    }
  };

  const secs = theme.sections.filter((sec) => sec.visible);
  const headerLinks = arr<{ label: string; href: string }>(hdr?.s.links);
  const results = q.trim() ? products.filter((p) => `${p.name} ${p.category ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12) : [];
  const closeSearch = () => { setSearchOpen(false); };
  const floatSec = theme.sections.find((z) => z.type === 'floatchat' && z.visible);
  return (
    <div className="xs-store">
      <style dangerouslySetInnerHTML={{ __html: themeCss(theme.settings) }} />
      {/* menu drawer */}
      <div onClick={() => setMenuOpen(false)} className={`fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />
      <aside aria-hidden={!menuOpen} className={`fixed left-0 top-0 z-[70] h-full w-[85%] max-w-sm shadow-xl transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ background: 'var(--xs-bg)', color: 'var(--xs-text)' }}>
        <div className="flex items-center justify-between border-b px-6 py-5" style={{ borderColor: 'var(--xs-border)' }}>
          <span className="xs-h4 xs-accent">{info.name}</span>
          <button onClick={() => setMenuOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="px-6 pt-2 text-sm font-medium uppercase tracking-[0.15em]">
          <Link href={`/b/${info.slug}`} onClick={() => setMenuOpen(false)} className="block border-b py-4" style={{ borderColor: 'var(--xs-border)' }}>Home</Link>
          {headerLinks.map((l, i) => { const k = linkFor(s(l.href), ctx); return <a key={i} href={k.href} onClick={() => setMenuOpen(false)} className="block border-b py-4" style={{ borderColor: 'var(--xs-border)' }}>{s(l.label)}</a>; })}
          {pages.length > 0 && (
            <>
              <button onClick={() => setSupportOpen((v) => !v)} aria-expanded={supportOpen} className="flex w-full items-center justify-between border-b py-4 uppercase tracking-[0.15em]" style={{ borderColor: 'var(--xs-border)' }}>Customer support<ChevronDown className={`h-4 w-4 transition ${supportOpen ? 'rotate-180' : ''}`} /></button>
              {supportOpen && <div className="py-2 pl-3 normal-case tracking-normal">{pages.map((p) => <Link key={p.handle} href={`/b/${info.slug}/pages/${p.handle}`} onClick={() => setMenuOpen(false)} className="xs-muted block py-3">{p.title}</Link>)}</div>}
            </>
          )}
        </nav>
      </aside>
      {/* search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 z-[80] overflow-y-auto" style={{ background: 'var(--xs-bg)', color: 'var(--xs-text)' }} role="dialog" aria-label="Search">
          <div className="sticky top-0 flex items-center gap-4 border-b px-6 py-4" style={{ background: 'var(--xs-bg)', borderColor: 'var(--xs-border)' }}>
            <Search className="h-5 w-5 shrink-0" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); window.dispatchEvent(new CustomEvent('xenon:search', { detail: e.target.value })); }} placeholder="Search products" className="!border-0 flex-1 !bg-transparent text-base outline-none" />
            <button onClick={() => { closeSearch(); }} aria-label="Close search"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto max-w-2xl px-6 py-6">
            {!q.trim() ? <p className="xs-muted py-10 text-center text-xs uppercase tracking-widest">Type to search our products</p>
              : results.length === 0 ? <p className="xs-muted py-10 text-center text-sm">No products found for &ldquo;{q}&rdquo;.</p>
              : <ul className="divide-y" style={{ borderColor: 'var(--xs-border)' }}>{results.map((p) => (
                <li key={p.id}>
                  <a href="#products" onClick={() => { window.dispatchEvent(new CustomEvent('xenon:search', { detail: p.name })); setQ(p.name); closeSearch(); }} className="flex items-center gap-4 py-4">
                    <span className="h-20 w-16 shrink-0 overflow-hidden" style={{ background: 'var(--xs-border)' }}>{p.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt="" className="h-full w-full object-cover object-top" />}</span>
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="text-sm font-medium">₦{Number(p.price).toLocaleString()}</span>
                  </a>
                </li>))}</ul>}
          </div>
        </div>
      )}
      {mode === 'home'
        ? secs.map((sec) => { const n = render(sec); return n ? wrap(sec, n) : null; })
        : (
          <>
            {theme.sections.filter((x) => x.visible && (x.type === 'announcement' || x.type === 'header')).map((sec) => { const n = render(sec); return n ? <div key={sec.id}>{n}</div> : null; })}
            <main className="xs-wrap max-w-3xl py-12">{children}</main>
            {theme.sections.filter((x) => x.type === 'footer').map((sec) => <div key={sec.id}>{render(sec)}</div>)}
            {floatSec && render(floatSec)}
          </>
        )}
    </div>
  );
}
