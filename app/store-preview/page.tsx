'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Storefront, { type PageLink } from '@/components/store/Storefront';
import { readTheme, sampleProducts, type PageId, type ThemeData } from '@/lib/store/theme';
import CollectionView from '@/components/store/CollectionView';
import ProductDetail from '@/components/store/ProductDetail';
import type { SiteProduct } from '@/components/SiteProducts';
import { allCollection, buildCollections, collectionHref, type StoreCollection } from '@/lib/store/collections';
import CartView from '@/components/store/CartView';
import { buildShop } from '@/lib/store/shop';
import type { Shop } from '@/components/SiteProducts';

// Shown inside the theme editor. The editor sends the theme being edited; nothing is saved from here.
export default function StorePreview() {
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [info, setInfo] = useState<{ name: string; slug: string; phone?: string; about?: string } | null>(null);
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [pages, setPages] = useState<PageLink[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  // which page the preview shows; in Interact mode the store's own links change it
  const [route, setRoute] = useState<{ tpl: PageId; handle: string }>({ tpl: 'home', handle: '' });
  const tpl = route.tpl;
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [interact, setInteract] = useState(false);
  const [note, setNote] = useState('');
  const [hint, setHint] = useState(false); // the test-mode message, shown for a few seconds

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: b } = await supabase.from('businesses').select('*').eq('owner_id', auth.user.id).maybeSingle();
      if (!b) return;
      // test mode: the cart and checkout can be tried, but orders cannot be placed from the editor
      try { const built = buildShop(b).shop; setShop({ ...built, checkout: { ...built.checkout, accepting: false } }); } catch { setShop(undefined); }
      setInfo({ name: b.name, slug: b.slug, phone: b.phone ?? undefined, about: b.about ?? '' });
      const cols = 'id, name, description, price, category, photo_url, stock, taxable, handle, compare_at_price, vendor, product_type, tags, created_at';
      const base = 'id, name, description, price, category, photo_url, stock, taxable';
      const q = (c: string) => supabase.from('products').select(c).eq('business_id', b.id).eq('available', true).order('created_at').limit(60);
      const [full, { data: pg }, { data: colRows }, { data: mem }] = await Promise.all([
        q(cols),
        supabase.from('store_pages').select('title, handle').eq('business_id', b.id).eq('visible', true),
        supabase.from('collections').select('*').eq('business_id', b.id),
        supabase.from('collection_products').select('collection_id, product_id, position').eq('business_id', b.id),
      ]);
      const pr = (full.error ? (await q(base)).data : full.data) as unknown as SiteProduct[] | null;
      const list = (pr ?? []).map((p) => ({ ...p, price: Number(p.price), compare_at_price: p.compare_at_price == null ? null : Number(p.compare_at_price), tags: Array.isArray(p.tags) ? p.tags : [] }));
      setProducts(list.length > 0 ? list : sampleProducts);
      setCollections(list.length > 0 && colRows ? buildCollections(colRows as Record<string, unknown>[], (mem ?? []) as { collection_id: string; product_id: string; position?: number | null }[], list) : []);
      setPages((pg ?? []) as PageLink[]);
    })();
  }, [supabase]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { xenon?: string; theme?: ThemeData; focus?: string; template?: PageId; interact?: boolean };
      if (d?.xenon === 'mode') setInteract(d.interact === true);
      if (d?.xenon === 'theme' && d.theme) {
        if (d.template) { const t = ['home', 'collection', 'product', 'cart', 'page'].includes(d.template) ? d.template : 'home'; setRoute((r) => (r.tpl === t ? r : { tpl: t, handle: '' })); }
        setTheme(readTheme({ settings: d.theme.settings, sections: d.theme.sections }));
      }
      if (d?.xenon === 'focus' && d.focus) document.querySelector(`[data-sid="${CSS.escape(d.focus)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ xenon: 'ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // test mode: buttons and the cart work, but links stay inside the editor
  useEffect(() => {
    if (!interact) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    setHint(true);
    const h = setTimeout(() => setHint(false), 4000);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      const href = a?.getAttribute('href') ?? '';
      if (!a || !href || href.startsWith('#') || !info) return;
      e.preventDefault(); e.stopPropagation();
      // links inside this store switch the preview to that page (and the page selector follows)
      const base = `/b/${info.slug}`;
      const path = href.startsWith(base) ? href.slice(base.length).split(/[?#]/)[0].replace(/\/+$/, '') : href === '/' ? '' : null;
      const m = path === null ? null : path.match(/^\/(collections|products|pages)\/([^/]+)$/);
      const next: { tpl: PageId; handle: string } | null = path === '' ? { tpl: 'home', handle: '' }
        : m?.[1] === 'collections' ? { tpl: 'collection', handle: decodeURIComponent(m[2]) }
        : m?.[1] === 'products' ? { tpl: 'product', handle: decodeURIComponent(m[2]) }
        : m?.[1] === 'pages' ? { tpl: 'page', handle: decodeURIComponent(m[2]) }
        : path === '/cart' ? { tpl: 'cart', handle: '' } : null;
      if (next) {
        setRoute(next);
        window.scrollTo({ top: 0 });
        window.parent.postMessage({ xenon: 'page', template: next.tpl }, window.location.origin);
        return;
      }
      setNote('That link goes outside your store, so it is turned off in the editor.');
      clearTimeout(t); t = setTimeout(() => setNote(''), 3000);
    };
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); clearTimeout(t); clearTimeout(h); setNote(''); setHint(false); };
  }, [interact, info]);

  if (!theme || !info) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>;
  const sample = products.slice(0, 8);
  // in Interact mode a link to a real collection or product shows that one; otherwise a sample is shown
  const all = allCollection(products);
  const col = route.handle === 'all' ? all : collections.find((c) => c.handle === route.handle);
  const colProducts = col ? products.filter((p) => col.ids.includes(p.id)) : sample;
  const others = [all, ...collections.filter((x) => x.ids.length > 0)].map((x) => ({ id: x.id, title: x.title, href: collectionHref(info.slug, x) }));
  const prod = products.find((p) => (p.handle || p.id) === route.handle) ?? products[0];
  const main = tpl === 'collection' ? <CollectionView key={col?.id ?? 'sample'} title={col?.title ?? 'Collection name'} products={colProducts} slug={info.slug} others={col ? others : []} current={col?.id ?? ''} />
    : tpl === 'product' && prod ? <ProductDetail key={prod.id} p={prod} slug={info.slug} canOrder collections={[]} related={products.filter((p) => p.id !== prod.id).slice(0, 4)} />
    : tpl === 'cart' && shop ? <CartView products={products} slug={info.slug} businessId={shop.businessId} canOrder={false} minOrder={0} sample />
    : tpl === 'page' ? <article className="prose max-w-none"><h1 className="xs-h2">Page title</h1><p className="mt-4">This is where the text of your pages (About us, Delivery, Contact...) appears.</p></article>
    : null;
  return (
    <>
      <Storefront theme={theme} info={info} products={products} collections={collections} pages={pages} shop={interact ? shop : undefined} template={tpl} preview={!interact} editor>{main}</Storefront>
      {interact && <div className={`pointer-events-none fixed bottom-3 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-opacity duration-500 ${note || hint ? 'opacity-100' : 'opacity-0'}`} role="status" aria-live="polite">{note || 'Test mode: try the cart. Orders cannot be placed here.'}</div>}
    </>
  );
}
