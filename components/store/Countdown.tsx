'use client';

import { useEffect, useState } from 'react';

// Counts down to a date the owner picked (for flash sales, Black Friday, restocks). Starts empty so the server and browser agree.
export default function Countdown({ ends, endedText }: { ends: string; endedText: string }) {
  const target = ends ? new Date(ends.trim().replace(' ', 'T')).getTime() : NaN;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
