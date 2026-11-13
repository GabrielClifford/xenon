import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PrivacyRequestForm from '@/components/PrivacyRequestForm';
import { readPrivacy } from '@/lib/privacy';

async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data: b } = await supabase
    .from('businesses')
    .select('id,name,slug,privacy_options')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!b || !readPrivacy(b.privacy_options).requestsPage) notFound();

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <p className="font-display text-lg font-bold">{b.name}</p>
          <Link href={`/b/${b.slug}`} className="text-sm font-medium text-blue-600 hover:underline">
            Back to store
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold">Privacy requests</h1>
        <p className="mt-2 text-sm text-slate-600">
          You can ask {b.name} for a copy of the information we hold about you, ask us to delete it, or ask us to stop
          sending you marketing messages. Fill in the form and we will contact you.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <PrivacyRequestForm businessId={b.id} />
        </div>
      </div>
    </main>
  );
}

export default function PrivacyRequestPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Page params={params} />
    </Suspense>
  );
}