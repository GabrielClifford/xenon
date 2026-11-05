'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Check, ChevronRight, Globe, Sparkles, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import VisitsOverview from '@/components/VisitsOverview';
import ChannelBreakdown from '@/components/ChannelBreakdown';
import TestimonialForm from '@/components/TestimonialForm';

export type Tab = 'home' | 'website' | 'products' | 'orders' | 'customers' | 'discounts' | 'channels' | 'settings';

type Business = {
  id: string;
  slug: string;
  name: string;
  services: string[];
  phone: string | null;
  photo_url: string | null;
  gallery: string[];
  published: boolean;
  created_at: string;
};

const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

export default function DashboardOverview({
  user,
  isArtisan,
  onNavigate,
}: {
  user: User;
  isArtisan: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const [b, setB] = useState<Business | null | undefined>(undefined);
  const [enq, setEnq] = useState<{ fresh: number; week: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const meta = (user.user_metadata ?? {}) as { full_name?: string };
  const rawFirst = (meta.full_name || user.email || '').split(/[ @]/)[0];
  const first = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (!isArtisan) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('id,slug,name,services,phone,photo_url,gallery,published,created_at')
        .eq('owner_id', user.id)
        .maybeSingle();
      const biz = (data as Business | null) ?? null;
      setB(biz);
      if (biz) {
        const since = new Date(Date.now() - 7 * 86400000).toISOString();
        const [fresh, week] = await Promise.all([
          supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'new'),
          supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', since),
        ]);
        setEnq({ fresh: fresh.count ?? 0, week: week.count ?? 0 });
      }
    })();
  }, [user.id, isArtisan]);

  if (!isArtisan) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">
            {greeting}, {first}
          </h1>
          <p className="mt-1 text-slate-500">Your account is ready.</p>
        </div>
        <div className={`${card} p-6`}>
          <h2 className="font-display text-lg font-semibold text-slate-900">Xenon is for artisans</h2>
          <p className="mt-2 text-sm text-slate-600">
            Xenon helps artisans build their own websites. To create one, sign up with an artisan account.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  if (b === undefined) return <p className="text-sm text-slate-400">Loading your dashboard...</p>;

  const photos = b ? (b.photo_url ? 1 : 0) + b.gallery.length : 0;
  const steps = [
    { title: 'Add your business details', text: 'Tell customers who you are and what you do.', done: !!b },
    { title: 'Add a main photo', text: 'Shown at the top of your website.', done: !!b?.photo_url },
    { title: 'Add 3 or more project photos', text: 'Show off your best work.', done: (b?.gallery.length ?? 0) >= 3 },
    { title: 'Add your phone number', text: 'So customers can reach you.', done: !!b?.phone },
    { title: 'Publish your website', text: 'Make it visible to everyone.', done: !!b?.published },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const siteUrl = b ? `${origin}/b/${b.slug}` : '';

  async function copyLink() {
    await navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-slate-900">
          {greeting}, {first}
        </h1>
        <p className="mt-1 text-slate-500">Here&apos;s what&apos;s happening with your website today.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <VisitsOverview userId={user.id} enquiries={enq?.week} />

          {/* Next steps */}
          <div className={`${card} p-5`}>
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
                <Sparkles className="h-5 w-5 text-blue-600" /> Next steps
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                </div>
                {doneCount} / {steps.length}
              </div>
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              {steps.map((s) => (
                <button
                  key={s.title}
                  onClick={() => onNavigate('website')}
                  className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      s.done ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Check className="h-5 w-5" />
                  </span>
                  <span className="flex-1">
                    <span className={`block text-sm font-medium ${s.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {s.title}
                    </span>
                    <span className="block text-xs text-slate-500">{s.text}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Customers */}
          <div className={`${card} flex flex-wrap items-center gap-4 p-5`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold text-slate-900">Customers</h2>
              <p className="text-sm text-slate-500">
                {enq === null
                  ? 'Loading...'
                  : enq.fresh > 0
                    ? `You have ${enq.fresh} new enquir${enq.fresh === 1 ? 'y' : 'ies'}.`
                    : 'No new enquiries right now.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('customers')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              View customers
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Your website */}
          <div className={`${card} p-5`}>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
              <Globe className="h-5 w-5 text-blue-600" /> Your website
            </h2>
            {b ? (
              <>
                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    b.published ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {b.published ? 'Live' : 'Not published'}
                </span>
                <p className="mt-3 text-sm font-medium text-slate-900">{b.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {photos} photo{photos === 1 ? '' : 's'} · {b.services.length} service{b.services.length === 1 ? '' : 's'}
                </p>
                {b.published ? (
                  <>
                    <p className="mt-2 break-all text-xs text-slate-500">{siteUrl}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/b/${b.slug}`}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        View website
                      </Link>
                      <button
                        onClick={copyLink}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {copied ? 'Copied!' : 'Copy link'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => onNavigate('website')}
                    className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                  >
                    Finish and publish
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-slate-600">You haven&apos;t created your website yet. It only takes a few minutes.</p>
                <button
                  onClick={() => onNavigate('website')}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Create your website
                </button>
              </>
            )}
          </div>

          {/* Visits by channel */}
          {b && <ChannelBreakdown businessId={b.id} onViewAll={() => onNavigate('channels')} />}
          {b && <TestimonialForm businessId={b.id} />}

          {/* Tips */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-sm">
            <h2 className="font-display text-lg font-semibold">Get more customers</h2>
            <ul className="mt-3 space-y-2 text-sm text-blue-50">
              <li>• Add clear photos of your best work</li>
              <li>• Share your channel links on WhatsApp and Instagram</li>
              <li>• Reply quickly to every enquiry</li>
            </ul>
            <button
              onClick={() => onNavigate('channels')}
              className="mt-4 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-blue-50"
            >
              Get my links
            </button>
          </div>

          {/* Activity */}
          <div className={`${card} p-5`}>
            <h2 className="font-display text-lg font-semibold text-slate-900">Recent activity</h2>
            {b ? (
              <p className="mt-3 text-sm text-slate-600">
                Business created on{' '}
                {new Date(b.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}