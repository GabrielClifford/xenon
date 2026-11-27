import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/components/store/Storefront';
import CartView from '@/components/store/CartView';
import PasswordGate from '@/components/store/PasswordGate';
import ConsentGate from '@/components/ConsentGate';
import { Skeleton } from '@/components/Skeleton';
import { loadStore } from '@/lib/store/load';
import { cookieName, tokenOk } from '@/lib/store/access';

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadStore(slug, false);
  return { title: d ? `Cart - ${d.b.name}` : 'Cart', robots: { index: false, follow: true } };
}

async function View({ params }: P) {
  const { slug } = await params;
  const d = await loadStore(slug, true);
  if (!d) notFound();
  if (d.prefs.private) {
    const token = (await cookies()).get(cookieName(slug))?.value;
    if (!(await tokenOk(slug, token))) return <PasswordGate slug={slug} name={d.info.name} />;
  }
  return (
    <>
      <Storefront theme={d.theme} info={d.info} products={d.products} collections={d.collections} shop={d.shop} pages={d.pages} policies={d.policies} storefronts={d.storefronts} trusted={d.prefs.trusted} template="cart">
        <CartView products={d.products} slug={slug} businessId={d.b.id} canOrder={d.shop.checkout.accepting} minOrder={d.shop.checkout.minOrder} />
      </Storefront>
      <ConsentGate businessId={d.b.id} privacy={d.privacy} privacyHref={d.privacyHref} />
    </>
  );
}

export default function Page(props: P) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-5 py-10"><Skeleton className="h-8 w-48" /><div className="mt-6 space-y-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div></div>}>
      <View params={props.params} />
    </Suspense>
  );
}
