import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/components/store/Storefront';
import CollectionView from '@/components/store/CollectionView';
import PasswordGate from '@/components/store/PasswordGate';
import ConsentGate from '@/components/ConsentGate';
import { Skeleton } from '@/components/Skeleton';
import { loadStore } from '@/lib/store/load';
import { cookieName, tokenOk } from '@/lib/store/access';
import { collectionHref } from '@/lib/store/collections';
import type { SiteProduct } from '@/components/SiteProducts';

type P = { params: Promise<{ slug: string; handle: string }> };

function pick(d: NonNullable<Awaited<ReturnType<typeof loadStore>>>, handle: string) {
  return handle === 'all' ? d.allCollection : d.collections.find((c) => c.handle === handle) ?? null;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, handle } = await params;
  const d = await loadStore(slug, true);
  const c = d && pick(d, handle);
  if (!d || !c) return {};
  return {
    title: `${c.title} - ${d.b.name}`,
    description: `Shop ${c.title} at ${d.b.name}.`,
    robots: d.prefs.noindex || d.prefs.private ? { index: false, follow: false } : undefined,
    openGraph: { title: `${c.title} - ${d.b.name}`, images: c.image ? [c.image] : undefined },
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
  const c = pick(d, handle);
  if (!c) notFound();
  const byId = new Map(d.products.map((p) => [p.id, p]));
  const products = c.ids.map((id) => byId.get(id)).filter((p): p is SiteProduct => !!p);
  const others = [d.allCollection, ...d.collections.filter((x) => x.ids.length > 0)].map((x) => ({ id: x.id, title: x.title, href: collectionHref(slug, x) }));
  return (
    <>
      <Storefront theme={d.theme} info={d.info} products={d.products} collections={d.collections} shop={d.shop} pages={d.pages} policies={d.policies} storefronts={d.storefronts} trusted={d.prefs.trusted} mode="page" wide>
        <CollectionView title={c.title} products={products} slug={slug} others={others} current={c.id} />
      </Storefront>
      <ConsentGate businessId={d.b.id} privacy={d.privacy} privacyHref={d.privacyHref} />
    </>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl space-y-6 px-5 py-10"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[3/4] w-full" />)}</div></div>}>
      <View params={props.params} />
    </Suspense>
  );
}
