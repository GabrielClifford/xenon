import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/components/store/Storefront';
import PasswordGate from '@/components/store/PasswordGate';
import ConsentGate from '@/components/ConsentGate';
import { Skeleton } from '@/components/Skeleton';
import { loadStore } from '@/lib/store/load';
import { cookieName, tokenOk } from '@/lib/store/access';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await loadStore(slug, false);
  if (!d) return {};
  const title = d.prefs.seoTitle || `${d.b.name}${d.b.tagline ? ` - ${d.b.tagline}` : ''}`;
  const description = d.prefs.seoDescription || d.b.about || d.b.tagline || undefined;
  const image = d.prefs.socialImage || d.b.photo_url || undefined;
  return {
    title, description,
    robots: d.prefs.noindex || d.prefs.private ? { index: false, follow: false } : undefined,
    openGraph: { title, description, images: image ? [image] : undefined, type: 'website' },
  };
}

async function Site({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ wrong?: string }> }) {
  const { slug } = await params;
  const { wrong } = await searchParams;
  const d = await loadStore(slug, true);
  if (!d) notFound();

  if (d.prefs.private) {
    const token = (await cookies()).get(cookieName(slug))?.value;
    if (!(await tokenOk(slug, token))) return <PasswordGate slug={slug} name={d.info.name} wrong={wrong} />;
  }

  return (
    <>
      <Storefront theme={d.theme} info={d.info} products={d.products} shop={d.shop} pages={d.pages} policies={d.policies} storefronts={d.storefronts} trusted={d.prefs.trusted} />
      <ConsentGate businessId={d.b.id} privacy={d.privacy} privacyHref={d.privacyHref} />
    </>
  );
}

export default function BusinessPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ wrong?: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl space-y-6 px-5 py-10"><Skeleton className="h-64 w-full rounded-2xl" /><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-full" /></div>}>
      <Site params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
