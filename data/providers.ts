export type Provider = {
  id: string;
  name: string;
  trade: string;
  area: string;
  city: string;
  rating: number;
  reviews: number;
  years: number;
  verified: boolean;
  priceFrom: number; // naira
  about: string;
    real?: boolean;
  photoUrl?: string | null;
};

export const trades = [
  'Electrician',
  'Plumber',
  'Generator Repair',
  'Phone Repair',
  'Tailor',
  'Cobbler',
  'Painter',
    'Carpenter',
  'Mechanic',
];

export const businessCategories = [
  'Restaurant & Food',
  'Beauty & Salon',
  'Fashion & Tailoring',
  'Retail & Shop',
  'Electronics & Phone Repair',
  'Home & Building Services',
  'Auto & Mechanics',
  'Health & Wellness',
  'Education & Training',
  'Events & Entertainment',
  'Professional Services',
  'Other',
];

export const areas = [
  'Choba',
  'GRA',
  'Rumuola',
  'Rumuokoro',
  'Eliozu',
  'Woji',
  'Trans Amadi',
  'Diobu',
];

export const formatPrice = (n: number) => `From ₦${n.toLocaleString('en-NG')}`;

// Sample providers for the demo. Replace them with real, verified artisans later.
export const providers: Provider[] = [
  { id: 'bright-spark-electricals', name: 'Bright Spark Electricals', trade: 'Electrician', area: 'Choba', city: 'Port Harcourt', rating: 4.8, reviews: 42, years: 8, verified: true, priceFrom: 5000, about: 'House wiring, fault finding, socket and light installation, and prepaid meter fixes.' },
  { id: 'rivers-power-works', name: 'Rivers Power Works', trade: 'Electrician', area: 'GRA', city: 'Port Harcourt', rating: 4.6, reviews: 27, years: 5, verified: true, priceFrom: 6000, about: 'Rewiring, inverter installation and distribution board upgrades for homes and shops.' },
  { id: 'steady-flow-plumbing', name: 'Steady Flow Plumbing', trade: 'Plumber', area: 'Rumuola', city: 'Port Harcourt', rating: 4.7, reviews: 35, years: 7, verified: true, priceFrom: 4000, about: 'Leak repairs, pipe fitting, water tanks, borehole connections and bathroom fittings.' },
  { id: 'clearway-plumbers', name: 'Clearway Plumbers', trade: 'Plumber', area: 'Eliozu', city: 'Port Harcourt', rating: 4.4, reviews: 19, years: 4, verified: false, priceFrom: 3500, about: 'Blocked drains, toilet and sink repairs, and new plumbing installations.' },
  { id: 'gen-fix-masters', name: 'GenFix Masters', trade: 'Generator Repair', area: 'Trans Amadi', city: 'Port Harcourt', rating: 4.9, reviews: 58, years: 11, verified: true, priceFrom: 8000, about: 'Servicing and repair of petrol and diesel generators, including carburettor and AVR faults.' },
  { id: 'powerup-gen-care', name: 'PowerUp Gen Care', trade: 'Generator Repair', area: 'Rumuokoro', city: 'Port Harcourt', rating: 4.5, reviews: 31, years: 6, verified: true, priceFrom: 7000, about: 'Routine servicing, oil changes and emergency generator repairs at your location.' },
  { id: 'quickfix-phone-lab', name: 'QuickFix Phone Lab', trade: 'Phone Repair', area: 'Choba', city: 'Port Harcourt', rating: 4.7, reviews: 64, years: 6, verified: true, priceFrom: 3000, about: 'Screen replacement, battery swaps, charging port repair and software fixes.' },
  { id: 'techcare-mobile', name: 'TechCare Mobile', trade: 'Phone Repair', area: 'Diobu', city: 'Port Harcourt', rating: 4.3, reviews: 22, years: 3, verified: false, priceFrom: 2500, about: 'Phone and tablet repairs, screen guards and unlocking services.' },
  { id: 'stitch-and-style', name: 'Stitch & Style Tailoring', trade: 'Tailor', area: 'Woji', city: 'Port Harcourt', rating: 4.8, reviews: 47, years: 9, verified: true, priceFrom: 7000, about: 'Native wear, suits, corporate outfits and alterations with fast turnaround.' },
  { id: 'perfect-fit-tailors', name: 'Perfect Fit Tailors', trade: 'Tailor', area: 'GRA', city: 'Port Harcourt', rating: 4.5, reviews: 26, years: 6, verified: true, priceFrom: 5000, about: 'Custom tailoring for men and women, uniforms and wedding outfits.' },
  { id: 'sole-revival-cobblers', name: 'Sole Revival Cobblers', trade: 'Cobbler', area: 'Rumuola', city: 'Port Harcourt', rating: 4.6, reviews: 18, years: 10, verified: true, priceFrom: 1500, about: 'Shoe and bag repairs, resoling, polishing and zip replacement.' },
  { id: 'fresh-coat-painters', name: 'Fresh Coat Painters', trade: 'Painter', area: 'Eliozu', city: 'Port Harcourt', rating: 4.4, reviews: 21, years: 5, verified: false, priceFrom: 15000, about: 'Interior and exterior painting, screeding and finishing for homes and offices.' },
];