import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  MapPin,
  Star,
  Wallet,
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import CallbackForm from '@/components/CallbackForm';
import { providers, formatPrice } from '@/data/providers';
import { Skeleton } from '@/components/Skeleton';

export function generateStaticParams() {
  return providers.map((p) => ({ id: p.id }));
}

const tones = [
  'from-blue-100 to-blue-200 text-blue-700',
  'from-sky-100 to-sky-200 text-sky-800',
  'from-amber-100 to-amber-200 text-amber-800',
  'from-violet-100 to-violet-200 text-violet-800',
  'from-rose-100 to-rose-200 text-rose-800',
];

type ProviderPageProps = {
  params: Promise<{ id: string }>;
};

export default function ProviderPage({ params }: ProviderPageProps) {
  return (
        <Suspense
      fallback={
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      }
    >
      <ProviderDetails params={params} />
    </Suspense>
  );
}

async function ProviderDetails({ params }: ProviderPageProps) {
  const { id } = await params;

  const p = providers.find((x) => x.id === id);

  if (!p) {
    notFound();
  }

  const initials = p.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const tone = tones[p.name.length % tones.length];

  const similar = providers
    .filter((x) => x.id !== p.id && x.trade === p.trade)
    .slice(0, 4);

  const more = similar.length
    ? similar
    : [...providers]
        .filter((x) => x.id !== p.id)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 4);

  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <Link
          href="/providers"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to results
        </Link>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="relative aspect-[3/2] overflow-hidden rounded-3xl">
              <div
                className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${tone}`}
              >
                <span className="font-display text-6xl font-bold">
                  {initials}
                </span>
              </div>

              <div
                className="absolute inset-0 bg-cover bg-top"
                style={{
                  backgroundImage: `url(/providers/${p.id}.jpg)`,
                }}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-slate-900">
                {p.name}
              </h1>

              {p.verified ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                  <BadgeCheck className="h-4 w-4" />
                  Verified
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Not yet verified
                </span>
              )}
            </div>

            <p className="mt-1 text-slate-500">{p.trade}</p>

            <Link
              href={`/s/${p.id}`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline"
            >
              View mini-website
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
              <div>
                <p className="flex items-center gap-1 text-lg font-semibold text-slate-900">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  {p.rating.toFixed(1)}
                </p>
                <p className="text-xs text-slate-500">
                  {p.reviews} reviews
                </p>
              </div>

              <div>
                <p className="flex items-center gap-1 text-lg font-semibold text-slate-900">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  {p.years} yrs
                </p>
                <p className="text-xs text-slate-500">Experience</p>
              </div>

              <div>
                <p className="flex items-center gap-1 text-lg font-semibold text-slate-900">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  {p.area}
                </p>
                <p className="text-xs text-slate-500">{p.city}</p>
              </div>

              <div>
                <p className="flex items-center gap-1 text-lg font-semibold text-slate-900">
                  <Wallet className="h-5 w-5 text-blue-600" />
                  ₦{p.priceFrom.toLocaleString('en-NG')}
                </p>
                <p className="text-xs text-slate-500">Starting price</p>
              </div>
            </div>

            <h2 className="font-display mt-10 text-xl font-semibold text-slate-900">
              About
            </h2>
            <p className="mt-3 leading-relaxed text-slate-600">
              {p.about}
            </p>

            <h2 className="font-display mt-10 text-xl font-semibold text-slate-900">
              Service area
            </h2>
            <p className="mt-3 text-slate-600">
              Based in {p.area}, {p.city}. Ask about availability in nearby
              areas when you get in touch.
            </p>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <p className="text-sm text-slate-500">Starting from</p>
            <p className="font-display text-3xl font-bold text-blue-600">
              {formatPrice(p.priceFrom).replace('From ', '')}
            </p>
            <p className="mb-5 mt-1 text-xs text-slate-400">
              The final price is agreed with the professional.
            </p>
            <CallbackForm name={p.name} />
          </aside>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl font-semibold text-slate-900">
            {similar.length
              ? `More ${p.trade.toLowerCase()}s`
              : 'Other top-rated professionals'}
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {more.map((x) => (
              <ProviderCard key={x.id} p={x} />
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}