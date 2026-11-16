export type FieldType =
  | 'text'
  | 'long_text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'url'
  | 'color';

export const fieldTypes: { id: FieldType; label: string }[] = [
  { id: 'text', label: 'Single line text' },
  { id: 'long_text', label: 'Multi-line text' },
  { id: 'number', label: 'Number' },
  { id: 'boolean', label: 'True or false' },
  { id: 'date', label: 'Date' },
  { id: 'url', label: 'Link (URL)' },
  { id: 'color', label: 'Color' },
];

export type FieldDefinition = {
  id: string;
  name: string;
  key: string;
  type: FieldType;
  is_list: boolean;
  description: string | null;
  show_on_site: boolean;
  categories: string[];
};

// What a form input holds: checkboxes hold booleans, everything else holds text.
export type FieldInput = string | boolean;

export function slugifyKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// A field with no categories applies to every product.
export function appliesTo(def: FieldDefinition, category: string | null | undefined): boolean {
  if (!def.categories || def.categories.length === 0) return true;
  const c = (category ?? '').trim().toLowerCase();
  return def.categories.some((x) => x.trim().toLowerCase() === c);
}

// Saved value -> form input.
export function toInput(def: FieldDefinition, raw: unknown): FieldInput {
  if (def.type === 'boolean') return raw === true;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw === null || raw === undefined) return '';
  return String(raw);
}

// Form input -> value to save. Returns undefined when there is nothing to save.
export function fromInput(def: FieldDefinition, input: FieldInput | undefined): unknown {
  if (def.type === 'boolean') return input === true;

  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return undefined;

  if (def.is_list) {
    const parts = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (def.type === 'number') {
      const nums = parts.map(Number).filter((n) => Number.isFinite(n));
      return nums.length ? nums : undefined;
    }
    return parts.length ? parts : undefined;
  }

  if (def.type === 'number') {
    const n = Number(text);
    return Number.isFinite(n) ? n : undefined;
  }
  return text;
}

// A saved value as a list of single values (empty when nothing is saved).
export function valueList(raw: unknown): unknown[] {
  if (raw === undefined || raw === null || raw === '') return [];
  return Array.isArray(raw) ? raw : [raw];
}
