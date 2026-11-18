'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, ChevronRight, Copy, Minus, Plus, Search, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  cleanPermissions,
  defaultRoles,
  keysFor,
  permissionGroups,
  togglePerm,
  type DefaultRole,
  type RoleCategory,
} from '@/lib/roles/permissions';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const field = 'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500';
const label = 'mb-1 block text-sm font-medium text-slate-700';
const primary = 'rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50';
const ghost = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const danger = 'rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50';

type Role = {
  key: string; // Xenon role key, or the database id for roles you created
  name: string;
  description: string;
  category: RoleCategory;
  permissions: string[];
  managed: boolean;
  summary?: DefaultRole['summary'];
};
type StaffRow = { id: string; email: string; role_key: string; status: 'invited' | 'active'; owner?: boolean };
type Screen = { s: 'list' } | { s: 'edit'; key: string } | { s: 'new'; from?: Role };
type Sort = 'az' | 'za' | 'staff';

const catText = (c: RoleCategory) => (c === 'organization' ? 'Organization' : 'Store');
const sortText: Record<Sort, string> = { az: 'Name A to Z', za: 'Name Z to A', staff: 'Most staff' };

/* ------------------------------ Entry point ------------------------------ */

// Use as <Roles user={user} /> in Settings.
export default function Roles({ user }: { user: { id: string; email?: string | null } }) {
  const [bid, setBid] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    createClient()
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: { id: string } | null }) => {
        if (data?.id) setBid(data.id);
        else setMissing(true);
      });
  }, [user.id]);

  if (missing) return <p className="text-sm text-slate-600">Create your business first, then you can manage roles here.</p>;
  if (!bid)
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200" />
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  return <RolesInner businessId={bid} ownerEmail={user.email ?? 'You'} />;
}

