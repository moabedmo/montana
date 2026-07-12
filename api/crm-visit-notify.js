const { notifyCrmVisit } = require('../lib/crmTelegramNotify');
const { notifyAdminsPush } = require('../lib/crmAdminPush');
const { notifyDiscountRequest } = require('../lib/crmDiscountApprove');
const { notifyOverdueInvoices } = require('../lib/crmOverdueAlert');
const { sendAbandonedCartReminders } = require('../lib/cartReminder');
const { sendReviewReminders } = require('../lib/reviewReminder');
const { verifyStoreOrigin, enforceRateLimit, setSecurityHeaders } = require('../lib/security');

module.exports = async function handler(req, res) {
  setSecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Vercel Cron hits this daily (see vercel.json) to alert on overdue B2B
  // invoices — no browser session, so it's gated by CRON_SECRET instead of
  // the store-origin check below. The Hobby plan caps both cron frequency
  // (daily only) and total serverless functions (12), so the abandoned-cart
  // reminder — which needs hourly ticks — is triggered externally against
  // this same function via ?job=cart-reminder instead of its own file/cron.
  if (req.method === 'GET') {
    const expected = process.env.CRON_SECRET;
    const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (expected && got !== expected) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    try {
      if (req.query.job === 'cart-reminder') {
        const result = await sendAbandonedCartReminders();
        return res.status(200).json(result);
      }
      // Review reminders only need daily granularity (3-4 day window), so
      // this rides the existing daily cron tick instead of needing its own
      // externally-triggered job like cart-reminder does.
      const [overdue, reviews] = await Promise.all([
        notifyOverdueInvoices(),
        sendReviewReminders(),
      ]);
      return res.status(200).json({ ok: true, ...overdue, reviewReminders: reviews });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || 'Server error' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    verifyStoreOrigin(req);
    enforceRateLimit(req, 'crm-visit-notify', { windowMs: 60_000, max: 20 });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (body.type === 'discount_request') {
      const tg = await notifyDiscountRequest(body);
      return res.status(200).json({ ok: true, telegram: tg?.ok !== false });
    }

    const tg = await notifyCrmVisit(body);

    const fin = (body.financial_requests || []).filter((r) => r?.enabled !== false);
    const gpsBad = body.gps_verified === false;
    const pushBody = [
      body.rep_name && `المندوب: ${body.rep_name}`,
      body.doctor_name && `العميل: ${body.doctor_name}`,
      gpsBad && `⚠️ GPS: ${body.distance_m != null ? body.distance_m + 'm' : 'غير متحقق'}`,
      body.sample_units > 0 && `عينات: ${body.sample_units}`,
      fin.length && `طلبات فواتير: ${fin.length}`,
    ].filter(Boolean).join(' · ');

    const push = await notifyAdminsPush({
      title: gpsBad ? '⚠️ زيارة CRM — موقع مشبوه' : '🩺 زيارة CRM جديدة',
      body: pushBody || 'تقرير زيارة جديد',
      url: gpsBad ? '/crm/admin/#gps-audit' : '/crm/admin/#b2b-invoices',
    });

    return res.status(200).json({ ok: true, telegram: tg?.ok !== false, push: push?.ok || push?.skipped });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Server error' });
  }
};
