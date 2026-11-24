export type StorePrefs = { private: boolean; seoTitle: string; seoDescription: string; socialImage: string; noindex: boolean; trusted: string[] };

export function readPrefs(raw: unknown): StorePrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  const trusted = Array.isArray(r.trusted)
    ? (r.trusted as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter((x) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(x)).slice(0, 50)
    : [];
  return { private: r.private === true, seoTitle: str(r.seoTitle, 70), seoDescription: str(r.seoDescription, 320), socialImage: str(r.socialImage, 500), noindex: r.noindex === true, trusted };
}

