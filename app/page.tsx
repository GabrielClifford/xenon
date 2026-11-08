import Link from 'next/link';
import { ArrowRight, BarChart3, Check, Headphones, Rocket, ShieldCheck, ShoppingBag, Wallet } from 'lucide-react';
import HomeNav, { Logo } from '@/components/home/HomeNav';
import HeroMockup from '@/components/home/HeroMockup';
import TemplatesCarousel from '@/components/home/TemplatesCarousel';
import Faq from '@/components/home/Faq';
import PricingPlans from '@/components/PricingPlans';
import ReviewsMarquee from '@/components/ReviewsMarquee';

export const metadata = {
  title: 'Xenon | Build Your Online Store',
  description:
    'Create a beautiful online store in minutes. No coding needed. Add products, take orders and grow your business with Xenon.',
};

const perks = [
  { icon: Rocket, title: 'Lightning Fast', text: 'Performance' },
  { icon: ShieldCheck, title: 'Secure & Reliable', text: 'Orders and data' },
  { icon: Wallet, title: 'Flexible Payments', text: 'Pay on delivery & transfer' },
  { icon: Headphones, title: 'Friendly Support', text: 'Help when you need it' },
  { icon: BarChart3, title: 'Powerful Analytics', text: 'Know what sells' },
];

const pill = 'inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#030816] text-white">
      <HomeNav />

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_15%,rgba(37,99,235,0.35),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-14 pt-12 lg:grid-cols-[1fr_1.05fr] lg:pt-20">
          <div>
            <span className={pill}>The Ecommerce Website Builder</span>
            <h1 className="font-display mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
              Build Your Dream Online Store with <span className="text-blue-500">Xenon</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-slate-300 sm:text-lg">
              Create a beautiful online store in minutes. No coding. No hassle. Just sell.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#templates"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-400/40 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                View Templates
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
              {['Set up in minutes', 'No coding needed', 'Take orders from day one'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-blue-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <HeroMockup />
        </div>

        <div id="features" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 pb-14">
          <div className="grid grid-cols-2 gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:grid-cols-5">
            {perks.map((p) => (
              <div key={p.title} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
                  <p.icon className="h-6 w-6" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14">
        <div className="grid items-center gap-10 lg:grid-cols-[300px_1fr]">
          <div>
            <span className={pill}>Stunning Templates</span>
            <h2 className="font-display mt-4 text-3xl font-bold leading-tight sm:text-4xl">Beautiful Designs for Every Store</h2>
            <p className="mt-4 text-sm text-slate-300">
              Choose a professionally designed template and make it match your brand. You can switch any time without losing your products.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-blue-50"
            >
              Start Building <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <TemplatesCarousel />
        </div>
      </section>

      {/* Pricing: your existing component, restyled next */}
      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14">
        <div className="rounded-3xl bg-white p-4 text-slate-900 sm:p-8">
          <PricingPlans />
        </div>
      </section>

      {/* Reviews: your existing scrolling reviews, restyled next */}
      <section id="reviews" className="scroll-mt-24 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <div className="rounded-3xl bg-white p-4 text-slate-900 sm:p-8">
            <ReviewsMarquee />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-14">
        <div className="grid gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <span className={pill}>FAQs</span>
            <h2 className="font-display mt-4 text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h2>
            <p className="mt-3 text-sm text-slate-300">Find answers to common questions about Xenon.</p>
          </div>
          <Faq />
        </div>
      </section>

      {/* Final call to action */}
      <section className="mx-auto max-w-7xl px-5 pb-14">
        <div className="flex flex-col items-start gap-6 rounded-3xl border border-blue-400/30 bg-gradient-to-br from-[#0a1a4d] to-[#0a1230] p-8 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/40">
            <ShoppingBag className="h-8 w-8" />
          </span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">Ready to start your online store?</h2>
            <p className="mt-1 text-sm text-slate-300">Create your store today and get your first order this week.</p>
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Get Started Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display text-xl font-bold">Xenon</span>
            </Link>
            <p className="mt-1 text-xs text-slate-400">Build. Sell. Grow.</p>
            <p className="mt-4 max-w-xs text-sm text-slate-300">The ecommerce website builder for modern entrepreneurs.</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li><a href="#templates" className="hover:text-white">Templates</a></li>
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#faq" className="hover:text-white">FAQs</a></li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold">Get started</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li><Link href="/signup" className="hover:text-white">Create your store</Link></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-400">© 2026 Xenon. All rights reserved.</div>
      </footer>
    </main>
  );
}