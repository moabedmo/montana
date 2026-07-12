// Real-review request: 3-4 days after an order is marked "delivered", nudge
// the customer (Messenger/Instagram only — the channels we can message back
// into) for a genuine review, with a one-time 30 EGP coupon as an incentive.
// Triggered daily from api/crm-visit-notify.js's existing cron tick.
const { createClient } = require('@supabase/supabase-js');
const { sendManyChatMessage } = require('./manychatApi');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const sbService = process.env.SERVICE_ROLE
  ? createClient(SUPABASE_URL, process.env.SERVICE_ROLE)
  : null;

const REVIEW_COUPON_VALUE = 30;
const REVIEW_COUPON_DAYS = 30;

function buildReviewLink(items) {
  const withSlug = (items || []).find((i) => i.slug);
  return withSlug ? `https://www.montana.com.eg/product/${withSlug.slug}` : 'https://www.montana.com.eg';
}

function buildReminderText(items, couponCode) {
  const names = (items || []).map((i) => i.name).filter(Boolean);
  const productPart = names.length
    ? `مع ${names.length > 1 ? names.slice(0, -1).join('، ') + ' و' + names[names.length - 1] : names[0]}`
    : 'مع المنتج اللي اتبعتلك';
  const link = buildReviewLink(items);
  return `يا فندم 💜 عاملة إيه مع تجربتك ${productPart}؟ حابين نسمع رأيك الصادق — اكتبيلنا تقييم هنا:\n${link}\n\nوهدية بسيطة منّا: كود خصم ${couponCode} بقيمة ${REVIEW_COUPON_VALUE} جنيه على أوردرك الجاي 🎁`;
}

async function createReviewCoupon(orderNumber) {
  const code = `REVIEW-${orderNumber}`.toUpperCase();
  const expiresAt = new Date(Date.now() + REVIEW_COUPON_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sbService.from('coupons').insert({
    code,
    discount_type: 'fixed',
    discount_value: REVIEW_COUPON_VALUE,
    max_uses: 1,
    is_active: true,
    expires_at: expiresAt,
  });
  // A retried run for the same order (e.g. after a partial failure) would
  // hit the unique constraint on code — treat that as "coupon already
  // exists" rather than a hard failure.
  if (error && !/duplicate key/i.test(error.message || '')) {
    return { ok: false, error: error.message };
  }
  return { ok: true, code };
}

async function sendReviewReminders() {
  if (!sbService) return { ok: false, error: 'service_role_not_configured' };

  const { data, error } = await sbService.rpc('get_orders_awaiting_review_reminder');
  if (error) return { ok: false, error: error.message };

  const candidates = data || [];
  let sent = 0;
  const errors = [];

  for (const row of candidates) {
    const contactId = row.chat_session_id?.startsWith('manychat:')
      ? row.chat_session_id.slice('manychat:'.length)
      : null;
    if (!contactId) continue;

    const coupon = await createReviewCoupon(row.order_number);
    if (!coupon.ok) {
      errors.push({ order_id: row.order_id, error: coupon.error });
      continue;
    }

    const text = buildReminderText(row.items, coupon.code);
    // Outside Meta's 24h standard messaging window by design (3-4 days
    // post-delivery) — reuse the same post-purchase tag already approved
    // for order-confirmation sends.
    const result = await sendManyChatMessage(contactId, text, 'CONFIRMED_EVENT_UPDATE', row.chat_channel);
    if (result.ok) {
      sent += 1;
    } else {
      errors.push({ order_id: row.order_id, error: result.error });
    }
    // Mark as reminded regardless of send outcome — a permanently-failing
    // contact shouldn't be retried every day.
    await sbService.rpc('mark_review_reminder_sent', { p_order_id: row.order_id });
  }

  return { ok: true, candidates: candidates.length, sent, errors };
}

module.exports = { sendReviewReminders };
