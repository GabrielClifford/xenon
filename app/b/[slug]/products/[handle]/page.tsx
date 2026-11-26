import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/components/store/Storefront';
import ProductDetail from '@/components/store/ProductDetail';
import PasswordGate from '@/components/store/PasswordGate';
import ConsentGate from '@/components/ConsentGate';
import { Skeleton } from '@/components/Skeleton';
import { loadStore } from '@/lib/store/load';
import { cookieName, tokenOk } from '@/lib/store/access';
import { collectionHref } from '@/lib/store/collections';
import type { SiteProduct } from '@/components/SiteProducts';

type P = { params: Promise<{ slug: string; handle: string }> };

function find(products: SiteProduct[], handle: string) {
  const h = decodeURIComponent(handle);
  return products.find((p) => p.handle === h) ?? products.find((p) => p.id === h) ?? null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, handle } = await params;
  const d = await loadStore(slug, true);
  const p = d && find(d.products, handle);
  if (!d || !p) return {};
  return {
    title: `${p.name} - ${d.b.name}`,
    description: (p.description ?? '').slice(0, 160) || undefined,
    robots: d.prefs.noindex || d.prefs.private ? { index: false, follow: false } : undefined,
    openGraph: { title: p.name, images: p.photo_url ? [p.photo_url] : undefined },
  };
}

async function View({ params }: P) {
  const { slug, handle } = await params;
  const d = await loadStore(slug, true);
  if (!d) notFound();
  if (d.prefs.private) {
    const token = (await cookies()).get(cookieName(slug))?.value;
    if (!(await tokenOk(slug, token))) return <PasswordGate slug={slug} name={d.info.name} />;
  }
  const p = find(d.products, handle);
  if (!p) notFound();
  const mine = d.collections.filter((c) => c.ids.includes(p.id));
  const relatedIds = Array.from(new Set(mine.flatMap((c) => c.ids))).filter((id) => id !== p.id);
  const byId = new Map(d.products.map((x) => [x.id, x]));
  const pool = relatedIds.length > 0 ? relatedIds.map((id) => byId.get(id)) : d.products.filter((x) => x.id !== p.id);
  const related = pool.filter((x): x is SiteProduct => !!x).slice(0, 8);
  return (
    <>
      <Storefront theme={d.theme} info={d.info} products={d.products} collections={d.collections} shop={d.shop} pages={d.pages} policies={d.policies} storefronts={d.storefronts} trusted={d.prefs.trusted} template="product">
        <ProductDetail p={p} slug={slug} canOrder={d.shop.checkout.accepting} collections={mine.map((c) => ({ title: c.title, href: collectionHref(slug, c) }))} related={related} />
      </Storefront>
      <ConsentGate businessId={d.b.id} privacy={d.privacy} privacyHref={d.privacyHref} />
    </>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-5 py-10"><div className="grid gap-8 md:grid-cols-2"><Skeleton className="aspect-[3/4] w-full" /><div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-6 w-32" /><Skeleton className="h-12 w-full" /></div></div></div>}>
      <View params={props.params} />
    </Suspense>
  );
}
