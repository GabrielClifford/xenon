import type { SupabaseClient } from '@supabase/supabase-js';
import {
  admin,
  BIZ_COLUMNS,
  loadSettings,
  postWebhook,
  sendEmail,
  senderFor,
  siteUrl,
  type Biz,
  type Hook,
} from '@/lib/notifications/server';
import {
  mergeTpl,
  orderPayload,
  renderCustomer,
  renderFulfillment,
  renderStaffOrder,
  renderWeekly,
  sampleOrder,
  type CustomerKey,
} from '@/lib/notifications/templates';

type Body = {
  action?: string;
  businessId?: string;
  domain?: string;
  template?: string;
  webhookId?: string;
};

async function owner(req: Request, db: SupabaseClient, businessId: string) {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const user = data.user;
  if (!user) return null;
  const { data: biz } = await db.from('businesses').select(BIZ_COLUMNS).eq('id', businessId).eq('owner_id', user.id).maybeSingle();
  return biz ? { user, biz: biz as Biz } : null;
}

async function resend(method: string, path: string, body?: object) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, status: 500, json: { message: 'RESEND_API_KEY is not set in Vercel.' } as Record<string, unknown> };
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function dmarcFound(domain: string) {
  try {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`, {
      headers: { accept: 'application/dns-json' },
    });
    const j = (await r.json()) as { Answer?: { data: string }[] };
    return (j.Answer ?? []).some((a) => /v=DMARC1/i.test(a.data));
  } catch {
    return false;
  }
}

const fail = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.action || !body.businessId) return fail('Bad request');

  let db: SupabaseClient;
  try {
    db = admin();
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Server is not set up', 500);
  }
  const who = await owner(req, db, body.businessId);
  if (!who) return fail('Please sign in again.', 401);
  const { user, biz } = who;
  const settings = await loadSettings(db, biz.id);

  switch (body.action) {
    /* ---------------- domain ---------------- */
    case 'domain_add': {
      const domain = (body.domain ?? '').trim().toLowerCase();
      if (!/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/.test(domain)) return fail('Enter a domain like mail.yourbrand.com');
      const { data: existing } = await db.from('notification_domains').select('business_id').eq('business_id', biz.id).maybeSingle();
      if (existing) return fail('Remove your current domain first.');
      const r = await resend('POST', '/domains', { name: domain });
      if (!r.ok) return fail(String(r.json.message ?? 'Could not add that domain.'));
      const { error } = await db.from('notification_domains').insert({
        business_id: biz.id,
        domain,
        resend_id: String(r.json.id),
        status: String(r.json.status ?? 'pending'),
        records: r.json.records ?? [],
      });
      if (error) return fail(error.message, 500);
      return Response.json({ ok: true });
    }

    case 'domain_check': {
      const { data: d } = await db.from('notification_domains').select('*').eq('business_id', biz.id).maybeSingle();
      if (!d) return fail('Add a domain first.');
      await resend('POST', `/domains/${d.resend_id}/verify`);
      const r = await resend('GET', `/domains/${d.resend_id}`);
      if (!r.ok) return fail(String(r.json.message ?? 'Could not check the domain.'));
      const status = String(r.json.status ?? d.status);
      const dmarc = status === 'verified' ? await dmarcFound(d.domain) : false;
      await db
        .from('notification_domains')
        .update({ status, records: r.json.records ?? d.records, dmarc_ok: dmarc, updated_at: new Date().toISOString() })
        .eq('business_id', biz.id);
      return Response.json({ ok: true, status, dmarc });
    }

    case 'dmarc_check': {
      const { data: d } = await db.from('notification_domains').select('domain').eq('business_id', biz.id).maybeSingle();
      if (!d) return fail('Add a domain first.');
      const ok = await dmarcFound(d.domain);
      await db.from('notification_domains').update({ dmarc_ok: ok, updated_at: new Date().toISOString() }).eq('business_id', biz.id);
      return Response.json({ ok: true, dmarc: ok });
    }

    case 'domain_remove': {
      const { data: d } = await db.from('notification_domains').select('resend_id').eq('business_id', biz.id).maybeSingle();
      if (d) await resend('DELETE', `/domains/${d.resend_id}`);
      await db.from('notification_domains').delete().eq('business_id', biz.id);
      return Response.json({ ok: true });
    }

    /* ---------------- tests ---------------- */
    case 'test_email': {
      const sender = await senderFor(db, biz, settings);
      if (!sender) return fail('No sender is set up yet. Add NOTIFY_FROM_EMAIL in Vercel, or verify your own domain.');
      if (!user.email) return fail('Your account has no email address.');
      const t = body.template ?? '';
      let m;
      if (t === 'order_confirmation' || t === 'order_fulfilled' || t === 'order_cancelled') {
        m = renderCustomer(mergeTpl(settings.customer, t as CustomerKey), {
          store: biz.name,
          storeUrl: `${siteUrl()}/b/${biz.slug}`,
          contact: settings.reply_to,
          order: sampleOrder,
        });
      } else if (t === 'staff_new_order' || t === 'staff_order_cancelled') {
        m = renderStaffOrder(t === 'staff_new_order' ? 'new' : 'cancelled', {
          store: biz.name,
          dashboardUrl: `${siteUrl()}/dashboard`,
          order: sampleOrder,
        });
      } else if (t === 'fulfillment') {
        m = renderFulfillment({ store: biz.name, order: sampleOrder });
      } else if (t === 'weekly_summary') {
        m = renderWeekly({
          store: biz.name,
          from: 'Mon 9 Nov',
          to: 'Sun 15 Nov',
          count: 12,
          revenue: 86500,
          top: [
            { name: 'Jollof rice pack', qty: 9 },
            { name: 'Chapman', qty: 6 },
          ],
          dashboardUrl: `${siteUrl()}/dashboard`,
        });
      } else {
        return fail('Unknown template');
      }
      const r = await sendEmail({
        from: sender.from,
        to: [user.email],
        subject: `[Test] ${m.subject}`,
        html: m.html,
        text: m.text,
        replyTo: sender.replyTo,
      });
      if (!r.ok) return fail(r.error ?? 'Could not send the test.', 502);
      return Response.json({ ok: true, to: user.email });
    }

    case 'test_webhook': {
      const { data: h } = await db.from('notification_webhooks').select('*').eq('id', body.webhookId ?? '').eq('business_id', biz.id).maybeSingle();
      if (!h) return fail('Webhook not found');
      const r = await postWebhook(db, h as Hook, 'webhook.test', {
        event: 'webhook.test',
        created_at: new Date().toISOString(),
        store: { id: biz.id, name: biz.name, slug: biz.slug },
        order: orderPayload(sampleOrder),
      });
      if (!r.ok) return fail(r.error ?? 'The test failed.', 502);
      return Response.json({ ok: true });
    }

    default:
      return fail('Unknown action');
  }
}
