// All the pictures of a product, main one first, with duplicates and unsafe addresses removed.
type Pics = { photo_url?: string | null; image_url?: string | null; images?: unknown };

export function galleryOf(p: Pics, max = 12): string[] {
  const raw: unknown[] = [p.photo_url, p.image_url, ...(Array.isArray(p.images) ? p.images : [])];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const u = v.trim();
    if (!u || u.length > 2000) continue;
    if (!/^https:\/\//i.test(u) && !u.startsWith('/')) continue; // no javascript:, data: or plain http pictures
    if (u.startsWith('//')) continue;
    if (!out.includes(u)) out.push(u);
    if (out.length >= max) break;
  }
  return out;
}
