'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { Check, ChevronRight, Globe, Link2, Package, Rocket, ShoppingBag, Sparkles, Tag, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import VisitsOverview from '@/components/VisitsOverview';
import ChannelBreakdown from '@/components/ChannelBreakdown';
import TestimonialForm from '@/components/TestimonialForm';
import { RecentActivity, SalesBreakdown, TopProducts } from '@/components/SalesPanels';
import { HomeSkeleton } from '@/components/Skeleton';

export type Tab = 'home' | 'website' | 'products' | 'orders' | 'customers' | 'discounts' | 'templates' | 'analytics' | 'marketing' | 'support' | 'channels' | 'settings';

type Business = {
  id: string;
  slug: string;
  name: string;
  services: string[];
  phone: string | null;
  photo_url: string | null;
  gallery: string[];
  published: boolean;
  bank_name: string | null;
  account_number: string | null;
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
  const [freshEnq, setFreshEnq] = useState<number | null>(null);
  const [productCount, setProductCount] = useState(0);
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
        .select('id,slug,name,services,phone,photo_url,gallery,published,created_at,bank_name,account_number')
        .eq('owner_id', user.id)
        .maybeSingle();
      const biz = (data as Business | null) ?? null;
      setB(biz);
      if (biz) {
        const [fresh, products] = await Promise.all([
          supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'new'),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', biz.id),
        ]);
        setFreshEnq(fresh.count ?? 0);
        setProductCount(products.count ?? 0);
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
          <h2 className="font-display text-lg font-semibold text-slate-900">Xenon is for business owners</h2>
          <p className="mt-2 text-sm text-slate-600">
            Xenon helps businesses build their own websites. To create one, sign up with a business account.
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

    if (b === undefined) return <HomeSkeleton />;

  const photos = b ? (b.photo_url ? 1 : 0) + b.gallery.length : 0;
  const steps: { title: string; text: string; done: boolean; tab: Tab }[] = [
    { title: 'Add your business details', text: 'Tell customers who you are and what you do.', done: !!b, tab: 'website' },
    { title: 'Add a main photo', text: 'Shown at the top of your website.', done: !!b?.photo_url, tab: 'website' },
    { title: 'Add 3 or more photos', text: 'Show off your business.', done: (b?.gallery.length ?? 0) >= 3, tab: 'website' },
    { title: 'Add your phone number', text: 'So customers can reach you.', done: !!b?.phone, tab: 'website' },
    { title: 'Add your first product', text: 'Start selling on your website.', done: productCount > 0, tab: 'products' },
    {
      title: 'Set up bank transfer',
      text: 'Add your account details so customers can pay by transfer.',
      done: !!(b?.bank_name && b?.account_number),
      tab: 'orders',
    },
    { title: 'Publish your website', text: 'Make it visible to everyone.', done: !!b?.published, tab: 'website' },
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

   const tips = (
        <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-4 text-white shadow-sm sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold">Get more customers</h2>
        <p className="mt-1 text-xs leading-relaxed text-blue-100">
          Add clear photos of your best work, share your channel links on WhatsApp and Instagram, and reply quickly to
          every enquiry.
        </p>
      </div>
      <button
        onClick={() => onNavigate('channels')}
        className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-blue-50"
      >
        Get my links
      </button>
    </div>
  );
     
  const yourWebsite = (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-col sm:flex-row">
        {b?.photo_url && (
          <div className="h-40 shrink-0 bg-slate-100 sm:h-auto sm:w-2/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.photo_url} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900">
            <Globe className="h-5 w-5 text-blue-600" /> Your website
          </h2>
          {b ? (
            <>
              <span
                className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  b.published ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
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
                         className="self-start rounded-lg bg-white px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-blue-50 sm:self-auto"
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
      </div>
    </div>
  );

  const nextSteps = (
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
            onClick={() => onNavigate(s.tab)}
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
  );

  const customersCard = (
    <div className={`${card} flex flex-wrap items-center gap-4 p-5`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Users className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-slate-900">Customers</h2>
        <p className="text-sm text-slate-500">
          {freshEnq === null
                        ? '\u00a0'
            : freshEnq > 0
              ? `You have ${freshEnq} new enquir${freshEnq === 1 ? 'y' : 'ies'}.`
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
  );
  const actions: { label: string; text: string; icon: React.ElementType; run: () => void }[] = [
    { label: 'Add a product', text: 'Put something new on your website.', icon: Package, run: () => onNavigate('products') },
    { label: 'Create a discount code', text: 'Offer customers money off.', icon: Tag, run: () => onNavigate('discounts') },
    { label: 'View orders', text: 'See and update customer orders.', icon: ShoppingBag, run: () => onNavigate('orders') },
    ...(b?.published
      ? [{ label: copied ? 'Link copied!' : 'Copy website link', text: 'Share it on WhatsApp and Instagram.', icon: Link2, run: copyLink }]
      : []),
  ];

  const quickActions = (
    <div className={`${card} flex flex-1 flex-col p-5`}>
      <h2 className="font-display text-lg font-semibold text-slate-900">Quick actions</h2>
      <div className="mt-3 flex flex-1 flex-col divide-y divide-slate-100">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.run}
            className="flex flex-1 items-center gap-4 py-3 text-left transition hover:bg-slate-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <a.icon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-900">{a.label}</span>
              <span className="block text-xs text-slate-500">{a.text}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_26rem] xl:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">
            {greeting}, {first}
          </h1>
          <p className="mt-1 text-slate-500">Here&apos;s what&apos;s happening with your business today.</p>
        </div>
        <div className="hidden xl:block">{tips}</div>
      </div>

      <VisitsOverview userId={user.id} onNavigate={onNavigate} />

      <div className="grid gap-6 lg:grid-cols-2">
        {yourWebsite}
        {b ? (
          <RecentActivity businessId={b.id} createdAt={b.created_at} />
        ) : (
          <div className={`${card} p-5`}>
            <h2 className="font-display text-lg font-semibold text-slate-900">Recent activity</h2>
            <p className="mt-3 text-sm text-slate-500">No activity yet.</p>
          </div>
        )}
      </div>

                <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          {nextSteps}
          {b && <TopProducts businessId={b.id} onViewAll={() => onNavigate('products')} />}
          {customersCard}
          {b && <SalesBreakdown businessId={b.id} onViewAll={() => onNavigate('orders')} />}
          {b && quickActions}
        </div>
        <div className="flex flex-col gap-6">
          {b && <ChannelBreakdown businessId={b.id} onViewAll={() => onNavigate('channels')} />}
          {b && <TestimonialForm businessId={b.id} />}
          <div className="xl:hidden">{tips}</div>
        </div>
      </div>

           <div className="flex flex-col gap-4 rounded-2xl bg-blue-50 p-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4 sm:flex-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
            <Rocket className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-slate-900">Ready to scale even more?</p>
            <p className="mt-1 text-sm text-slate-600">
              Upgrade to Xenon Pro for more templates, advanced analytics and higher limits.
            </p>
          </div>
        </div>
        <Link
          href="/#pricing"
          className="rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700 sm:py-2.5"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}