'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  fieldTypes,
  slugifyKey,
  type FieldDefinition,
  type FieldType,
} from '@/lib/customFields';

type FormState = {
  name: string;
  type: FieldType;
  isList: boolean;
  description: string;
  categories: string;
  showOnSite: boolean;
};

const emptyForm: FormState = {
  name: '',
  type: 'text',
  isList: false,
  description: '',
  categories: '',
  showOnSite: true,
};

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-400';

const typeLabel = (t: FieldType) => fieldTypes.find((x) => x.id === t)?.label ?? t;

export default function CustomFieldsPanel({ businessId }: { businessId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [defs, setDefs] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('field_definitions')
      .select('id,name,key,type,is_list,description,show_on_site,categories')
      .eq('business_id', businessId)
      .eq('resource', 'product')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) setErrorMsg(error.message);
    else setDefs((data ?? []) as FieldDefinition[]);
    setLoading(false);
  }, [supabase, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(d: FieldDefinition) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      type: d.type,
      isList: d.is_list,
      description: d.description ?? '',
      categories: (d.categories ?? []).join(', '),
      showOnSite: d.show_on_site,
    });
    setErrorMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    const name = form.name.trim();
    const key = slugifyKey(name);
    if (!name || !key) {
      setErrorMsg('Enter a name using letters or numbers.');
      return;
    }

    const categories = form.categories
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    setSaving(true);
    const shared = {
      name,
      description: form.description.trim() || null,
      show_on_site: form.showOnSite,
      categories,
    };

    const { error } = editingId
      ? await supabase.from('field_definitions').update(shared).eq('id', editingId)
      : await supabase.from('field_definitions').insert({
          ...shared,
          business_id: businessId,
          resource: 'product',
          key,
          type: form.type,
          is_list: form.type === 'boolean' ? false : form.isList,
          sort_order: defs.length,
        });
    setSaving(false);

    if (error) {
      setErrorMsg(
        error.code === '23505' ? 'You already have a field with that name.' : error.message
      );
      return;
    }
    resetForm();
    await load();
  }

  async function remove(d: FieldDefinition) {
    if (
      !window.confirm(
        `Delete "${d.name}"? Values already saved on products will no longer be shown.`
      )
    )
      return;
    const { error } = await supabase.from('field_definitions').delete().eq('id', d.id);
    if (error) setErrorMsg(error.message);
    else {
      if (editingId === d.id) resetForm();
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Custom fields</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add extra details to your products, like size, material or spice level. Once a field is
          created, it appears when you add or edit a product.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="font-display font-bold text-slate-900">
          {editingId ? 'Edit field' : 'Add a field'}
        </p>

        <input
          required
          placeholder="Name, for example Material or Spice level"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className={field}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={form.type}
            disabled={!!editingId}
            onChange={(e) => {
              const type = e.target.value as FieldType;
              setForm({ ...form, type, isList: type === 'boolean' ? false : form.isList });
            }}
            className={field}
          >
            {fieldTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isList}
              disabled={!!editingId || form.type === 'boolean'}
              onChange={(e) => setForm({ ...form, isList: e.target.checked })}
            />
            Allow several values (a list)
          </label>
        </div>
        {editingId && (
          <p className="text-xs text-slate-400">
            The type and list setting can&apos;t be changed after a field is created.
          </p>
        )}

        <textarea
          rows={2}
          placeholder="Description (optional, shown as a hint when editing a product)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className={field}
        />

        <input
          placeholder="Only for these product categories (optional, separate with commas)"
          value={form.categories}
          onChange={(e) => setForm({ ...form, categories: e.target.value })}
          className={field}
        />
        <p className="-mt-1 text-xs text-slate-400">Leave empty to use it on every product.</p>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.showOnSite}
            onChange={(e) => setForm({ ...form, showOnSite: e.target.checked })}
          />
          Show this field on my website
        </label>
        <p className="text-xs text-slate-400">
          Don&apos;t store private information in custom fields. Anyone can read product data
          through your website, even for fields you don&apos;t display.
        </p>

        {errorMsg && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add field'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-5 text-sm text-slate-400">Loading fields...</p>
        ) : defs.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No custom fields yet. Add one above to get started.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {defs.map((d) => (
              <li key={d.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {typeLabel(d.type)}
                    {d.is_list ? ' · List' : ''}
                    {d.show_on_site ? ' · On website' : ' · Hidden'}
                    {d.categories && d.categories.length > 0
                      ? ` · ${d.categories.join(', ')}`
                      : ' · All products'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(d)}
                  aria-label={`Edit ${d.name}`}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(d)}
                  aria-label={`Delete ${d.name}`}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
