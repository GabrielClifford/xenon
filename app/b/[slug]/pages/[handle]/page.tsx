import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Storefront from '@/components/store/Storefront';
import PasswordGate from '@/components/store/PasswordGate';
import { Markdown } from '@/lib/store/markdown';
import { Skeleton } from '@/components/Skeleton';
import { loadStore } from '@/lib/store/load';
import { anon, cookieName, tokenOk } from '@/lib/store/access';

type P = { params: Promise<{ slug: string; handle: string }> };

async function getPage(slug: string, handle: string, businessId: string) {
  const { data } = await anon().from('store_pages').select('title, body, template, seo_title, seo_description').eq('business_id', businessId).eq('handle', handle).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, handle } = await params;
  const d = await loadStore(slug, false);
  if (!d) return {};
  const pg = await getPage(slug, handle, d.b.id);
  if (!pg) return {};
  return { title: `${pg.seo_title || pg.title} - ${d.b.name}`, description: pg.seo_description || undefined, robots: d.prefs.noindex || d.prefs.private ? { index: false, follow: false } : undefined };
}

async function PageView({ params }: P) {
  const { slug, handle } = await params;
  const d = await loadStore(slug, true);
  if (!d) notFound();
  if (d.prefs.private) {
    const token = (await cookies()).get(cookieName(slug))?.value;
    if (!(await tokenOk(slug, token))) return <PasswordGate slug={slug} name={d.info.name} />;
  }
  const pg = await getPage(slug, handle, d.b.id);
  if (!pg) notFound();
  const ctx = { slug, trusted: d.prefs.trusted };
  const wa = (d.info.phone ?? '').replace(/\D/g, '');
  return (
    <Storefront theme={d.theme} info={d.info} products={d.products} collections={d.collections} shop={d.shop} pages={d.pages} policies={d.policies} storefronts={d.storefronts} trusted={d.prefs.trusted} template="page">
      <h1 className="xs-h1 mb-6">{pg.title}</h1>
      <Markdown text={pg.body} ctx={ctx} />
      {pg.template === 'contact' && (
        <div className="mt-8 flex flex-wrap gap-3">
          {wa && <a className="xs-btn" href={`https://wa.me/${wa.startsWith('0') ? '234' + wa.slice(1) : wa}`} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>}
          {d.info.phone && <a className="xs-btn-secondary" href={`tel:${d.info.phone}`}>Call {d.info.phone}</a>}
        </div>
      )}
    </Storefront>
  );
}

export default function Page(props: P) {
  return <Suspense fallback={<div className="mx-auto max-w-3xl space-y-4 px-5 py-10"><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>}><PageView params={props.params} /></Suspense>;
}
