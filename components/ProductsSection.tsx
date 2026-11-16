'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { appliesTo, valueList, type FieldDefinition } from '@/lib/customFields';

type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  available: boolean;
  custom_fields: Record<string, unknown> | null;
};

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

// Turns a Nigerian number like 0803 123 4567 into 2348031234567 for wa.me links.
function whatsappNumber(phone?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return `234${digits.slice(1)}`;
  return digits;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function Single({ def, value }: { def: FieldDefinition; value: unknown }) {
  const s = String(value);
  if (def.type === 'boolean') return <>{value === true ? 'Yes' : 'No'}</>;
  if (def.type === 'number') return <>{Number(value).toLocaleString('en-NG')}</>;
  if (def.type === 'date') {
    const d = new Date(s);
    return <>{Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-NG')}</>;
  }
  if (def.type === 'url' && /^https?:\/\//i.test(s)) {
    return (
      <a href={s} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
        {s}
      </a>
    );
  }
  if (def.type === 'color' && HEX.test(s)) {
    return (
      <>
        <span
          className="mr-1 inline-block h-3 w-3 rounded-full border border-slate-300 align-middle"
          style={{ backgroundColor: s }}
        />
        {s}
      </>
    );
  }
  return <>{s}</>;
}

export default function ProductsSection({
  businessId,
  businessName,
  phone,
}: {
  businessId: string;
  businessName: string;
  phone?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [defs, setDefs] = useState<FieldDefinition[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from('products')
        .select('id,name,description,price,category,image_url,available,custom_fields')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('field_definitions')
        .select('id,name,key,type,is_list,description,show_on_site,categories')
        .eq('business_id', businessId)
        .eq('resource', 'product')
        .eq('show_on_site', true)
        .order('sort_order', { ascending: true }),
    ]).then(([prod, fields]) => {
      if (!active) return;
      setItems((prod.data ?? []) as Item[]);
      setDefs((fields.data ?? []) as FieldDefinition[]);
    });
    return () => {
      active = false;
    };
  }, [supabase, businessId]);

  if (items.length === 0) return null;

  const wa = whatsappNumber(phone);

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.category?.trim() || '';
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }

  return (
    <section id="products" className="bg-white px-5 py-14 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Products</h2>

        {Array.from(groups.entries()).map(([category, list]) => (
          <div key={category || 'all'} className="mt-8">
            {category && <h3 className="mb-4 text-lg font-semibold text-slate-700">{category}</h3>}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => {
                const rows = defs
                  .filter((d) => appliesTo(d, p.category))
                  .map((d) => ({ d, vals: valueList(p.custom_fields?.[d.key]) }))
                  .filter((r) => r.vals.length > 0);
                const message = `Hi ${businessName}, I'd like to order ${p.name} (${naira(p.price)}).`;

                return (
                  <article
                    key={p.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.name}
                        loading="lazy"
                        className="h-48 w-full object-cover"
                      />
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold">{p.name}</h4>
                        <span className="shrink-0 font-bold text-blue-600">{naira(p.price)}</span>
                      </div>
                      {p.description && (
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.description}</p>
                      )}

                      {rows.length > 0 && (
                        <dl className="mt-3 space-y-1 text-sm">
                          {rows.map(({ d, vals }) => (
                            <div key={d.id} className="flex gap-2">
                              <dt className="text-slate-500">{d.name}:</dt>
                              <dd className="text-slate-800">
                                {vals.map((v, i) => (
                                  <span key={i}>
                                    {i > 0 ? ', ' : ''}
                                    <Single def={d} value={v} />
                                  </span>
                                ))}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      <div className="mt-auto pt-4">
                        {!p.available ? (
                          <span className="inline-block rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">
                            Sold out
                          </span>
                        ) : wa ? (
                          <a
                            href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                          >
                            Order on WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
