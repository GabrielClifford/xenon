import { readOptions } from '@/lib/checkout';
import { readAccounts } from '@/lib/accounts';
import { readTax } from '@/lib/tax';
import { readShipping } from '@/lib/shipping';
import { applyLocations, formatAddress, readLocations } from '@/lib/locations';
import { publishedLinks, readPolicies } from '@/lib/policies';
import { readPayments } from '@/lib/paymentMethods';
import { readPrivacy } from '@/lib/privacy';
import type { Shop } from '@/components/SiteProducts';

// Turns a businesses row into the settings the cart and checkout need. Used by the live store and by the editor preview.
export function buildShop(b: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const privacy = readPrivacy(b.privacy_options);
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
  return { shop, policies, storefronts, privacy };
}
