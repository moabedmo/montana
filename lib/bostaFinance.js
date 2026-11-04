// lib/bostaFinance.js — Bosta Wallet Balance, Payout Schedules & Telegram Notifications
const { createClient } = require('@supabase/supabase-js');
const { tgApi } = require('./telegramApi');

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || '';

// Standard average shipping fee charged by Bosta per delivered shipment in Egypt
const DEFAULT_BOSTA_FEE_PER_DELIVERY = 55;

let _authCache = { token: '', expiresAt: 0 };

async function getClient(bearerToken = '') {
  if (bearerToken) {
    return createClient(SB_URL, SB_ANON, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
  }
  if (SB_SERVICE) {
    return createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
  }

  const now = Date.now();
  if (_authCache.token && _authCache.expiresAt > now + 60_000) {
    return createClient(SB_URL, SB_ANON, {
      global: { headers: { Authorization: `Bearer ${_authCache.token}` } },
    });
  }

  const authSb = createClient(SB_URL, SB_ANON);
  const { data: auth } = await authSb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });

  if (auth?.session?.access_token) {
    _authCache = {
      token: auth.session.access_token,
      expiresAt: now + (auth.session.expires_in || 3600) * 1000,
    };
    return createClient(SB_URL, SB_ANON, {
      global: { headers: { Authorization: `Bearer ${_authCache.token}` } },
    });
  }

  return authSb;
}

/**
 * Calculates next Wednesday payout date
 */
function getNextPayoutInfo() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat
  
  let daysUntilWed = (3 - dayOfWeek + 7) % 7;
  if (daysUntilWed === 0 && now.getHours() >= 17) {
    // If it's Wednesday after 5 PM, next payout is next Wednesday
    daysUntilWed = 7;
  }

  const nextWed = new Date(now.getTime() + daysUntilWed * 24 * 60 * 60 * 1000);
  const dateStr = nextWed.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let timingLabel = '';
  if (daysUntilWed === 0) timingLabel = 'اليوم (الأربعاء - موعد صرف بوسطة الأسبوعي)';
  else if (daysUntilWed === 1) timingLabel = 'غداً الأربعاء';
  else timingLabel = `بعد ${daysUntilWed} أيام (${dateStr})`;

  return {
    schedulePolicy: 'أسبوعي (كل يوم أربعاء)',
    nextPayoutDate: dateStr,
    nextPayoutTiming: timingLabel,
    daysRemaining: daysUntilWed,
  };
}

/**
 * Reads Bosta financial records and settings from site_settings
 */
async function getBostaFinanceStore(sb) {
  try {
    const { data } = await sb
      .from('site_settings')
      .select('value')
      .eq('key', 'bosta_finance_records')
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return parsed;
    }
  } catch (_) {}

  return {
    payouts: [],
    settings: {
      schedule: 'أسبوعي (كل يوم أربعاء)',
      bank_name: 'البنك الأهلي المصري (NBE)',
      account_name: 'Montana Naturals',
      iban_hint: 'EG** **** **** 4819',
    },
  };
}

/**
 * Computes full Bosta financial summary
 */
async function getBostaFinanceSummary(bearerToken = '') {
  const sb = await getClient(bearerToken);

  // 1. Fetch delivered orders & shipped orders
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, order_number, total, status, bosta_status, payment_method, created_at')
    .in('status', ['delivered', 'shipped', 'preparing']);

  if (error) {
    console.error('[BostaFinance] orders error:', error);
  }

  const allOrders = orders || [];
  const delivered = allOrders.filter(o => o.status === 'delivered');
  const inTransit = allOrders.filter(o => ['shipped', 'preparing'].includes(o.status));

  // Gross cash collected from delivered COD orders
  const totalDeliveredCOD = delivered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  
  // Total shipping fees deducted by Bosta (~55 EGP per delivery)
  const totalShippingFees = delivered.length * DEFAULT_BOSTA_FEE_PER_DELIVERY;

  // Net cash accumulated in Bosta wallet before transfers
  const netAccumulatedWallet = Math.max(0, totalDeliveredCOD - totalShippingFees);

  // Cash currently with couriers in transit
  const inTransitAmount = inTransit.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // 2. Load past payouts from site_settings
  const store = await getBostaFinanceStore(sb);
  const payouts = Array.isArray(store.payouts) ? store.payouts : [];

  const totalPayoutsDeposited = payouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Current Ready-to-Transfer Balance in Bosta Wallet
  const currentAvailableBalance = Math.max(0, netAccumulatedWallet - totalPayoutsDeposited);

  const payoutSchedule = getNextPayoutInfo();

  return {
    ok: true,
    wallet: {
      currentAvailableBalance, // الرصيد الجاهز للتحويل حالياً
      netAccumulatedWallet,    // إجمالي الرصيد الصافي المحصل
      totalDeliveredCOD,       // إجمالي مبالغ الأوردرات المسلمة
      totalShippingFees,       // إجمالي مصاريف شحن بوسطة المخصومة
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      inTransitAmount,         // فلوس في الطريق مع المناديب
      totalPayoutsDeposited,   // إجمالي الفلوس اللي تم تحويلها بنكياً
      payoutsCount: payouts.length,
    },
    schedule: {
      frequency: store.settings?.schedule || 'أسبوعي (كل يوم أربعاء)',
      nextDate: payoutSchedule.nextPayoutDate,
      timing: payoutSchedule.nextPayoutTiming,
      daysRemaining: payoutSchedule.daysRemaining,
      bankName: store.settings?.bank_name || 'البنك الأهلي المصري (NBE)',
      accountName: store.settings?.account_name || 'Montana Naturals',
      iban: store.settings?.iban_hint || 'EG** **** **** 4819',
    },
    recentPayouts: payouts.slice(0, 10),
  };
}

