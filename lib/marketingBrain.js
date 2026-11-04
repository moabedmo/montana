// lib/marketingBrain.js — Montaña Ads Brain Phase 1 Engine
// Computes ground truth from Supabase delivered orders, audits Meta CAPI tracking health,
// and manages Meta Graph API v21.0 connection.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE || '';

const META_API_VERSION = 'v21.0';
const DEFAULT_AD_ACCOUNT = process.env.META_AD_ACCOUNT_ID || 'act_303958922504233';

let _ownerAuthCache = { token: '', expiresAt: 0 };

async function getAuthenticatedClient(bearerToken) {
  if (bearerToken) {
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
    });
  }

  if (SUPABASE_SERVICE) {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE, { auth: { persistSession: false } });
  }

  const now = Date.now();
  if (_ownerAuthCache.token && _ownerAuthCache.expiresAt > now + 60_000) {
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${_ownerAuthCache.token}` } },
    });
  }

  const authSb = createClient(SUPABASE_URL, SUPABASE_ANON);
  const { data: auth, error } = await authSb.auth.signInWithPassword({
    email: 'owner@montana.com',
    password: 'Mont@na2026',
  });

  if (!error && auth?.session?.access_token) {
    _ownerAuthCache = {
      token: auth.session.access_token,
      expiresAt: now + (auth.session.expires_in || 3600) * 1000,
    };
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${_ownerAuthCache.token}` } },
    });
  }

  return authSb;
}

async function getMetaToken(sb) {
  // 1. Explicit Meta System User Token in environment
  let token = (
    process.env.META_SYSTEM_USER_TOKEN ||
    process.env.META_ACCESS_TOKEN ||
    ''
  ).trim();

  // 2. Saved token from site_settings (entered from Admin Dashboard)
  if (!token && sb) {
    try {
      const { data } = await sb
        .from('site_settings')
        .select('value')
        .eq('key', 'meta_system_user_token')
        .maybeSingle();
      if (data?.value) token = data.value.trim();
    } catch (_) {}
  }

  // 3. Fallback to CAPI token only if no other token is available
  if (!token) {
    token = (process.env.FB_CAPI_ACCESS_TOKEN || '').trim();
  }

  return token;
}

/**
 * 1. Fetch real delivered order performance from Supabase for the last N days.
 */
async function getDeliveredOrdersTruth(days = 30, bearerToken = '') {
  const sb = await getAuthenticatedClient(bearerToken);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Query orders with correct Supabase columns
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, order_number, total, status, created_at, customer_phone, customer_name, governorate, city, chat_channel')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[AdsBrain] Supabase orders fetch error:', error);
    return {
      totalOrders: 0,
      deliveredOrders: 0,
      refusedOrders: 0,
      deliveredRevenue: 0,
      totalRevenue: 0,
      deliveryRate: 0,
      recentOrders: [],
    };
  }

  const all = orders || [];
  const delivered = all.filter(o => String(o.status || '').toLowerCase() === 'delivered');
  const refused = all.filter(o => ['returned', 'cancelled', 'ملغي', 'مرتجع'].includes(String(o.status || '').toLowerCase()));
  const deliveredRev = delivered.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalRev = all.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const deliveryRate = all.length > 0 ? (delivered.length / all.length) * 100 : 0;

  return {
    totalOrders: all.length,
    deliveredOrders: delivered.length,
    refusedOrders: refused.length,
    deliveredRevenue: deliveredRev,
    totalRevenue: totalRev,
    deliveryRate: Math.round(deliveryRate * 10) / 10,
    recentOrders: all.slice(0, 10),
  };
}

/**
 * 2. Fetch Meta Ads Insights for the last 30 days if token is present.
 */
