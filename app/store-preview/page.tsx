'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Storefront, { type PageLink } from '@/components/store/Storefront';
import { readTheme, sampleProducts, type ThemeData } from '@/lib/store/theme';
import type { SiteProduct } from '@/components/SiteProducts';

// Shown inside the theme editor. The editor sends the theme being edited; nothing is saved from here.
export default function StorePreview() {
  const supabase = useMemo(() => createClient(), []);
  const [theme, setTheme] = useState<ThemeData | null>(null);
  const [info, setInfo] = useState<{ name: string; slug: string; phone?: string; about?: string } | null>(null);
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [pages, setPages] = useState<PageLink[]>([]);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: b } = await supabase.from('businesses').select('id, name, slug, phone, about').eq('owner_id', auth.user.id).maybeSingle();
      if (!b) return;
      setInfo({ name: b.name, slug: b.slug, phone: b.phone ?? undefined, about: b.about ?? '' });
      const [{ data: pr }, { data: pg }] = await Promise.all([
        supabase.from('products').select('id, name, description, price, category, photo_url, stock, taxable').eq('business_id', b.id).eq('available', true).order('created_at').limit(12),
        supabase.from('store_pages').select('title, handle').eq('business_id', b.id).eq('visible', true),
      ]);
      setProducts(pr && pr.length > 0 ? (pr as SiteProduct[]) : sampleProducts);
      setPages((pg ?? []) as PageLink[]);
    })();
  }, [supabase]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { xenon?: string; theme?: ThemeData; focus?: string };
      if (d?.xenon === 'theme' && d.theme) setTheme(readTheme({ settings: d.theme.settings, sections: d.theme.sections }));
      if (d?.xenon === 'focus' && d.focus) document.querySelector(`[data-sid="${CSS.escape(d.focus)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ xenon: 'ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!theme || !info) return <div className="p-6"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>;
  return <Storefront theme={theme} info={info} products={products} pages={pages} preview />;
}
