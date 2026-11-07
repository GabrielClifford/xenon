import { Suspense } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProviderCard from '@/components/ProviderCard';
import { trades, areas } from '@/data/providers';
import { getDirectory } from '@/lib/directory';
import { Skeleton } from '@/components/Skeleton';

type Params = { q?: string; trade?: string; area?: string; sort?: string };

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600';

async function Results({ searchParams }: { searchParams: Promise<Params> }) {
  const { q = '', trade = '', area = '', sort = '' } = await searchParams;
  const term = q.trim().toLowerCase();
    const providers = await getDirectory();

  let results = providers.filter((p) => {
    if (trade && p.trade !== trade) return false;
    if (area && p.area !== area) return false;
    if (term) {
      const text = `${p.name} ${p.trade} ${p.about} ${p.area}`.toLowerCase();
      if (!text.includes(term)) return false;
    }
    return true;
  });

  if (sort === 'price-low') results = [...results].sort((a, b) => a.priceFrom - b.priceFrom);
  else if (sort === 'price-high') results = [...results].sort((a, b) => b.priceFrom - a.priceFrom);
  else if (sort === 'experience') results = [...results].sort((a, b) => b.years - a.years);
    else results = [...results].sort((a, b) => Number(!!b.real) - Number(!!a.real) || b.rating - a.rating);

  const filtered = Boolean(q || trade || area || sort);

  return (
    <>
      <form
        key={`${q}-${trade}-${area}-${sort}`}
        action="/providers"
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      >
        <input name="q" defaultValue={q} placeholder="Search a service or name" className={field} />
        <select name="trade" defaultValue={trade} className={field}>
          <option value="">All services</option>
          {trades.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select name="area" defaultValue={area} className={field}>
          <option value="">All areas</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select name="sort" defaultValue={sort} className={field}>
          <option value="">Sort: Top rated</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="experience">Most experienced</option>
        </select>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Search className="h-4 w-4" /> Search
        </button>
      </form>

      <div className="mb-6 mt-6 flex items-center justify-between text-sm text-slate-500">
        <p>
          {results.length} {results.length === 1 ? 'professional' : 'professionals'} found
        </p>
        {filtered && (
          <Link href="/providers" className="font-medium text-blue-600 hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="font-display text-xl font-semibold text-slate-900">No professionals match your search</p>
          <p className="mt-2 text-sm text-slate-500">Try a different service or area.</p>
          <Link href="/providers" className="mt-5 inline-block text-sm font-semibold text-blue-600 hover:underline">
            View all professionals
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((p) => <ProviderCard key={p.id} p={p} />)}
        </div>
      )}
    </>
  );
}

export default function ProvidersPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <>
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 pb-20 pt-28">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Port Harcourt</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Find a professional</h1>
        <p className="mb-8 mt-2 text-sm text-slate-500">Browse sample listings by service and area.</p>

        <Suspense
                    fallback={
            <div className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-2xl" />
              ))}
            </div>
          }
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </main>

      <Footer />
    </>
  );
}