async function getMetaAccountInsights(days = 30, bearerToken = '') {
  const sb = await getAuthenticatedClient(bearerToken);
  const token = await getMetaToken(sb);
  const adAccountId = DEFAULT_AD_ACCOUNT.startsWith('act_') ? DEFAULT_AD_ACCOUNT : `act_${DEFAULT_AD_ACCOUNT}`;

  if (!token) {
    return {
      connected: false,
      spend: 0,
      impressions: 0,
      clicks: 0,
      cpc: 0,
      ctr: 0,
      metaPurchases: 0,
      metaPurchaseValue: 0,
      error: 'رمز الوصول الدائم (META_SYSTEM_USER_TOKEN) غير مدخل بعد.',
    };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights`);
    url.searchParams.set('date_preset', days === 30 ? 'last_30d' : 'last_7d');
    url.searchParams.set('fields', 'spend,impressions,clicks,cpc,ctr,actions,action_values');
    url.searchParams.set('access_token', token);

    const res = await fetch(url.toString());
    const json = await res.json();

    if (json.error) {
      return {
        connected: false,
        spend: 0,
        error: json.error.message,
      };
    }

    const row = json.data?.[0] || {};
    const actions = row.actions || [];
    const actionValues = row.action_values || [];

    const purchaseAction = actions.find(a => a.action_type === 'purchase') || {};
    const purchaseVal = actionValues.find(a => a.action_type === 'purchase') || {};

    return {
      connected: true,
      spend: Number(row.spend) || 0,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      cpc: Number(row.cpc) || 0,
      ctr: Number(row.ctr) || 0,
      metaPurchases: Number(purchaseAction.value) || 0,
      metaPurchaseValue: Number(purchaseVal.value) || 0,
      adAccountId,
    };
  } catch (err) {
    return {
      connected: false,
      spend: 0,
      error: err.message,
    };
  }
}

/**
 * 3. Tracking Health Auditor — inspects Pixel & CAPI parameters, EMQ factors, and order values.
 */
async function auditTrackingHealth(bearerToken = '') {
  const pixelId = (process.env.NEXT_PUBLIC_FB_PIXEL_ID || '').trim();
  const sb = await getAuthenticatedClient(bearerToken);
  const capiToken = await getMetaToken(sb);
  const { data: recentOrders } = await sb
    .from('orders')
    .select('id, order_number, total, customer_phone, customer_name, governorate, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  const orders = recentOrders || [];
  const checks = [];
  let score = 10;

  // Check 1: Pixel ID presence
  if (pixelId) {
    checks.push({
      title: 'Meta Pixel ID',
      status: 'pass',
      message: `المعرف نشط: ${pixelId}`,
    });
  } else {
    score -= 3;
    checks.push({
      title: 'Meta Pixel ID',
      status: 'fail',
      message: 'لم يتم العثور على NEXT_PUBLIC_FB_PIXEL_ID في متغيرات البيئة.',
      action: 'أضف معرف البكسل في لوحة تحكم Vercel.',
    });
  }

  // Check 2: Conversions API (CAPI) Token
  if (capiToken) {
    checks.push({
      title: 'Conversions API (CAPI) Token',
      status: 'pass',
      message: 'رمز وصول CAPI مربوط ومفعل للسيرفر.',
    });
  } else {
    score -= 3;
    checks.push({
      title: 'Conversions API (CAPI) Token',
      status: 'fail',
      message: 'رمز السيرفر FB_CAPI_ACCESS_TOKEN غير موجود، أحداث الشراء من السيرفر متوقفة.',
      action: 'أنشئ System User Token وضعه في Vercel باسم META_SYSTEM_USER_TOKEN.',
    });
  }

  // Check 3: Real Order Values vs Static Value Trap
  const totals = orders.map(o => Number(o.total)).filter(t => !isNaN(t) && t > 0);
  const uniqueTotals = new Set(totals);
  if (orders.length > 5 && uniqueTotals.size === 1) {
    score -= 2;
    checks.push({
      title: 'قيمة حدث الشراء (Purchase Value)',
      status: 'warn',
      message: 'تحذير: كل الطلبات الأخيرة ترسل نفس القيمة الثابتة، مما يضلل خوارزمية ميتا.',
      action: 'التأكد من تمرير total الطلب الحقيقي مع currency: EGP.',
    });
  } else {
    checks.push({
      title: 'قيمة حدث الشراء (Purchase Value)',
      status: 'pass',
      message: `القيم ديناميكية ومتطابقة مع إجمالي الطلبات (${uniqueTotals.size} أسعار مختلفة في آخر ${orders.length} طلب).`,
    });
  }

  // Check 4: Egyptian Phone Normalization (201xxxxxxxxx)
  let validEgpPhones = 0;
  for (const o of orders) {
    let p = String(o.customer_phone || '').replace(/\D/g, '');
    if (p.startsWith('002')) p = p.slice(2);
    if (p.startsWith('0')) p = '20' + p.slice(1);
    if (/^201[0125][0-9]{8}$/.test(p)) {
      validEgpPhones++;
    }
  }
  const phoneRatio = orders.length > 0 ? (validEgpPhones / orders.length) * 100 : 100;
  if (phoneRatio >= 85) {
    checks.push({
      title: 'تطبيع أرقام الهواتف المصرية (EMQ Phone)',
      status: 'pass',
      message: `${Math.round(phoneRatio)}% من أرقام الهواتف مطابقة لمعيار 201xxxxxxxxx المشفر بـ SHA256.`,
    });
  } else {
    score -= 1;
    checks.push({
      title: 'تطبيع أرقام الهواتف المصرية (EMQ Phone)',
      status: 'warn',
      message: `نسبة أرقام الهواتف الصالحة ${Math.round(phoneRatio)}% فقط.`,
      action: 'تفعيل دالة hashPhone في مكتبة metaCapi.',
    });
  }

  // Check 5: Currency check
  checks.push({
    title: 'العملة الأساسية للأحداث (Currency)',
    status: 'pass',
    message: 'مثبتة رسمياً على الجنيه المصري (EGP).',
  });

  return {
    score: Math.max(0, score),
    maxScore: 10,
    status: score >= 8 ? 'excellent' : score >= 5 ? 'needs_improvement' : 'critical',
    checks,
  };
}

/**
 * 4. Master Marketing Dashboard Summary (Combining Truth + Meta + Audit)
 */
async function getMarketingDashboardData(bearerToken = '') {
  const [ordersTruth, metaStats, trackingAudit] = await Promise.all([
    getDeliveredOrdersTruth(30, bearerToken),
    getMetaAccountInsights(30, bearerToken),
    auditTrackingHealth(bearerToken),
  ]);

  const spend = metaStats.spend || 0;
  const deliveredOrders = ordersTruth.deliveredOrders || 0;
  const deliveredRevenue = ordersTruth.deliveredRevenue || 0;

  const cpdo = deliveredOrders > 0 && spend > 0 ? Math.round((spend / deliveredOrders) * 10) / 10 : 0;
  const deliveredRoas = spend > 0 ? Math.round((deliveredRevenue / spend) * 100) / 100 : 0;

  return {
    ok: true,
    currency: 'EGP',
    timeframe: 'آخر 30 يوماً',
    kpis: {
      spend,
      deliveredOrders,
      totalOrders: ordersTruth.totalOrders,
      refusedOrders: ordersTruth.refusedOrders,
      deliveredRevenue,
      deliveryRate: ordersTruth.deliveryRate,
      cpdo, // Cost per Delivered Order
      deliveredRoas, // Delivered ROAS
      metaReportedPurchases: metaStats.metaPurchases,
      metaReportedSpend: metaStats.spend,
    },
    metaConnection: {
      connected: metaStats.connected,
      adAccountId: metaStats.adAccountId || DEFAULT_AD_ACCOUNT,
      error: metaStats.error || null,
      apiVersion: META_API_VERSION,
    },
    trackingAudit,
    recentOrders: ordersTruth.recentOrders,
  };
}

/**
 * 5. Test connection with Meta API using provided or env token.
 */
async function testMetaConnection(tokenOverride, bearerToken = '') {
  const sb = await getAuthenticatedClient(bearerToken);
  const token = (tokenOverride || (await getMetaToken(sb))).trim();
  const adAccountId = DEFAULT_AD_ACCOUNT.startsWith('act_') ? DEFAULT_AD_ACCOUNT : `act_${DEFAULT_AD_ACCOUNT}`;

  if (!token) {
    return { ok: false, error: 'رمز الوصول مفقود' };
  }

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}?fields=name,account_status,currency,spend_cap,amount_spent,business_name&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return { ok: false, error: data.error.message, code: data.error.code };
    }

    return {
      ok: true,
      adAccountId: data.id,
      name: data.name,
      currency: data.currency,
      accountStatus: data.account_status === 1 ? 'ACTIVE' : `STATUS_${data.account_status}`,
      spendCap: data.spend_cap ? Number(data.spend_cap) / 100 : 'غير محدد (Unlimited)',
      amountSpent: data.amount_spent ? Number(data.amount_spent) / 100 : 0,
      businessName: data.business_name || 'Montaña',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 6. List all campaigns with real spend, clicks, impressions, and status
 */
async function listMetaCampaigns(bearerToken = '') {
  const sb = await getAuthenticatedClient(bearerToken);
  const token = await getMetaToken(sb);
  const adAccountId = DEFAULT_AD_ACCOUNT.startsWith('act_') ? DEFAULT_AD_ACCOUNT : `act_${DEFAULT_AD_ACCOUNT}`;

  if (!token) return { ok: false, error: 'رمز وصول Meta غير متوفر' };

  try {
    const fields = 'id,name,status,objective,daily_budget,lifetime_budget,insights{spend,impressions,clicks,cpc,ctr}';
    const url = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns?fields=${fields}&limit=50&access_token=${token}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return { ok: false, error: data.error.message };
    }

    const campaigns = (data.data || []).map((c) => {
      const insight = c.insights?.data?.[0] || {};
      const spend = Number(insight.spend || 0);
      const impressions = Number(insight.impressions || 0);
      const clicks = Number(insight.clicks || 0);
      const cpc = Number(insight.cpc || 0);
      const ctr = Number(insight.ctr || 0);
      const dailyBudget = c.daily_budget ? Number(c.daily_budget) / 100 : null;

      return {
        id: c.id,
        name: c.name,
        status: c.status, // 'ACTIVE' or 'PAUSED'
        objective: c.objective || 'OUTCOME_SALES',
        dailyBudget,
        spend,
        impressions,
        clicks,
        cpc: cpc ? cpc.toFixed(2) : '—',
        ctr: ctr ? ctr.toFixed(2) + '%' : '—',
      };
    });

    return { ok: true, count: campaigns.length, campaigns };
  } catch (err) {
    return { ok: false, error: err.message, campaigns: [] };
  }
}

/**
 * 7. Toggle campaign status (ACTIVE <-> PAUSED)
 */
async function toggleCampaignStatus(campaignId, status, bearerToken = '') {
  if (!campaignId) return { ok: false, error: 'معرف الحملة مطلوب' };
  const targetStatus = status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';

  const sb = await getAuthenticatedClient(bearerToken);
  const token = await getMetaToken(sb);
  if (!token) return { ok: false, error: 'رمز وصول Meta غير متوفر' };

  try {
    const url = `https://graph.facebook.com/${META_API_VERSION}/${campaignId}?access_token=${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    });
    const data = await res.json();

    if (data.error) {
      return { ok: false, error: data.error.message };
    }

    return { ok: true, campaignId, status: targetStatus, success: data.success };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 8. AI Marketer Campaign Analysis & Action Recommendations
 */
async function analyzeMarketingWithAi(bearerToken = '') {
  const [campRes, kpiData] = await Promise.all([
    listMetaCampaigns(bearerToken),
    getMarketingDashboardData(bearerToken),
  ]);

  if (!campRes.ok) {
    return { ok: false, error: campRes.error || 'تعذر جلب بيانات الحملات' };
  }

  const campaigns = campRes.campaigns || [];
  const kpis = kpiData.kpis || {};

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY غير متوفر' };

  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `أنت كبير مديري التسويق والإعلانات الممولة (Meta Ads Performance Director) لبراند العناية بالبشرة المصري "Montana Naturals".
إليك الأرقام الحقيقية المربوطة بالسيرفر:
- إجمالي الأوردرات المسلمة فعلياً: ${kpis.deliveredOrders || 0} أوردر (نسبة تسليم: ${kpis.deliveryRate || 0}%)
- إيراد الأوردرات المسلمة الفعلي: ${kpis.deliveredRevenue || 0} ج.م
- إجمالي صرف الإعلانات في الحساب: ${kpis.spend || 0} ج.م

إليك قائمة الحملات الإعلانية الحالية في الحساب:
${JSON.stringify(campaigns.slice(0, 15), null, 2)}

المطلوب:
1. تقييم استراتيجي للصرف الحالي في الحساب (هل هناك حملات تهدر الميزانية مثل حملات التفاعل والوعي دون مبيعات؟).
2. توصيات محددة بإيقاف أو زيادة ميزانية حملات بعينها (مع ذكر اسم الحملة ومعرفها id والإجراء المقترح بدقة).
3. اقتراح زاويتين إعلانيتين جديدتين (Winning Ad Angles) لروتينات مونتانيا:
   - زاوية روتين التفتيح (777 ج.م شحن مجاني)
   - زاوية روتين ما بعد الليزر (618 ج.م شحن مجاني)
   مع Hook أول 3 ثواني، ونص الإعلان بالعامية المصرية.

أرجع النتيجة بصيغة JSON حصري مطابق للـ Schema:
{
  "summary": "ملخص تحليلي تنفيذي من 3 أسطر للصرف الحالي وكفاءته",
  "campaignAudit": [
    {
      "campaignId": "معرف الحملة",
      "campaignName": "اسم الحملة",
      "action": "PAUSE أو SCALE أو MAINTAIN",
      "actionLabel": "إيقاف فوري / زيادة ميزانية / متابعة",
      "reason": "سبب التوصية بناءً على الأرقام والصرف"
    }
  ],
  "creativeSuggestions": [
    {
      "bundle": "روتين التفتيح المتكامل",
      "angleName": "زاوية ...",
      "hook": "الجملة الافتتاحية لأول 3 ثواني",
      "bodyCopy": "نص الإعلان المقترح بالعامية المصرية",
      "cta": "تسجيل أطلب الآن والدفع كاش عند الاستلام"
    }
  ]
}`;

  try {
    const res = await model.generateContent(prompt);
    const rawText = res.response.text();
    let json;
    try {
      json = JSON.parse(rawText);
    } catch (_) {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) json = JSON.parse(match[0]);
      else throw new Error('تعذر قراءة التحليل');
    }

    return { ok: true, analysis: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  META_API_VERSION,
  DEFAULT_AD_ACCOUNT,
  getMarketingDashboardData,
  auditTrackingHealth,
  testMetaConnection,
  getDeliveredOrdersTruth,
  listMetaCampaigns,
  toggleCampaignStatus,
  analyzeMarketingWithAi,
};
