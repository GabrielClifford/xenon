import type { ReactNode } from 'react';
import { safeHref } from './theme';

// A small, safe markdown subset: # ## ###, **bold**, *italic*, [text](link), - lists, 1. lists, > quotes, ---
// Output is plain React elements (never raw HTML), so page text can't run scripts.

export type LinkCtx = { slug: string; trusted: string[] };

export function linkFor(href: string, ctx: LinkCtx): { href: string; external: boolean } {
  const h = safeHref(href, ctx.slug);
  if (!h) return { href: '#', external: false };
  if (/^https?:\/\//i.test(h)) {
    let host = '';
    try { host = new URL(h).hostname.toLowerCase(); } catch { return { href: '#', external: false }; }
    const ok = ctx.trusted.some((d) => host === d || host.endsWith('.' + d));
    return { href: ok ? h : `/b/${ctx.slug}/leave?to=${encodeURIComponent(h)}`, external: true };
  }
  return { href: h, external: false };
}

function inline(text: string, ctx: LinkCtx, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={`${key}b${i}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('*')) out.push(<em key={`${key}i${i}`}>{t.slice(1, -1)}</em>);
    else {
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!;
      const l = linkFor(mm[2], ctx);
      out.push(<a key={`${key}a${i}`} href={l.href} className="underline" {...(l.external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>{mm[1]}</a>);
    }
    last = m.index + t.length; i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, ctx }: { text: string; ctx: LinkCtx }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) {
      const lvl = m[1].length;
      const cls = lvl === 1 ? 'xs-h2' : lvl === 2 ? 'xs-h3' : 'xs-h4';
      blocks.push(<div key={k++} className={`${cls} mt-6 mb-2`} role="heading" aria-level={lvl + 1}>{inline(m[2], ctx, `h${k}`)}</div>);
      i++;
    } else if (/^---+$/.test(ln.trim())) {
      blocks.push(<hr key={k++} className="my-6" style={{ borderColor: 'var(--xs-border)' }} />); i++;
    } else if (/^>\s?/.test(ln)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={k++} className="my-4 border-l-4 pl-4 italic" style={{ borderColor: 'var(--xs-accent)' }}>{inline(buf.join(' '), ctx, `q${k}`)}</blockquote>);
    } else if (/^\s*[-*]\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(<ul key={k++} className="my-3 list-disc space-y-1 pl-6">{items.map((x, j) => <li key={j}>{inline(x, ctx, `u${k}${j}`)}</li>)}</ul>);
    } else if (/^\s*\d+[.)]\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push(<ol key={k++} className="my-3 list-decimal space-y-1 pl-6">{items.map((x, j) => <li key={j}>{inline(x, ctx, `o${k}${j}`)}</li>)}</ol>);
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|>|\s*[-*]\s+|\s*\d+[.)]\s+|---+$)/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++} className="my-3">{inline(buf.join(' '), ctx, `p${k}`)}</p>);
    }
  }
  return <div>{blocks}</div>;
}
