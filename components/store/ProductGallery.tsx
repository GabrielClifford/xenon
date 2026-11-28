'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// the product photos: big picture with arrows and swipe, a row of small pictures, and a full-screen view
export default function ProductGallery({ pics, name, badge }: { pics: string[]; name: string; badge?: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const touch = useRef<number | null>(null);
  const n = pics.length;
  const cur = Math.min(i, Math.max(0, n - 1));
  const go = (k: number) => setI(((k % n) + n) % n);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoom(false);
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % n);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [zoom, n]);

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => { touch.current = e.touches[0].clientX; },
    onTouchEnd: (e: React.TouchEvent) => { const s = touch.current; touch.current = null; if (s === null || n < 2) return; const dx = e.changedTouches[0].clientX - s; if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1)); },
  };

  return (
    <div className="md:sticky md:top-6 md:self-start">
      <div className="xs-media relative aspect-[3/4] overflow-hidden" {...swipe}>
        {n > 0 && (
          <button type="button" onClick={() => setZoom(true)} aria-label="View larger" className="block h-full w-full cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pics[cur]} alt={n > 1 ? `${name}, photo ${cur + 1} of ${n}` : name} className="h-full w-full object-cover object-top" />
          </button>
        )}
        {badge}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(cur - 1)} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-black shadow hover:bg-white"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(cur + 1)} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-black shadow hover:bg-white"><ChevronRight className="h-5 w-5" /></button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white" aria-hidden>{cur + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {pics.map((src, k) => (
            <li key={src} className="shrink-0">
              <button type="button" onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`} aria-current={k === cur} className="block h-16 w-14 overflow-hidden border-2 sm:h-20 sm:w-16" style={{ borderColor: k === cur ? 'var(--xs-text)' : 'transparent', opacity: k === cur ? 1 : 0.65 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {zoom && n > 0 && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`${name} photos`} onClick={() => setZoom(false)} {...swipe}>
          <button type="button" onClick={() => setZoom(false)} aria-label="Close" className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/30"><X className="h-6 w-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pics[cur]} alt={name} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          {n > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(cur - 1); }} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30"><ChevronLeft className="h-6 w-6" /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); go(cur + 1); }} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/30"><ChevronRight className="h-6 w-6" /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
