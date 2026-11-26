'use client';

import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { SECTION_HINTS, SECTION_LABELS, type SectionType } from '@/lib/store/theme';

// Shopify-style "Add section": a searchable list of the section types this group accepts
export default function AddSection({ types, onPick, label = 'Add section' }: { types: SectionType[]; onPick: (t: SectionType) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  if (types.length === 0) return null;
  const list = types.filter((t) => `${SECTION_LABELS[t]} ${SECTION_HINTS[t] ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="mt-1">
      <button onClick={() => { setOpen((o) => !o); setQ(''); }} aria-expanded={open} className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50"><Plus className="h-4 w-4" />{label}</button>
      {open && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white shadow-sm">
          <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sections" className="w-full text-sm outline-none" aria-label="Search sections" /></label>
          <ul className="max-h-72 overflow-y-auto py-1">
            {list.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No section matches.</li>}
            {list.map((t) => (
              <li key={t}><button onClick={() => { onPick(t); setOpen(false); setQ(''); }} className="block w-full px-3 py-2 text-left hover:bg-slate-50"><span className="block text-sm font-medium text-slate-900">{SECTION_LABELS[t]}</span>{SECTION_HINTS[t] && <span className="block text-xs text-slate-500">{SECTION_HINTS[t]}</span>}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
