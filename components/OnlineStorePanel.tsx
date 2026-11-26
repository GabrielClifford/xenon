'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { PageSkeleton } from '@/components/Skeleton';
import CreateStore from '@/components/store/admin/CreateStore';
import ThemesHome, { type Biz } from '@/components/store/admin/ThemesHome';
import ThemeEditor from '@/components/store/admin/ThemeEditor';
import PagesTab from '@/components/store/admin/PagesTab';
import PreferencesTab from '@/components/store/admin/PreferencesTab';

type Tab = 'themes' | 'pages' | 'preferences';
const TABS: [Tab, string][] = [['themes', 'Themes'], ['pages', 'Pages'], ['preferences', 'Preferences']];

export default function OnlineStorePanel({ user }: { user: User }) {
  const supabase = useMemo(() => createClient(), []);
  const [biz, setBiz] = useState<Biz | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('themes');
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('businesses').select('id, slug, name, published, phone, bank_name, store_prefs').eq('owner_id', user.id).maybeSingle();
    setBiz((data as Biz | null) ?? null);
  }, [supabase, user.id]);
  useEffect(() => { load(); }, [load]);

  if (biz === undefined) return <PageSkeleton />;

  if (biz === null) return <CreateStore user={user} onCreated={load} />;

  if (editing) return <ThemeEditor themeId={editing} businessId={biz.id} onBack={() => setEditing(null)} />;

  return (
    <div>
      <h1 className="text-2xl font-bold">Online Store</h1>
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold ${tab === k ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-5">
        {tab === 'themes' && <ThemesHome biz={biz} onEdit={setEditing} onBizChanged={load} goTab={setTab} />}
        {tab === 'pages' && <PagesTab biz={biz} />}
        {tab === 'preferences' && <PreferencesTab biz={biz} onSaved={load} />}
      </div>
    </div>
  );
}
