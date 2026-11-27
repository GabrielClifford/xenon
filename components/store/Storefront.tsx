'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Truck, ShieldCheck, Phone, CreditCard, Gift, Clock, Heart, Star, Search, ShoppingBag, ChevronDown, MessageCircle, Menu, X, User, Music2, ArrowRight, Sparkles, Leaf, Ruler, RefreshCw, Award, Package, Layers, Sun } from 'lucide-react';
import { Instagram, Facebook, Youtube } from '@/components/store/SocialIcons';
import SiteProducts, { type Shop, type SiteProduct } from '@/components/SiteProducts';
import FloatChat from '@/components/store/FloatChat';
import Countdown from '@/components/store/Countdown';
import { CollectionRow, CollectionTabs, CollectionTiles, FeaturedProduct, Gallery, NewsletterForm, MultiColumn, PeopleRail, Slideshow, Ticker, VideoBlock, type Col, type Person, type Slide, type Tab, type Tile } from '@/components/store/Blocks';
import type { PageId } from '@/lib/store/theme';
import { allCollection, collectionHref, productHref, type StoreCollection } from '@/lib/store/collections';
import { fontsHref, safeColor, safeHref, strokeWidth, themeCss, type Section, type ThemeData } from '@/lib/store/theme';
import { parseVideo } from '@/lib/store/video';
import { Markdown, linkFor, type LinkCtx } from '@/lib/store/markdown';

export type StoreInfo = { name: string; slug: string; phone?: string; about?: string; photoUrl?: string };
type IconType = React.ComponentType<{ className?: string; strokeWidth?: number }>;
export type PageLink = { title: string; handle: string };

const ICONS = { truck: Truck, shield: ShieldCheck, phone: Phone, card: CreditCard, gift: Gift, clock: Clock, heart: Heart, star: Star, sparkles: Sparkles, leaf: Leaf, ruler: Ruler, refresh: RefreshCw, award: Award, package: Package, layers: Layers, sun: Sun } as const;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
// blocks the owner hid in the editor are left out
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]).filter((it) => !(it && typeof it === 'object' && (it as Record<string, unknown>)._hide === '1') ) : []);

