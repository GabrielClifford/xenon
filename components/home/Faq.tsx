import { Plus } from 'lucide-react';

const faqs: { q: string; a: string }[] = [
  {
    q: 'Which kinds of business can use Xenon?',
    a: 'Any business that sells products online, such as fashion, electronics, beauty and skincare, food and more. You add your products, and customers can order from your website.',
  },
  {
    q: 'Do I need coding skills to use Xenon?',
    a: 'No. You fill in your business details, add products and photos, choose a template and publish. Xenon builds the website for you.',
  },
  {
    q: 'How long does it take to get my website live?',
    a: 'Many store owners go live the same day. Once your details and first products are added, publish with one click and share your link.',
  },
  {
    q: 'Can I change my template later?',
    a: 'Yes. Open Templates in your dashboard and pick another one. Your products and content stay exactly as they are.',
  },
  {
    q: 'How do my customers pay?',
    a: 'Customers can choose pay on delivery or bank transfer, and the money goes straight to you. Card payments are coming soon.',
  },
   {
    q: 'How much does Xenon cost?',
    a: 'Xenon has three plans: Starter at ₦10,000 a month, Professional at ₦15,000 a month and Business at ₦25,000 a month. See the Pricing section above for what each one includes.',
  },
];

export default function Faq() {
  return (
    <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
      {faqs.map((f) => (
        <details key={f.q} className="group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-white">
            <span>{f.q}</span>
            <Plus className="h-4 w-4 shrink-0 text-slate-300 transition group-open:rotate-45" />
          </summary>
          <p className="pb-4 pr-8 text-sm leading-relaxed text-slate-300">{f.a}</p>
        </details>
      ))}
    </div>
  );
}