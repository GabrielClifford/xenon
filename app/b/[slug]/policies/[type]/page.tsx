import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  contactLine,
  isPublished,
  policyText,
  policyTypes,
  publishedLinks,
  readPolicies,
  readRules,
  type PolicyType,
} from '@/lib/policies';

async function Policy({ params }: { params: Promise<{ slug: string; type: string }> }) {
  const { slug, type } = await params;
  const meta = policyTypes.find((p) => p.type === type);
  if (!meta) notFound();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data: b } = await supabase
    .from('businesses')
    .select('name,slug,phone,policies,policy_rules')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!b) notFound();

  const t = meta.type as PolicyType;
  const pol = readPolicies(b.policies);
  if (!isPublished(pol, t)) notFound();

  const text = policyText(t, pol, {
    name: b.name,
    contact: contactLine(pol, b.phone ?? ''),
    rules: readRules(b.policy_rules),
  });
  const others = publishedLinks(b.policies, b.slug).filter((l) => !l.href.endsWith(`/${t}`));

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
      <article className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="font-display text-3xl font-bold">{meta.label}</h1>
        <div className="mt-6 whitespace-pre-line break-words text-[15px] leading-7 text-slate-700">{text}</div>
        {others.length > 0 && (
          <div className="mt-12 border-t border-slate-200 pt-6">
            <p className="text-sm font-semibold">More from {b.name}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {others.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-blue-600 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </main>
  );
}

export default function PolicyPage({ params }: { params: Promise<{ slug: string; type: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <Policy params={params} />
    </Suspense>
  );
}