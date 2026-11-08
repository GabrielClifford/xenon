import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ArtisanSite from '@/components/ArtisanSite';
import VisitTracker from '@/components/VisitTracker';
import type { Provider } from '@/data/providers';
import type { SiteSettings, ThemeName } from '@/data/sites';
import { Skeleton } from '@/components/Skeleton';
import { readOptions } from '@/lib/checkout';
async function Site({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const { data: b } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  if (!b) notFound();

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, category, photo_url, stock')
    .eq('business_id', b.id)
    .eq('available', true)
    .order('created_at', { ascending: true });

  const p: Provider = {
    id: b.slug,
    name: b.name,
    trade: b.trade,
    area: b.area,
    city: b.city,
    rating: 0,
    reviews: 0,
    years: b.years ?? 0,
    verified: false,
    priceFrom: b.price_from ?? 0,
    about: b.about ?? '',
  };
  const s: SiteSettings = {
    tagline: b.tagline ?? '',
    services: b.services ?? [],
    serviceAreas: b.service_areas ?? [],
        theme: ['classic', 'bold', 'spark'].includes(b.theme) ? (b.theme as ThemeName) : 'classic',
    phone: b.phone ?? undefined,
    photoUrl: b.photo_url ?? undefined,
    gallery: b.gallery ?? [],
        businessId: b.id,
  };

  return (
    <>
    
       <ArtisanSite
        p={p}
        s={s}
        sample={false}
        products={products ?? []}
        shop={{
          businessId: b.id,
          bank:
            b.bank_name && b.account_number
              ? { bank_name: b.bank_name, account_number: b.account_number, account_name: b.account_name ?? '' }
              : null,
          checkout: {
            requireAddress: b.checkout_require_address ?? false,
            showNote: b.checkout_show_note ?? true,
            accepting: b.checkout_accepting ?? true,
            minOrder: Number(b.checkout_min_order ?? 0),
            thankYou: b.checkout_thank_you ?? null,
            options: readOptions(b.checkout_options),
          },
        }}
      />

      <VisitTracker businessId={b.id} />
    </>
  );
}

export default function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
        <Suspense
      fallback={
        <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      }
    >
      <Site params={params} />
    </Suspense>
  );
}