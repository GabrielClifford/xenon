export type Market = {
  id: string;
  name: string;
  type: 'country' | 'region';
  regions: string[]; // ISO 3166-2:NG codes, empty for the whole-country market
  status: 'active' | 'draft';
  is_default: boolean;
  created_at: string;
};

export type Catalog = {
  id: string;
  title: string;
  status: 'active' | 'draft';
  adjustment_percent: number;
  compare_at: 'dynamic' | 'static' | 'hidden';
  include_all_products: boolean;
  created_at: string;
};

export type CatalogMarket = { catalog_id: string; market_id: string };
export type CatalogProduct = { catalog_id: string; product_id: string; fixed_price: number | null };

// The market a visitor belongs to: a region market containing their state if there is one,
// otherwise the whole-country market. regionCode is the visitor's state code, for example "RI".
export function matchMarket(markets: Market[], regionCode?: string | null): Market | null {
  const active = markets.filter((m) => m.status === 'active');
  if (regionCode) {
    const hit = active.find((m) => m.type === 'region' && m.regions.includes(regionCode));
    if (hit) return hit;
  }
  return active.find((m) => m.type === 'country') ?? null;
}

// The catalog that applies to a market: the earliest-created active catalog linked to it.
export function pickCatalog(
  market: Market | null,
  catalogs: Catalog[],
  links: CatalogMarket[]
): Catalog | null {
  if (!market) return null;
  const ids = new Set(links.filter((l) => l.market_id === market.id).map((l) => l.catalog_id));
  return (
    catalogs
      .filter((c) => c.status === 'active' && ids.has(c.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

// The price a visitor pays, or null when the product is not sold in their catalog.
// A fixed price wins; otherwise the base price is adjusted by the catalog's percentage.
export function priceFor(
  basePrice: number,
  productId: string,
  catalog: Catalog | null,
  rows: CatalogProduct[]
): number | null {
  if (!catalog) return basePrice;
  const row = rows.find((r) => r.catalog_id === catalog.id && r.product_id === productId);
  if (!catalog.include_all_products && !row) return null;
  if (row && row.fixed_price !== null && row.fixed_price !== undefined) return row.fixed_price;
  return Math.max(0, Math.round(basePrice * (1 + Number(catalog.adjustment_percent) / 100)));
}