function RolesInner({ businessId, ownerEmail }: { businessId: string; ownerEmail: string }) {
  const [custom, setCustom] = useState<Role[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>({ s: 'list' });

  const load = useCallback(async () => {
    const sb = createClient();
    const [r, s] = await Promise.all([
      sb.from('business_roles').select('id,name,description,category,permissions').eq('business_id', businessId),
      sb.from('business_staff').select('id,email,role_key,status').eq('business_id', businessId),
    ]);
    const err = r.error ?? s.error;
    setError(err ? (/business_(roles|staff)/.test(err.message) ? 'Run roles.sql in Supabase first.' : err.message) : '');
    setCustom(
      ((r.data ?? []) as { id: string; name: string; description: string; category: RoleCategory; permissions: string[] }[]).map((x) => ({
        key: x.id,
        name: x.name,
        description: x.description ?? '',
        category: x.category,
        permissions: x.permissions ?? [],
        managed: false,
      }))
    );
    setStaff((s.data ?? []) as StaffRow[]);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const roles = useMemo<Role[]>(() => [...defaultRoles.map((d) => ({ ...d, managed: true })), ...custom], [custom]);

  // The owner always counts as an Administrator.
  const staffOf = useCallback(
    (key: string): StaffRow[] => {
      const rows = staff.filter((x) => x.role_key === key);
      return key === 'administrator' ? [{ id: 'owner', email: ownerEmail, role_key: key, status: 'active', owner: true }, ...rows] : rows;
    },
    [staff, ownerEmail]
  );

  const back = () => {
    setScreen({ s: 'list' });
    load();
  };

  if (screen.s === 'new') {
    return <RoleEditor key="new" businessId={businessId} role={null} template={screen.from} roles={roles} people={[]} onBack={back} onDuplicate={(r) => setScreen({ s: 'new', from: r })} />;
  }
  if (screen.s === 'edit') {
    const role = roles.find((r) => r.key === screen.key);
    if (role) {
      return <RoleEditor key={role.key} businessId={businessId} role={role} roles={roles} people={staffOf(role.key)} onBack={back} onDuplicate={(r) => setScreen({ s: 'new', from: r })} />;
    }
  }

  return <RoleList roles={roles} countOf={(k) => staffOf(k).length} loading={loading} error={error} onOpen={(k) => setScreen({ s: 'edit', key: k })} onAdd={() => setScreen({ s: 'new' })} />;
}

/* -------------------------------- Role list ------------------------------ */

function RoleList({
  roles,
  countOf,
  loading,
  error,
  onOpen,
  onAdd,
}: {
  roles: Role[];
  countOf: (key: string) => number;
  loading: boolean;
  error: string;
  onOpen: (key: string) => void;
  onAdd: () => void;
}) {
  const [filter, setFilter] = useState<'all' | RoleCategory>('all');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<Sort>('az');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = roles.filter((r) => (filter === 'all' || r.category === filter) && (!needle || r.name.toLowerCase().includes(needle)));
    return [...list].sort((a, b) => {
      if (sort === 'staff') return countOf(b.key) - countOf(a.key) || a.name.localeCompare(b.name);
      return sort === 'za' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });
  }, [roles, filter, q, sort, countOf]);

  const nextSort = () => setSort(sort === 'az' ? 'za' : sort === 'za' ? 'staff' : 'az');
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${on ? 'bg-slate-200 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">Roles</h2>
        <button className={primary} onClick={onAdd}>
          <Plus size={14} className="mr-1 inline" />
          Add role
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className={`${card} p-0`}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <div className="flex flex-1 flex-wrap gap-1">
            <button className={chip(filter === 'all')} onClick={() => setFilter('all')}>
              All
            </button>
            <button className={chip(filter === 'store')} onClick={() => setFilter('store')}>
              Store
            </button>
            <button className={chip(filter === 'organization')} onClick={() => setFilter('organization')}>
              Organization
            </button>
          </div>
          <button aria-label="Search roles" title="Search roles" onClick={() => setSearching((v) => !v)} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
            <Search size={16} />
          </button>
          <button aria-label={`Sort: ${sortText[sort]}`} title={`Sort: ${sortText[sort]} (tap to change)`} onClick={nextSort} className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200">
            <ArrowUpDown size={16} />
          </button>
        </div>
        {searching && (
          <div className="border-b border-slate-100 p-3">
            <input autoFocus className={field} placeholder="Search roles" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <p className="px-5 pt-3 text-xs text-slate-400">Sorted by {sortText[sort].toLowerCase()}</p>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No roles match.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.key}>
                <button onClick={() => onOpen(r.key)} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">
                      {catText(r.category)} · {countOf(r.key)} staff
                    </p>
                  </div>
                  {r.managed && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">Xenon role</span>}
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Role editor ----------------------------- */

const sig = (name: string, description: string, category: RoleCategory, selected: Set<string>) => JSON.stringify([name, description, category, [...selected].sort()]);

function RoleEditor({
  businessId,
  role,
  template,
  roles,
  people,
  onBack,
  onDuplicate,
}: {
  businessId: string;
  role: Role | null;
  template?: Role;
  roles: Role[];
  people: StaffRow[];
  onBack: () => void;
  onDuplicate: (r: Role) => void;
}) {
  const start = role ?? template ?? null;
  const [name, setName] = useState(role ? role.name : template ? `Copy of ${template.name}`.slice(0, 255) : '');
  const [description, setDescription] = useState(start?.description ?? '');
  const [category, setCategory] = useState<RoleCategory>(start?.category ?? 'store');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(cleanPermissions(start?.category ?? 'store', start?.permissions ?? [])));
  const [initial, setInitial] = useState(() => (role ? sig(role.name, role.description, role.category, new Set(role.permissions)) : sig('', '', 'store', new Set())));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const readOnly = !!role?.managed;
  const dirty = !readOnly && sig(name, description, category, selected) !== initial;

  const leave = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onBack();
  };

  const changeCategory = (c: RoleCategory) => {
    setCategory(c);
    setSelected(new Set(cleanPermissions(c, [...selected])));
  };

  async function save() {
    setErr('');
    setMsg('');
    const nm = name.trim();
    if (!nm) return setErr('Give the role a name.');
    if (nm.length > 255) return setErr('The name is too long (255 characters max).');
    if (description.trim().length > 255) return setErr('The description is too long (255 characters max).');
    if (roles.some((r) => r.key !== role?.key && r.name.toLowerCase() === nm.toLowerCase())) return setErr('A role with that name already exists.');
    const permissions = cleanPermissions(category, [...selected]);
    if (permissions.length === 0) return setErr('Choose at least one permission.');

    setBusy(true);
    const sb = createClient();
    const values = { name: nm, description: description.trim(), category, permissions, updated_at: new Date().toISOString() };
    const res = role
      ? await sb.from('business_roles').update(values).eq('id', role.key).eq('business_id', businessId)
      : await sb.from('business_roles').insert({ ...values, business_id: businessId });
    setBusy(false);
    if (res.error) return setErr(/duplicate|unique/i.test(res.error.message) ? 'A role with that name already exists.' : res.error.message);
    setInitial(sig(nm, description.trim(), category, new Set(permissions)));
    setMsg('Saved.');
    setTimeout(onBack, 500);
  }

  async function remove() {
    if (!role || role.managed) return;
    setBusy(true);
    const { error } = await createClient().from('business_roles').delete().eq('id', role.key).eq('business_id', businessId);
    setBusy(false);
    if (error) return setErr(error.message);
    onBack();
  }

  const title = role ? role.name : 'Add role';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button className={ghost} onClick={leave}>
          <ArrowLeft size={14} className="mr-1 inline" />
          Back
        </button>
        <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-slate-900">{title}</h2>
        {role && (
          <button className={ghost} onClick={() => onDuplicate(role)}>
            <Copy size={14} className="mr-1 inline" />
            Duplicate
          </button>
        )}
      </div>

      {readOnly && (
        <div className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">Role managed by Xenon</p>
          <p className="mt-1">{role?.description} You can&apos;t change this role, but you can duplicate it and edit the copy.</p>
        </div>
      )}

      {role?.summary ? (
        <>
          <div className={card}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Privileges</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {role.summary.privileges.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Limitations</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {role.summary.limitations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className={`${card} space-y-4`}>
            <div>
              <div className="flex items-baseline justify-between">
                <label className={label}>Name</label>
                <span className="text-xs text-slate-400">{name.length}/255</span>
              </div>
              <input className={field} value={name} maxLength={255} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label className={label}>Description</label>
                <span className="text-xs text-slate-400">{description.length}/255</span>
              </div>
              <textarea className={`${field} h-20`} value={description} maxLength={255} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <h3 className="text-base font-semibold text-slate-900">Permissions</h3>
          <div className={`${card} space-y-4`}>
            <div>
              <label className={label}>Role category</label>
              <select className={field} value={category} disabled={!!role} onChange={(e) => changeCategory(e.target.value as RoleCategory)}>
                <option value="store">Store</option>
                <option value="organization">Organization</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {role ? 'A role keeps its category once it is created.' : 'Store roles run the shop. Organization roles can also manage users, roles, plan and billing.'}
              </p>
            </div>
            <PermissionTree category={category} selected={selected} onChange={setSelected} readOnly={readOnly} />
          </div>
        </>
      )}

      {role && (
        <div className={card}>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Staff with this role ({people.length})</h3>
          {people.length === 0 ? (
            <p className="text-sm text-slate-500">Nobody has this role yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-slate-800">{p.email}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{p.owner ? 'Owner' : p.status === 'invited' ? 'Invited' : 'Active'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button className={primary} disabled={busy || (!!role && !dirty)} onClick={save}>
            {busy ? 'Saving...' : role ? 'Save' : 'Create role'}
          </button>
          {role &&
            (confirmDelete ? (
              <span className="ml-auto flex items-center gap-2 text-sm">
                Delete this role?
                <button className={danger} disabled={busy} onClick={remove}>
                  Yes, delete
                </button>
                <button className={ghost} onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className={`${danger} ml-auto`} disabled={busy || people.length > 0} title={people.length > 0 ? 'Move staff to another role first' : undefined} onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} className="mr-1 inline" />
                Delete
              </button>
            ))}
        </div>
      )}
      {!readOnly && role && people.length > 0 && <p className="text-xs text-slate-500">This role can&apos;t be deleted while staff have it.</p>}
    </div>
  );
}

/* ----------------------------- Permission tree --------------------------- */

type Tri = 'all' | 'some' | 'none';

function Box({ state, onClick, text, disabled }: { state: Tri; onClick: () => void; text: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? true : state === 'some' ? 'mixed' : false}
      aria-label={text}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${state === 'none' ? 'border-slate-300 bg-white' : 'border-slate-900 bg-slate-900 text-white'} disabled:opacity-60`}
    >
      {state === 'all' && <Check size={14} />}
      {state === 'some' && <Minus size={14} />}
    </button>
  );
}

const tri = (n: number, total: number): Tri => (n === 0 ? 'none' : n === total ? 'all' : 'some');

function PermissionTree({
  category,
  selected,
  onChange,
  readOnly,
}: {
  category: RoleCategory;
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  readOnly: boolean;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const query = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const allowed = new Set(keysFor(category));
    return permissionGroups
      .map((g) => {
        const base = g.perms.filter((x) => allowed.has(x.key));
        const shown = query ? base.filter((x) => x.label.toLowerCase().includes(query) || g.label.toLowerCase().includes(query)) : base;
        return { g, base, shown };
      })
      .filter((x) => x.shown.length > 0);
  }, [category, query]);

  const everything = groups.flatMap((x) => x.base);
  const isOpen = (id: string) => !!query || open.has(id);
  const allOpen = groups.length > 0 && groups.every((x) => isOpen(x.g.id));

  const setMany = (keys: string[], on: boolean) => {
    let next = new Set(selected);
    for (const k of keys) next = togglePerm(next, k, on);
    onChange(next);
  };
  const flip = (id: string) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpen(next);
  };

  const total = everything.filter((x) => selected.has(x.key)).length;
  const topState = tri(total, everything.length);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Search size={16} className="text-slate-400" />
        <input className="w-full bg-transparent py-1 text-sm outline-none" placeholder="Search permissions" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="flex items-center gap-3 bg-slate-50 px-3 py-3">
        <Box
          state={topState}
          text="Select all permissions"
          disabled={readOnly}
          onClick={() =>
            setMany(
              everything.map((x) => x.key),
              topState !== 'all'
            )
          }
        />
        <span className="flex-1 text-sm font-semibold text-slate-900">Select all permissions</span>
        <button type="button" className="text-sm font-medium text-blue-700 hover:underline disabled:opacity-50" disabled={!!query} onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((x) => x.g.id)))}>
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {groups.length === 0 && <p className="p-4 text-sm text-slate-500">No permissions match.</p>}

      <ul className="divide-y divide-slate-100">
        {groups.map(({ g, base, shown }) => {
          const n = base.filter((x) => selected.has(x.key)).length;
          const state = tri(n, base.length);
          return (
            <li key={g.id} className="bg-slate-50/60">
              <div className="flex items-center gap-3 px-3 py-3">
                <Box
                  state={state}
                  text={g.label}
                  disabled={readOnly}
                  onClick={() =>
                    setMany(
                      base.map((x) => x.key),
                      state !== 'all'
                    )
                  }
                />
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => flip(g.id)}>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{g.label}</span>
                  <span className="text-sm text-slate-600">
                    {n}/{base.length}
                  </span>
                  {isOpen(g.id) ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                </button>
              </div>
              {isOpen(g.id) && (
                <ul className="space-y-2 bg-white px-3 pb-3 pl-11 pt-2">
                  {shown.map((x) => (
                    <li key={x.key} className="flex items-center gap-3">
                      <Box state={selected.has(x.key) ? 'all' : 'none'} text={x.label} disabled={readOnly} onClick={() => setMany([x.key], !selected.has(x.key))} />
                      <span className="text-sm text-slate-800">{x.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