/**
 * Records a new payout, saves it to site_settings, and triggers a Telegram notification
 */
async function recordBostaPayout({ amount, bankName, referenceNumber, notes, bearerToken = '' }) {
  const numAmount = Math.round(Number(amount) || 0);
  if (numAmount <= 0) {
    return { ok: false, error: 'يرجى إدخال مبلغ تحويل صحيح أكبر من صفر.' };
  }

  const sb = await getClient(bearerToken);
  const store = await getBostaFinanceStore(sb);
  const payouts = Array.isArray(store.payouts) ? store.payouts : [];

  const newPayout = {
    id: `bosta_po_${Date.now()}`,
    amount: numAmount,
    bankName: bankName || store.settings?.bank_name || 'البنك الأهلي المصري',
    referenceNumber: referenceNumber || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
    notes: notes || 'تحويل دوري من بوسطة',
    createdAt: new Date().toISOString(),
  };

  payouts.unshift(newPayout);
  store.payouts = payouts;

  // Save to site_settings
  const { error: upsertErr } = await sb
    .from('site_settings')
    .upsert({
      key: 'bosta_finance_records',
      value: JSON.stringify(store),
      updated_at: new Date().toISOString(),
    });

  if (upsertErr) {
    console.error('[BostaFinance] save error:', upsertErr);
    return { ok: false, error: 'تعذر حفظ بيانات التحويل في السيرفر.' };
  }

  // Get refreshed financial summary to report accurate remaining balance
  const refreshed = await getBostaFinanceSummary(bearerToken);
  const wallet = refreshed.wallet || {};

  // Send Telegram Notification to Owner Bot
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CONFIRM_KEY || process.env.TELEGRAM_CHAT_ID;

  if (botToken && chatId) {
    const textHtml = `💰 <b>تنبيه تحويل بنكي جديد — Bosta (بوسطة)</b>

💵 <b>المبلغ المحوّل:</b> <code>${numAmount.toLocaleString('ar-EG')} ج.م</code>
🏦 <b>البنك المستلم:</b> ${newPayout.bankName}
📑 <b>رقم العملية/المرجع:</b> <code>${newPayout.referenceNumber}</code>
📅 <b>التاريخ:</b> ${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
📝 <b>ملاحظات:</b> ${newPayout.notes}

────────────────────
💼 <b>رصيد محفظة بوسطة المتبقي:</b> ${wallet.currentAvailableBalance?.toLocaleString('ar-EG')} ج.م
🚚 <b>شحنات مع المناديب في الطريق:</b> ${wallet.inTransitCount} طلب (${wallet.inTransitAmount?.toLocaleString('ar-EG')} ج.م)
🏦 <b>إجمالي التحويلات المستلمة كلياً:</b> ${wallet.totalPayoutsDeposited?.toLocaleString('ar-EG')} ج.م`;

    try {
      await tgApi(botToken, 'sendMessage', {
        chat_id: chatId,
        text: textHtml,
        parse_mode: 'HTML',
      });
    } catch (tgErr) {
      console.error('[BostaFinance] Telegram alert error:', tgErr.message);
    }
  }

  return {
    ok: true,
    message: `تم تسجيل تحويل مبلغ ${numAmount.toLocaleString('ar-EG')} ج.م وإرسال تنبيه تليجرام للمالك بنجاح.`,
    payout: newPayout,
    summary: refreshed,
  };
}

module.exports = {
  getBostaFinanceSummary,
  recordBostaPayout,
  getNextPayoutInfo,
};
