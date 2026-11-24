import { anon, readPrefs } from '@/lib/store/access';
import { readTheme, newSection } from '@/lib/store/theme';
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

// everything a public store page needs, in one place
export async function loadStore(slug: string, withProducts: boolean) {
  const supabase = anon();
  const { data: b } = await supabase.from('businesses').select('*').eq('slug', slug).eq('published', true).maybeSingle();
  if (!b) return null;

  await supabase.rpc('xenon_store_apply_scheduled', { p_business: b.id });
  const [{ data: row }, { data: pageRows }, productsRes] = await Promise.all([
    supabase.from('store_themes').select('settings, sections, template').eq('business_id', b.id).eq('status', 'live').maybeSingle(),
    supabase.from('store_pages').select('title, handle').eq('business_id', b.id).order('title'),
    withProducts
      ? supabase.from('products').select('id, name, description, price, category, photo_url, stock, taxable').eq('business_id', b.id).eq('available', true).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as SiteProduct[] }),
  ]);

  const theme = readTheme(row);
  if (!row) {
    // stores created before themes existed: show their own name and tagline in the banner
    const hero = theme.sections.find((x) => x.type === 'hero');
    if (hero) { hero.s.heading = b.name; hero.s.sub = b.tagline ?? hero.s.sub; }
    if (!theme.sections.some((x) => x.type === 'contact')) theme.sections.splice(theme.sections.length - 1, 0, newSection('contact'));
  }

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
    products: (productsRes.data ?? []) as SiteProduct[],
    pages: (pageRows ?? []) as { title: string; handle: string }[],
    info: { name: b.name as string, slug: b.slug as string, phone: (b.phone ?? undefined) as string | undefined, about: (b.about ?? '') as string, photoUrl: (b.photo_url ?? undefined) as string | undefined },
  };
}
