'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSafeLink, readFields, type Def, type Entry, type FDef, type Val } from '@/lib/metaobjects';

function show(f: FDef, v: Val | undefined) {
  if (v === undefined || v === '') return null;
  switch (f.type) {
    case 'boolean':
      return v === true ? 'Yes' : 'No';
    case 'date': {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    case 'link':
      return isSafeLink(String(v)) ? (
        <a href={String(v)} target="_blank" rel="noopener noreferrer" className="underline">{String(v).replace(/^https?:\/\//i, '')}</a>
      ) : null;
    case 'color':
      return (
        <span className="inline-flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded border border-slate-300" style={{ background: String(v) }} />
          {String(v)}
        </span>
      );
    case 'number':
      return Number(v).toLocaleString('en-NG');
    default:
      return <span className="whitespace-pre-line">{String(v)}</span>;
  }
}

export default function MetaobjectsSection({ businessId }: { businessId: string }) {
  const [defs, setDefs] = useState<Def[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      const { data: d } = await sb.from('metaobject_definitions').select('*').eq('business_id', businessId).eq('show_on_site', true).order('created_at');
      const list = ((d ?? []) as Def[]).map((x) => ({ ...x, fields: readFields(x.fields) }));
      if (list.length === 0) return;
      const { data: e } = await sb
        .from('metaobject_entries')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'active')
        .in('definition_id', list.map((x) => x.id))
        .order('created_at', { ascending: true });
      setDefs(list);
      setEntries((e ?? []) as Entry[]);
    })();
  }, [businessId]);

  const visible = defs.filter((d) => entries.some((e) => e.definition_id === d.id));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((d) => (
        <section key={d.id} className="mx-auto max-w-5xl px-5 py-10">
          <h2 className="text-2xl font-bold">{d.name}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {entries
              .filter((e) => e.definition_id === d.id)
              .map((e) => (
                <div key={e.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
                  {d.fields.map((f, i) => {
                    const out = show(f, e.values[f.key]);
                    if (out === null) return null;
                    return i === 0 ? (
                      <p key={f.key} className="text-base font-semibold">{out}</p>
                    ) : (
                      <p key={f.key} className="mt-1.5 text-sm text-slate-600">
                        {f.type === 'boolean' || f.type === 'color' || f.type === 'date' || f.type === 'number' ? <span className="text-slate-400">{f.label}: </span> : null}
                        {out}
                      </p>
                    );
                  })}
                </div>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
