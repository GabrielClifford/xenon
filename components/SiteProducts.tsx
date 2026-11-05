export type SiteProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  stock: number | null;
};

const naira = (n: number) => '₦' + Number(n).toLocaleString('en-NG');

export default function SiteProducts({ products }: { products: SiteProduct[] }) {
  if (products.length === 0) return null;

  const groups = new Map<string, SiteProduct[]>();
  for (const pr of products) {
    const key = pr.category?.trim() || 'Products';
    groups.set(key, [...(groups.get(key) ?? []), pr]);
  }

  return (
    <section id="products" className="bg-white px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-slate-900">Products</h2>
        {[...groups.entries()].map(([category, items]) => (
          <div key={category} className="mt-8">
            {groups.size > 1 && (
              <h3 className="mb-4 text-lg font-semibold text-slate-700">{category}</h3>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((pr) => {
                const soldOut = pr.stock !== null && pr.stock <= 0;
                return (
                  <div key={pr.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="relative aspect-square bg-slate-100">
                      {pr.photo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pr.photo_url} alt={pr.name} className="h-full w-full object-cover" />
                      )}
                      {soldOut && (
                        <span className="absolute left-2 top-2 rounded-full bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                          Sold out
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-slate-900">{pr.name}</p>
                      {pr.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">{pr.description}</p>
                      )}
                      <p className="mt-2 font-bold text-slate-900">{naira(pr.price)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}