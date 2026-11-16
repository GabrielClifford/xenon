export type FType = 'text' | 'multiline' | 'number' | 'boolean' | 'date' | 'link' | 'color';

export type FDef = { key: string; label: string; type: FType };

export type Def = {
  id: string;
  business_id: string;
  name: string;
  handle: string;
  fields: FDef[];
  show_on_site: boolean;
};

export type Val = string | number | boolean;

export type Entry = {
  id: string;
  definition_id: string;
  handle: string;
  status: 'active' | 'draft';
  values: Record<string, Val>;
  created_at: string;
};

export const typeOptions: { v: FType; t: string }[] = [
  { v: 'text', t: 'Single-line text' },
  { v: 'multiline', t: 'Multi-line text' },
  { v: 'number', t: 'Number' },
  { v: 'boolean', t: 'True or false' },
  { v: 'date', t: 'Date' },
  { v: 'link', t: 'Link' },
  { v: 'color', t: 'Color' },
];

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function readFields(raw: unknown): FDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f) => f && typeof f.key === 'string' && typeof f.label === 'string')
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: typeOptions.some((o) => o.v === f.type) ? f.type : 'text',
    })) as FDef[];
}

export function entryTitle(def: Def, e: Entry): string {
  const first = def.fields[0];
  const v = first ? e.values[first.key] : undefined;
  return v === undefined || v === '' ? 'Untitled' : String(v);
}

export function isSafeLink(v: string): boolean {
  return /^https?:\/\//i.test(v.trim());
}
