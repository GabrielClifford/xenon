import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import StoreAccount from '@/components/StoreAccount';
import { readAccounts } from '@/lib/accounts';

async function Account({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data: b } = await supabase
    .from('businesses')
    .select('id,name,slug,accounts_options')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!b) notFound();

  return <StoreAccount store={{ id: b.id, name: b.name, slug: b.slug, options: readAccounts(b.accounts_options) }} />;
}

export default function AccountPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Account params={params} />
    </Suspense>
  );
}