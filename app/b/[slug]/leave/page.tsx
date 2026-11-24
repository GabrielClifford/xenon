import { Suspense } from 'react';
import Link from 'next/link';
import { anon } from '@/lib/store/access';

export const metadata = { robots: { index: false, follow: false } };

async function Notice({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ to?: string }> }) {
  const { slug } = await params;
  const { to } = await searchParams;
  let target = '';
  try { const u = new URL(to ?? ''); if (u.protocol === 'https:' || u.protocol === 'http:') target = u.toString(); } catch {}
  const { data } = await anon().from('businesses').select('name').eq('slug', slug).eq('published', true).maybeSingle();
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <h1 className="text-xl font-bold">You are leaving {data?.name ?? 'this store'}</h1>
      <p className="mt-2 text-sm text-slate-600">This link goes to another website, which {data?.name ?? 'the store'} does not control.</p>
      {target && <p className="mt-4 break-all rounded-xl bg-slate-100 p-3 text-sm">{target}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <Link href={`/b/${slug}`} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold">Go back</Link>
        {target && <a href={target} rel="noopener noreferrer nofollow" className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white">Continue</a>}
      </div>
    </main>
  );
}

export default function Leave(props: { params: Promise<{ slug: string }>; searchParams: Promise<{ to?: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-5 py-20"><div className="h-6 w-48 animate-pulse rounded bg-slate-200" /></div>}>
      <Notice params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
