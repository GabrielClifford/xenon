import { createClient } from '@supabase/supabase-js';

import { readPrefs, type StorePrefs } from './prefs';
export { readPrefs };
export type { StorePrefs };

export const cookieName = (slug: string) => `xs_${slug.replace(/[^a-z0-9]/gi, '_')}`;

export function anon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}

export async function tokenOk(slug: string, token: string | undefined): Promise<boolean> {
  const { data, error } = await anon().rpc('xenon_store_token_ok', { p_slug: slug, p_token: token ?? null });
  return error ? false : data === true;
}
