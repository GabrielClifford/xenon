// Turns a pasted video address into something safe to play. Only YouTube, Vimeo and direct video files are accepted.
export type VideoSrc = { kind: 'embed' | 'file'; src: string };

export function parseVideo(raw: unknown): VideoSrc | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (!v || v.length > 500) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const id = /^[\w-]{6,20}$/;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/);
    const vid = u.pathname === '/watch' ? u.searchParams.get('v') : m?.[1];
    return vid && id.test(vid) ? { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${vid}?rel=0&autoplay=1` } : null;
  }
  if (host === 'youtu.be') {
    const vid = u.pathname.slice(1).split('/')[0];
    return id.test(vid) ? { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${vid}?rel=0&autoplay=1` } : null;
  }
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(?:video\/)?(\d{5,12})/);
    return m ? { kind: 'embed', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1` } : null;
  }
  if (u.protocol === 'https:' && /\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: 'file', src: u.toString() };
  return null;
}
