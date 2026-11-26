import { anon, readPrefs } from '@/lib/store/access';
import { readTheme } from '@/lib/store/theme';
import { readOptions } from '@/lib/checkout';
import { readAccounts } from '@/lib/accounts';
import { readTax } from '@/lib/tax';
import { readShipping } from '@/lib/shipping';
import { applyLocations, formatAddress, readLocations } from '@/lib/locations';
import { publishedLinks, readPolicies } from '@/lib/policies';
import { readPayments } from '@/lib/paymentMethods';
import { readPrivacy } from '@/lib/privacy';
import { isPublished } from '@/lib/policies';
import type { Shop, SiteProduct } from '@/components/SiteProducts';
import { allCollection, buildCollections, type StoreCollection } from '@/lib/store/collections';

export const PRODUCT_COLS = 'id, name, description, price, category, photo_url, stock, taxable, handle, compare_at_price, vendor, product_type, tags, created_at';
const BASE_COLS = 'id, name, description, price, category, photo_url, stock, taxable';

// products with the extra columns (sale price, type, tags); falls back to the basics if the table is older
export async function loadProducts(supabase: ReturnType<typeof anon>, businessId: string): Promise<SiteProduct[]> {
  const q = (cols: string) => supabase.from('products').select(cols).eq('business_id', businessId).eq('available', true).order('created_at', { ascending: true });
  const full = await q(PRODUCT_COLS);
  const rows = full.error ? (await q(BASE_COLS)).data : full.data;
  return ((rows ?? []) as unknown as SiteProduct[]).map((p) => ({ ...p, price: Number(p.price), compare_at_price: p.compare_at_price == null ? null : Number(p.compare_at_price), tags: Array.isArray(p.tags) ? p.tags : [] }));
}

export async function loadCollections(supabase: ReturnType<typeof anon>, businessId: string, products: SiteProduct[]): Promise<StoreCollection[]> {
  const [{ data: rows, error }, { data: mem }] = await Promise.all([
    supabase.from('collections').select('*').eq('business_id', businessId),
    supabase.from('collection_products').select('collection_id, product_id, position').eq('business_id', businessId),
  ]);
  if (error || !rows) return [];
  return buildCollections(rows as Record<string, unknown>[], (mem ?? []) as { collection_id: string; product_id: string; position?: number | null }[], products);
}

// everything a public store page needs, in one place
export async function loadStore(slug: string, withProducts: boolean) {
  const supabase = anon();
  const { data: b } = await supabase.from('businesses').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  if (!b) return null;

  await supabase.rpc('xenon_store_apply_scheduled', { p_business: b.id });
  const [{ data: row }, { data: pageRows }, products] = await Promise.all([
    supabase.from('store_themes').select('settings, sections, template').eq('business_id', b.id).eq('status', 'live').maybeSingle(),
    supabase.from('store_pages').select('title, handle').eq('business_id', b.id).order('title'),
    withProducts ? loadProducts(supabase, b.id) : Promise.resolve([] as SiteProduct[]),
  ]);
  const collections = withProducts ? await loadCollections(supabase, b.id, products) : [];

  const theme = readTheme(row);
  const privacy = readPrivacy(b.privacy_options);
  const privacyHref = isPublished(readPolicies(b.policies), 'privacy') ? `/b/${b.slug}/policies/privacy` : undefined;
  const policies = [
    ...publishedLinks(b.policies, b.slug),
    ...(privacy.requestsPage && readPolicies(b.policies).showLinks ? [{ label: 'Privacy requests', href: `/b/${b.slug}/privacy-request` }] : []),
  ];
  const locs = readLocations(b.locations_options);
  const storefronts = locs.filter((l) => l.active && l.storefront).map((l) => ({ name: l.name, address: formatAddress(l.address) }));

  const shop: Shop = {
    businessId: b.id, slug: b.slug,
    accounts: readAccounts(b.accounts_options), tax: readTax(b.tax_options), policies,
    payments: readPayments(b.payments_options),
    shipping: applyLocations(readShipping(b.shipping_options), locs),
    bank: b.bank_name && b.account_number ? { bank_name: b.bank_name, account_number: b.account_number, account_name: b.account_name ?? '' } : null,
    checkout: {
      requireAddress: b.checkout_require_address ?? false, showNote: b.checkout_show_note ?? true, accepting: b.checkout_accepting ?? true,
      minOrder: Number(b.checkout_min_order ?? 0), thankYou: b.checkout_thank_you ?? null, options: readOptions(b.checkout_options),
    },
  };

  return {
    b, theme, shop, privacy, privacyHref, policies, storefronts,
    prefs: readPrefs(b.store_prefs),
    products, collections, allCollection: allCollection(products),
    pages: (pageRows ?? []) as { title: string; handle: string }[],
    info: { name: b.name as string, slug: b.slug as string, phone: (b.phone ?? undefined) as string | undefined, about: (b.about ?? '') as string, photoUrl: (b.photo_url ?? undefined) as string | undefined },
  };
}
