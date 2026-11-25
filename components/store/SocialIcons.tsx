// Simple social icons drawn here, because lucide-react no longer ships brand icons.
type P = { className?: string; strokeWidth?: number };
const base = (w = 2) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const Instagram = ({ className, strokeWidth }: P) => (
  <svg {...base(strokeWidth)} className={className}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>
);
export const Facebook = ({ className, strokeWidth }: P) => (
  <svg {...base(strokeWidth)} className={className}><path d="M14 8.5V7c0-.8.2-1.2 1.3-1.2H17V3h-2.5C11.8 3 10.5 4.6 10.5 6.8v1.7H8v3h2.5V21H14v-9.5h2.6l.4-3H14z" fill="currentColor" stroke="none" /></svg>
);
export const Youtube = ({ className, strokeWidth }: P) => (
  <svg {...base(strokeWidth)} className={className}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" /></svg>
);
