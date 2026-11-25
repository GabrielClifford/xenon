'use client';

import { useEffect, useState } from 'react';

// Counts down to a date the owner picked (for flash sales, Black Friday, restocks). Starts empty so the server and browser agree.
export default function Countdown({ ends, endedText = '', compact = false, boxes = false, lead = false, label = '' }: { ends: string; endedText?: string; compact?: boolean; boxes?: boolean; lead?: boolean; label?: string }) {
  const target = ends ? new Date(ends.trim().replace(' ', 'T')).getTime() : NaN;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (compact || boxes) {
    if (!Number.isFinite(target) || now === null) return null;
    const l = target - now;
    if (l <= 0) return null;
    const dd = Math.floor(l / 86400000); const hh = Math.floor((l % 86400000) / 3600000); const mm = Math.floor((l % 3600000) / 60000); const ss = Math.floor((l % 60000) / 1000);
    const p2 = (n: number) => String(n).padStart(2, '0');
    if (boxes) {
      const cell = (n: number, lab: string) => <span className="flex min-w-12 flex-col items-center bg-white/90 px-2 py-1.5 text-black"><span className="text-lg font-bold tabular-nums leading-none">{p2(n)}</span><span className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest">{lab}</span></span>;
      return <div className="mt-5">{label && <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.3em] opacity-90">{label}</span>}<span className="inline-flex gap-1.5" role="timer" aria-label="Time left">{dd > 0 && cell(dd, 'Days')}{cell(hh, 'Hrs')}{cell(mm, 'Min')}{cell(ss, 'Sec')}</span></div>;
    }
    return <>{lead && <span className="mx-3 opacity-50">|</span>}<span className="font-bold tabular-nums" role="timer" aria-label="Time left">{dd > 0 ? `${dd}D ` : ''}{p2(hh)}H {p2(mm)}M {p2(ss)}S</span></>;
  }
  if (!Number.isFinite(target)) return <p className="mt-3 text-sm opacity-80">Set an end date in the editor.</p>;
  if (now === null) return <div className="mt-3 h-14" />;
  const left = target - now;
  if (left <= 0) return <p className="mt-3 text-lg font-semibold">{endedText}</p>;
  const d = Math.floor(left / 86400000); const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000); const sec = Math.floor((left % 60000) / 1000);
  const box = (n: number, l: string) => (
    <div className="min-w-16 px-2"><p className="text-3xl font-semibold tabular-nums sm:text-4xl">{String(n).padStart(2, '0')}</p><p className="text-[10px] uppercase tracking-widest opacity-80">{l}</p></div>
  );
  return <div className="mt-3 flex justify-center" role="timer" aria-label="Time left">{box(d, 'Days')}{box(h, 'Hours')}{box(m, 'Mins')}{box(sec, 'Secs')}</div>;
}
