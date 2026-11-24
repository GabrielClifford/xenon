// Call this from your public shop's checkout form so abandoned carts show up in Orders > Abandoned checkouts.
// It is safe to call often: it saves nothing until there is a phone number or email, and it never throws.
//
//   import { saveCheckout } from '@/lib/shop/saveCheckout';
//   saveCheckout(business.id, { customer_name: name, phone, email, items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity, product_id: i.id })) });
//
// Call it (debounced ~1.5s) when the customer types a phone/email or changes the cart, and call clearCheckoutSession() after an order is placed.
import { createClient } from '@/lib/supabase/client';

export type CheckoutItem = { name: string; price: number; quantity: number; variant_title?: string; image_url?: string; product_id?: string | null; variant_id?: string | null };
export type CheckoutData = { customer_name?: string; phone?: string; email?: string; items: CheckoutItem[] };

const KEY = 'xenon_checkout_session';

function sessionId(): string {
  try {
    let s = localStorage.getItem(KEY);
    if (!s) {
      s = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9-]/g, '');
      localStorage.setItem(KEY, s);
    }
    return s;
  } catch {
    return `s-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function clearCheckoutSession() {
  clearTimeout(timer);
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function saveCheckout(businessId: string, data: CheckoutData, delay = 1500) {
  if (typeof window === 'undefined') return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await createClient().rpc('xenon_save_checkout', { p_business: businessId, p_session: sessionId(), p_data: data });
    } catch { /* never get in the way of a real customer */ }
  }, delay);
}