export default function Storefront({
  theme, info, products, shop, pages = [], policies = [], storefronts = [], trusted = [], preview = false, mode = 'home', template, collections = [], wide = false, editor = false, engine = true, children,
}: {
  template?: PageId | 'checkout'; collections?: StoreCollection[]; wide?: boolean; editor?: boolean; engine?: boolean;
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
  const [shopOpen, setShopOpen] = useState(false);
  const allCol = allCollection(products);
  const colList = collections.filter((c) => c.ids.length > 0);
  const byId = new Map(products.map((p) => [p.id, p]));
  const resolveCol = (id: string): StoreCollection | null => (id === 'all' ? allCol : collections.find((c) => c.id === id) ?? null);
  const prodsOf = (c: StoreCollection, limit: number) => c.ids.map((id) => byId.get(id)).filter((p): p is SiteProduct => !!p).slice(0, Math.max(1, limit || 8));
  const hrefOf = (c: StoreCollection) => collectionHref(info.slug, c);
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

  // the style settings every section has: padding, colors, width, hide on mobile or desktop
  const styled = (sec: Section, node: React.ReactNode) => {
    const x = sec.s;
    if (sec.type === 'header' || sec.type === 'floatchat') return node;
    const st: React.CSSProperties = {};
    if (s(x._pt)) st.paddingTop = Number(x._pt);
    if (s(x._pb)) st.paddingBottom = Number(x._pb);
    // a color scheme from Theme settings re-colors everything inside the section
    const sc = x._scheme ? theme.settings.schemes[Number(x._scheme) - 1] : undefined;
    if (sc) Object.assign(st, { '--xs-bg': sc.background, '--xs-card': sc.background, '--xs-text': sc.text, '--xs-muted': `color-mix(in srgb, ${sc.text} 60%, ${sc.background})`, '--xs-primary': sc.primary, '--xs-primary-text': sc.primaryText, '--xs-border': sc.border, background: sc.background, color: sc.text });
    const bg = safeColor(x._bg, ''); const col = safeColor(x._color, '');
    if (bg) st.background = bg;
    if (col) st.color = col;
    const cls = [x._width === 'narrow' ? 'xs-secnarrow' : x._width === 'full' ? 'xs-secfull' : '', x._hm === true ? 'xs-hm' : '', x._hd === true ? 'xs-hd' : ''].filter(Boolean).join(' ');
    if (!cls && Object.keys(st).length === 0) return node;
    return <div className={cls || undefined} style={st}>{node}</div>;
  };

  const wrap = (sec: Section, node: React.ReactNode) => (
    <div key={sec.id} data-sid={sec.id} onClickCapture={preview ? (e) => { e.preventDefault(); e.stopPropagation(); window.parent.postMessage({ xenon: 'select', id: sec.id }, window.location.origin); } : undefined} className={preview ? 'cursor-pointer hover:outline hover:outline-2 hover:outline-blue-500' : 'contents'}>
      {styled(sec, node)}
    </div>
  );

  const render = (sec: Section) => {
    const x = sec.s;
    switch (sec.type) {
      case 'announcement': {
        if (!s(x.text)) return null;
        const bg = safeColor(x.bg, 'var(--xs-primary)'); const col = safeColor(x.color, 'var(--xs-primary-text)');
        const inner = <div className="xs-wrap py-2 text-center text-sm font-medium">{s(x.text)}{s(x.ends) && <Countdown compact lead ends={s(x.ends)} />}</div>;
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
              {s(x.ends) && <Countdown boxes label={s(x.endsLabel)} ends={s(x.ends)} />}
              {s(x.button) && <div className="mt-6"><A href={x.link} className={x.outline === true ? 'xs-btn-outline' : 'xs-btn'}><span>{s(x.button)}</span>{x.outline === true && <ArrowRight className="h-4 w-4" />}</A></div>}
            </div>
          </section>
        );
      }
      case 'products':
        return <SiteProducts products={products} shop={shop} heading={s(x.heading) || 'Products'} cartPool={products} hideTrack={x.showTrack === false} themed layout={x.layout === 'rows' ? 'rows' : 'grid'} portrait={x.portrait === true} hideCartPill={cartInHeader} checkoutHref={checkoutHref} cartHref={cartHref} />;
      case 'multicolumn': {
        const cols: Col[] = arr<Record<string, string>>(x.cols).map((c) => {
          const l = link(c.link);
          return { image: safeHref(c.image, info.slug), heading: s(c.heading), text: s(c.text), button: s(c.button), href: c.link ? l.href : '', external: !!l.external };
        }).filter((c) => c.image || c.heading || c.text);
        if (cols.length === 0) return null;
        const per = x.perRow === '2' ? 2 : x.perRow === '4' ? 4 : 3;
        return <MultiColumn heading={s(x.heading)} cols={cols} perRow={per} shape={['portrait', 'square', 'landscape', 'round'].includes(s(x.shape)) ? s(x.shape) : 'portrait'} align={x.align === 'left' ? 'left' : 'center'} button={s(x.button)} />;
      }
      case 'featured': {
        const p = products.find((z) => z.id === s(x.product));
        if (!p) return null;
        return <FeaturedProduct p={p} slug={info.slug} heading={s(x.heading)} button={s(x.button)} showDesc={x.showDesc !== false} imageRight={x.imageRight === true} />;
      }
      case 'video': {
        const v = parseVideo(x.url);
        if (!v) return null;
        return <VideoBlock heading={s(x.heading)} video={v} title={s(x.title)} ratio={['16:9', '4:3', '1:1', '9:16'].includes(s(x.ratio)) ? s(x.ratio) : '16:9'} poster={safeHref(x.poster, info.slug)} narrow={x.narrow === true} />;
      }
      case 'slideshow': {
        const slides: Slide[] = arr<Record<string, string>>(x.slides).map((sl) => {
          const l = link(sl.link);
          return { image: safeHref(sl.image, info.slug), eyebrow: s(sl.eyebrow), heading: s(sl.heading), sub: s(sl.sub), button: s(sl.button), href: l.href, external: !!l.external };
        }).filter((sl) => sl.image || sl.heading);
        if (slides.length === 0) return null;
        return <Slideshow slides={slides} height={{ small: 280, medium: 420, large: 580 }[s(x.height) as 'small'] ?? 420} autoplay={x.autoplay !== false} seconds={Math.min(12, Number(x.seconds) || 5)} arrows={x.arrows !== false} dots={x.dots !== false} align={x.align === 'left' ? 'left' : 'center'} overlay={Math.max(0, Math.min(80, Number(x.overlay ?? 35)))} textColor={safeColor(x.textColor, '#ffffff')} bg={safeColor(x.bg, '')} outline={x.outline === true} />;
      }
      case 'custom': {
        const blocks = arr<Record<string, string>>(x.blocks).filter((b) => (['divider', 'spacer'].includes(b.type) ? true : b.type === 'image' ? !!safeHref(b.image, info.slug) : b.type === 'button' ? !!s(b.label) : !!s(b.text)));
        if (blocks.filter((b) => !['divider', 'spacer'].includes(b.type)).length === 0) return null;
        const al = x.align === 'left' ? 'left' : x.align === 'right' ? 'right' : 'center';
        const cols = x.columns === '3' ? 3 : x.columns === '2' ? 2 : 1;
        const just = al === 'left' ? 'flex-start' : al === 'right' ? 'flex-end' : 'center';
        const cell = (b: Record<string, string>, i: number) => {
          switch (b.type) {
            case 'heading': return <h2 key={i} className={b.size === 'small' ? 'xs-h4' : 'xs-h2'} style={b.size === 'large' ? { fontSize: 'clamp(2rem, 5vw, 3.25rem)', lineHeight: 1.1 } : undefined}>{s(b.text)}</h2>;
            case 'text': return <div key={i} className="max-w-2xl" style={{ marginLeft: al === 'center' ? 'auto' : al === 'right' ? 'auto' : 0, marginRight: al === 'center' ? 'auto' : 0 }}><Markdown text={s(b.text)} ctx={ctx} /></div>;
            case 'button': return <div key={i}><A href={b.link} className={b.style === 'outline' ? 'xs-btn-secondary' : 'xs-btn'}>{s(b.label)}</A></div>;
            case 'image': {
              const src = safeHref(b.image, info.slug);
              // eslint-disable-next-line @next/next/no-img-element
              const im = <img src={src} alt={s(b.alt)} className="h-auto max-w-full" style={{ width: b.width === 'full' ? '100%' : b.width === 'small' ? 240 : 480, borderRadius: theme.settings.cards.radius }} />;
              return <div key={i} style={{ width: b.width === 'full' ? '100%' : undefined }}>{b.link ? <A href={b.link}>{im}</A> : im}</div>;
            }
            case 'divider': return <hr key={i} className="w-full border-0 border-t" style={{ borderColor: 'var(--xs-border)' }} />;
            default: return <div key={i} aria-hidden style={{ height: Math.max(0, Math.min(200, Number(b.height) || 0)), width: '100%' }} />;
          }
        };
        return (
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)]" style={{ textAlign: al }}>
            {cols === 1
              ? <div className="flex flex-col gap-5" style={{ alignItems: just }}>{blocks.map(cell)}</div>
              : <div className={`grid gap-8 ${cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{blocks.map((b, i) => <div key={i} className="flex flex-col gap-4" style={{ alignItems: just }}>{cell(b, i)}</div>)}</div>}
          </section>
        );
      }
      case 'richtext':
        return (
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)]" style={{ textAlign: x.align === 'left' ? 'left' : 'center' }}>
            {s(x.heading) && <h2 className="xs-h2">{s(x.heading)}</h2>}
            <div className={`mt-4 max-w-2xl ${x.align === 'left' ? '' : 'mx-auto'}`}><Markdown text={s(x.text)} ctx={ctx} /></div>
            {s(x.button) && <div className="mt-6"><A href={x.link} className="xs-btn">{s(x.button)}</A></div>}
          </section>
        );
      case 'imagetext': {
        const img = safeHref(x.image, info.slug);
        return (
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)]">
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
            <section className="overflow-hidden py-[var(--xs-sec-y,3rem)]" aria-label="Customer reviews">
              <style dangerouslySetInnerHTML={{ __html: '@keyframes xs-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}.xs-track{display:flex;width:max-content;animation:xs-scroll 70s linear infinite}.xs-track:hover{animation-play-state:paused}@media(prefers-reduced-motion:reduce){.xs-track{animation:none}}' }} />
              {head}
              <div className="xs-track mt-8">
                {[0, 1].map((c) => <div key={c} className="flex shrink-0" aria-hidden={c === 1}>{list.map((it, i) => <div key={i} className="mx-2 w-[280px] shrink-0">{card(it, i, 'h-full')}</div>)}</div>)}
              </div>
            </section>
          );
        }
        return (
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)]">
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
          <section className="xs-wrap max-w-3xl py-[var(--xs-sec-y,3rem)]">
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
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)] text-center">
            <h2 className="xs-h2">{s(x.heading)}</h2>
            <p className="xs-muted mx-auto mt-2 max-w-xl">{s(x.text)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {waNum && <a className="xs-btn" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Hello ${info.name}, I want to place an order.`)}`}><MessageCircle className="h-4 w-4" />{s(x.button) || 'Chat on WhatsApp'}</a>}
              {phone && <a className="xs-btn-secondary" href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone className="h-4 w-4" />Call us</a>}
            </div>
          </section>
        );
      }
      case 'main': return null;
      case 'ticker': {
        const list = arr<{ text: string; link: string }>(x.items).filter((it) => s(it.text)).map((it) => ({ text: s(it.text), href: s(it.link) ? link(it.link).href : '' }));
        return <Ticker items={list} seconds={Math.min(12, Number(x.seconds) || 5)} bg={safeColor(x.bg, '')} color={safeColor(x.color, '')} />;
      }
      case 'collection': {
        const c = s(x.collection) ? resolveCol(s(x.collection)) : null;
        if (!c) return null;
        return <CollectionRow products={prodsOf(c, Number(x.limit))} slug={info.slug} heading={s(x.heading) || c.title} button={s(x.button)} href={hrefOf(c)} portrait={x.portrait !== false} />;
      }
      case 'collectiontabs': {
        const raw = arr<{ collection: string; label: string }>(x.tabs).map((t) => ({ c: resolveCol(s(t.collection)), label: s(t.label) })).filter((t) => t.c);
        const tabs: Tab[] = raw.map((t) => ({ label: t.label || t.c!.title, href: hrefOf(t.c!), products: prodsOf(t.c!, Number(x.limit)) }));
        return <CollectionTabs tabs={tabs} slug={info.slug} heading={s(x.heading)} button={s(x.button)} portrait={x.portrait !== false} />;
      }
      case 'collectionlist': {
        const raw = arr<{ collection: string; title: string; image: string; button: string }>(x.items).map((t) => ({ c: resolveCol(s(t.collection)), t })).filter((t) => t.c);
        const tiles: Tile[] = raw.map(({ c, t }) => ({ title: s(t.title) || c!.title, image: safeHref(t.image, info.slug) || c!.image, href: hrefOf(c!), button: s(t.button) }));
        return <CollectionTiles tiles={tiles} heading={s(x.heading)} columns={Number(x.columns) || 4} />;
      }
      case 'infotiles': {
        const list = arr<{ icon: string; title: string; text: string }>(x.items);
        if (list.length === 0) return null;
        return (
          <section className="xs-wrap py-[var(--xs-sec-y,3rem)]">
            <div className="mx-auto mb-8 max-w-2xl text-center"><h2 className="xs-h2">{s(x.heading)}</h2>{s(x.text) && <p className="xs-muted mt-3">{s(x.text)}</p>}</div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {list.map((it, i) => {
                const Ic = ICONS[it.icon as keyof typeof ICONS] ?? Star;
                return (
                  <div key={i} className="flex flex-col items-center px-4 py-8 text-center" style={{ background: 'color-mix(in srgb, var(--xs-border) 45%, transparent)' }}>
                    <Ic className="h-8 w-8" strokeWidth={sw} />
                    <p className="xs-sub mt-4 text-sm font-bold uppercase tracking-wider">{s(it.title)}</p>
                    <p className="xs-muted mt-2 text-sm">{s(it.text)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      }
      case 'people': {
        const list: Person[] = arr<{ image: string; name: string; tag: string; role: string; verified: string; link: string }>(x.items).filter((it) => s(it.name)).map((it) => ({ image: safeHref(it.image, info.slug), name: s(it.name), tag: s(it.tag), role: s(it.role), verified: s(it.verified) !== 'no', href: s(it.link) ? link(it.link).href : '' }));
        return <PeopleRail items={list} heading={s(x.heading)} subtitle={s(x.subtitle)} />;
      }
      case 'gallery': {
        const list = arr<{ image: string; link: string }>(x.items).map((it) => ({ image: safeHref(it.image, info.slug), href: s(it.link) ? link(it.link).href : '' })).filter((it) => it.image);
        return <Gallery items={list} heading={s(x.heading)} handleText={s(x.handle)} link={s(x.link) ? link(x.link).href : ''} />;
      }
      case 'newsletter': {
        const bg = safeColor(x.bg, 'var(--xs-card)'); const col = safeColor(x.color, '');
        return (
          <section className="py-[var(--xs-sec-y,3rem)] text-center" style={{ background: bg, color: col || undefined }}>
            <div className="xs-wrap mx-auto max-w-xl">
              <h2 className="xs-h2">{s(x.heading)}</h2>
              {s(x.text) && <p className="mt-3 opacity-80">{s(x.text)}</p>}
              <div className="mt-6 text-left"><NewsletterForm slug={info.slug} button={s(x.button)} success={s(x.success)} preview={preview} /></div>
            </div>
          </section>
        );
      }
      case 'footer': {
        const bg = safeColor(x.bg, 'transparent'); const col = safeColor(x.color, '');
        const wa = s(x.whatsapp).replace(/\D/g, '');
        const waNum = wa.startsWith('0') ? `234${wa.slice(1)}` : wa;
        const social: [string, string, IconType][] = ([['Instagram', s(x.instagram), Instagram], ['Facebook', s(x.facebook), Facebook], ['TikTok', s(x.tiktok), Music2], ['YouTube', s(x.youtube), Youtube], ['X', s(x.x), X]] as [string, string, IconType][])
          .filter((p) => safeHref(p[1], info.slug));
        if (waNum) social.unshift(['WhatsApp', `https://wa.me/${waNum}`, MessageCircle]);
        const pay = s(x.payments).split(/[,\n]+/).map((z) => z.trim()).filter(Boolean).slice(0, 10);
        const support = x.showSupport === true ? pages : [];
        if (x.layout === 'columns') {
          const head = 'xs-sub mb-4 text-xs font-bold uppercase tracking-[0.2em]';
          const socialRow = social.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {social.map(([name, href, Ic]) => (
                <a key={name} href={linkFor(href, ctx).href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name} className="flex h-10 w-10 items-center justify-center rounded-full border border-current transition hover:opacity-70"><Ic className="h-4 w-4" strokeWidth={sw} /></a>
              ))}
            </div>
          );
          return (
            <footer className="mt-8 py-12 text-sm" style={{ background: bg, color: col || undefined, borderTop: '1px solid var(--xs-border)' }}>
              <div className="xs-wrap grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className={head}>{s(x.aboutHeading) || 'About'}</p>{s(x.text) && <p className="max-w-xs leading-relaxed opacity-80">{s(x.text)}</p>}{socialRow}</div>
                <div><p className={head}>{s(x.shopHeading) || 'Shop'}</p>
                  <ul className="space-y-2 opacity-90">
                    <li><Link href={hrefOf(allCol)} className="hover:underline">Shop all</Link></li>
                    {colList.slice(0, 8).map((c) => <li key={c.id}><Link href={hrefOf(c)} className="hover:underline">{c.title}</Link></li>)}
                  </ul></div>
                <div><p className={head}>{s(x.supportHeading) || 'Customer support'}</p>
                  <ul className="space-y-2 opacity-90">
                    {x.showPages !== false && pages.map((p) => <li key={p.handle}><Link href={`/b/${info.slug}/pages/${p.handle}`} className="hover:underline">{p.title}</Link></li>)}
                    {x.showPolicies !== false && policies.map((p) => <li key={p.href}><Link href={p.href} className="hover:underline">{p.label}</Link></li>)}
                  </ul>
                  {x.showStorefronts !== false && storefronts.map((st, i) => <p key={i} className="mt-3 opacity-80"><span className="font-semibold">{st.name}</span><br />{st.address}</p>)}
                </div>
                <div>
                  {x.newsletter === true ? (
                    <><p className={head}>{s(x.newsHeading) || 'Join the community'}</p>{s(x.newsText) && <p className="mb-4 opacity-80">{s(x.newsText)}</p>}<NewsletterForm slug={info.slug} button="" success="Thank you for subscribing!" preview={preview} dark /></>
                  ) : (
                    <><p className={head}>Contact</p>{s(x.phone) && <p className="opacity-80">{s(x.phone)}</p>}</>
                  )}
                </div>
              </div>
              {pay.length > 0 && (
                <div className="xs-wrap mt-10 flex flex-wrap items-center gap-2 border-t pt-6" style={{ borderColor: 'color-mix(in srgb, currentColor 20%, transparent)' }}>
                  {pay.map((p) => <span key={p} className="rounded border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: 'color-mix(in srgb, currentColor 30%, transparent)' }}>{p}</span>)}
                </div>
              )}
              <p className="xs-wrap mt-6 text-xs opacity-60">© {new Date().getFullYear()} {info.name}. Powered by Xenon.</p>
            </footer>
          );
        }
        return (
          <footer className="mt-8 border-t py-10 text-sm" style={{ borderColor: 'var(--xs-border)', background: bg, color: col || undefined }}>
            <div className="xs-wrap grid gap-8 sm:grid-cols-3">
              <div><p className="xs-h4 xs-accent">{info.name}</p>{s(x.text) && <p className="xs-muted mt-2 max-w-xs">{s(x.text)}</p>}</div>
              <div className="space-y-1">
                {x.showPages !== false && pages.map((p) => <p key={p.handle}><Link href={`/b/${info.slug}/pages/${p.handle}`} className="hover:underline">{p.title}</Link></p>)}
                {x.showPolicies !== false && policies.map((p) => <p key={p.href}><Link href={p.href} className="hover:underline">{p.label}</Link></p>)}
                {support.length === 0 && null}
              </div>
              <div className="space-y-1">
                {x.showStorefronts !== false && storefronts.map((st, i) => <p key={i}><span className="font-semibold">{st.name}</span><br /><span className="xs-muted">{st.address}</span></p>)}
                {s(x.phone) && <p className="xs-muted">{s(x.phone)}</p>}
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

  // the cart's Checkout button opens the checkout page (not inside the editor, which stays on its own page)
  const checkoutHref = editor ? undefined : `/b/${info.slug}/checkout`;
  // Theme settings > Cart: "Page" sends the cart button to the cart page instead of opening the drawer
  const cartHref = !editor && theme.settings.cart.type === 'page' ? `/b/${info.slug}/cart` : undefined;
  const tpl = (template ?? (mode === 'home' ? 'home' : 'page')) as PageId; // 'checkout' has no sections of its own, only the header and footer
  // header group + this page + footer group; the chat button follows the customer on every page
  const tplSecs = theme.sections.filter((sec) => sec.visible && (sec.page === 'header' || sec.page === 'footer' || sec.page === tpl || sec.type === 'floatchat'));
  const headerLinks = arr<{ label: string; href: string }>(hdr?.s.links);
  const results = q.trim() ? products.filter((p) => `${p.name} ${p.category ?? ''} ${p.product_type ?? ''} ${p.vendor ?? ''} ${(p.tags ?? []).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12) : [];
  const closeSearch = () => { setSearchOpen(false); };
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
          <Link href={hrefOf(allCol)} onClick={() => setMenuOpen(false)} className="block border-b py-4" style={{ borderColor: 'var(--xs-border)' }}>Shop all</Link>
          {colList.length > 0 && (
            <>
              <button onClick={() => setShopOpen((v) => !v)} aria-expanded={shopOpen} className="flex w-full items-center justify-between border-b py-4 uppercase tracking-[0.15em]" style={{ borderColor: 'var(--xs-border)' }}>Collections<ChevronDown className={`h-4 w-4 transition ${shopOpen ? 'rotate-180' : ''}`} /></button>
              {shopOpen && <div className="py-2 pl-3 normal-case tracking-normal">{colList.map((c) => <Link key={c.id} href={hrefOf(c)} onClick={() => setMenuOpen(false)} className="xs-muted block py-3">{c.title}</Link>)}</div>}
            </>
          )}
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
                  <Link href={productHref(info.slug, p)} onClick={() => { closeSearch(); }} className="flex items-center gap-4 py-4">
                    <span className="h-20 w-16 shrink-0 overflow-hidden" style={{ background: 'var(--xs-border)' }}>{p.photo_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt="" className="h-full w-full object-cover object-top" />}</span>
                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                    <span className="text-sm font-medium">₦{Number(p.price).toLocaleString()}</span>
                  </Link>
                </li>))}</ul>}
          </div>
        </div>
      )}
      {tplSecs.map((sec) => {
        if (sec.type === 'main') {
          return wrap(sec, <main className={`xs-wrap py-12 ${tpl === 'page' && !wide ? 'max-w-3xl' : ''}`}>{children}</main>);
        }
        const n = render(sec);
        if (n) return wrap(sec, n);
        return preview && !['announcement', 'floatchat'].includes(sec.type) ? wrap(sec, <div className="xs-wrap my-4 border border-dashed py-6 text-center text-xs uppercase tracking-widest opacity-60" style={{ borderColor: 'var(--xs-muted)' }}>Empty section: fill it in on the left (it is hidden on your live store)</div>) : null;
      })}
      {tpl !== 'home' && !tplSecs.some((z) => z.type === 'main') && <main className={`xs-wrap py-12 ${tpl === 'page' && !wide ? 'max-w-3xl' : ''}`}>{children}</main>}
      {/* the cart and checkout live here when the page has no products section (collection, product and info pages) */}
      {engine && !(tpl === 'home' && tplSecs.some((z) => z.type === 'products')) && <SiteProducts products={[]} cartPool={products} shop={shop} hideGrid hideCartPill={cartInHeader} checkoutHref={checkoutHref} cartHref={cartHref} />}
    </div>
  );
}
