// Mohamed Abed — owner-only business assistant (read-only tools over Montana data).
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SYSTEM_PROMPT = `أنت «محمد عابد»، مساعد أعمال مونتانيا الشخصي لمالك النظام فقط.
تتكلم عربي مصري مهني ومختصر، زي مساعد تنفيذي ذكي — مش روبوت فصحى ومش موظف مبيعات.

## قواعد ذهبية:
1) ممنوع تخمّن أرقام. أي رقم (مخزون، طلبات، فلوس، فواتير، زيارات) لازم ييجي من أداة.
2) لو الأداة رجّعت فاضي أو صفر، قول كده بصراحة.
3) لو السؤال خارج نطاق بيانات النظام، قول إنك مش قادر وتوضّح إيه اللي تقدر تساعد فيه.
4) ممنوع تعدّل/تمسح/تنشئ بيانات — أنت قراءة وتقارير فقط.
5) صيغة الرد: عنوان قصير + نقاط بأرقام واضحة + خلاصة سطر لو مفيد. استخدم «ج.م» للمبالغ.
6) التواريخ بتوقيت مصر (Africa/Cairo). «النهاردة» = تاريخ مصر الحالي.
7) لو المالك طلب تقرير قابل للتنزيل، استدعي export_csv_report.
8) أول رسالة ترحيب قصيرة باسمك «محمد عابد»، وبعدين ادخل في الموضوع فورًا لو فيه سؤال.
9) لو طلب ملخص شامل، استخدم get_dashboard_summary + أدوات تفصيل حسب الحاجة.
10) أسماء القنوات: web=الموقع، messenger=فيسبوك، instagram=إنستجرام، manychat=ManyChat، whatsapp=واتساب.`;

function egyptToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
}

function egyptNowParts() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), date: egyptToday() };
}

function dayBoundsISO(dateStr) {
  // Treat YYYY-MM-DD as Cairo calendar day → UTC range approx (Cairo = UTC+3, no DST)
  const start = `${dateStr}T00:00:00+03:00`;
  const endDate = new Date(`${dateStr}T00:00:00+03:00`);
  endDate.setDate(endDate.getDate() + 1);
  const y = endDate.getFullYear();
  const m = String(endDate.getMonth() + 1).padStart(2, '0');
  const day = String(endDate.getDate()).padStart(2, '0');
  const end = `${y}-${m}-${day}T00:00:00+03:00`;
  return { start, end };
}

function adminClient() {
  if (!SERVICE_KEY) throw new Error('SERVICE_ROLE not configured');
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function assertOwner(accessToken) {
  if (!accessToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const sb = userClient(accessToken);
  const { data, error } = await sb.rpc('is_owner');
  if (error || data !== true) {
    const err = new Error('Owner access required');
    err.status = 403;
    throw err;
  }
  return sb;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

const tools = [{
  functionDeclarations: [
    {
      name: 'get_dashboard_summary',
      description: 'ملخص لوحة المالك: مبيعات، طلبات، سوشيال، مخزون، CRM، فواتير صيدليات للشهر المحدد',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          year: { type: SchemaType.NUMBER, description: 'سنة (افتراضي السنة الحالية بمصر)' },
          month: { type: SchemaType.NUMBER, description: 'شهر 1-12 (افتراضي الشهر الحالي بمصر)' },
        },
      },
    },
    {
      name: 'get_inventory',
      description: 'قائمة أصناف المخزن مع الكميات والأسعار',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          filter: { type: SchemaType.STRING, description: 'all | low | out | in_stock' },
          search: { type: SchemaType.STRING, description: 'بحث باسم المنتج' },
          limit: { type: SchemaType.NUMBER, description: 'حد أقصى للنتائج (افتراضي 80)' },
        },
      },
    },
    {
      name: 'get_pharmacy_overdue',
      description: 'فواتير الصيدليات المتأخرة (باقي مستحق + due_date فات)',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          limit: { type: SchemaType.NUMBER },
          region: { type: SchemaType.STRING },
        },
      },
    },
    {
      name: 'get_pharmacy_invoices',
      description: 'بحث/فلترة فواتير الصيدليات (حالة تحصيل، تاريخ، اسم صيدلية)',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          status: { type: SchemaType.STRING, description: 'overdue | open | paid | no_date | all' },
          from_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD invoice_date من' },
          to_date: { type: SchemaType.STRING, description: 'YYYY-MM-DD invoice_date إلى' },
          search: { type: SchemaType.STRING, description: 'اسم صيدلية أو رقم فاتورة' },
          limit: { type: SchemaType.NUMBER },
        },
      },
    },
    {
      name: 'get_orders',
      description: 'طلبات المتجر حسب يوم أو فترة أو حالة أو قناة',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING, description: 'يوم واحد YYYY-MM-DD (النهاردة لو عايز اليوم)' },
          from_date: { type: SchemaType.STRING },
          to_date: { type: SchemaType.STRING },
          status: { type: SchemaType.STRING, description: 'pending|confirmed|preparing|shipped|delivered|cancelled|all' },
          channel: { type: SchemaType.STRING, description: 'web|messenger|instagram|manychat|whatsapp|all' },
          limit: { type: SchemaType.NUMBER },
        },
      },
    },
    {
      name: 'get_order_detail',
      description: 'تفاصيل طلب برقم MON-xxxxx',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          order_number: { type: SchemaType.STRING },
        },
        required: ['order_number'],
      },
    },
    {
      name: 'get_crm_visits',
      description: 'زيارات المندوبين ليوم أو فترة',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          date: { type: SchemaType.STRING },
          from_date: { type: SchemaType.STRING },
          to_date: { type: SchemaType.STRING },
          rep_name: { type: SchemaType.STRING },
          flagged_only: { type: SchemaType.BOOLEAN, description: 'زيارات GPS flagged فقط' },
          limit: { type: SchemaType.NUMBER },
        },
      },
    },
    {
      name: 'get_reps_performance',
      description: 'قائمة المندوبين مع عدد زيارات الشهر',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          year: { type: SchemaType.NUMBER },
          month: { type: SchemaType.NUMBER },
        },
      },
    },
    {
      name: 'search_clients',
      description: 'بحث أطباء/صيدليات في CRM',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          query: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING, description: 'doctor|pharmacy|all' },
          limit: { type: SchemaType.NUMBER },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_today_snapshot',
      description: 'لقطة سريعة ليوم النهاردة بمصر: طلبات، إيراد تقريبي، متأخرات، مخزون منخفض',
      parameters: { type: SchemaType.OBJECT, properties: {} },
    },
    {
      name: 'export_csv_report',
      description: 'يجهّز تقرير CSV للتنزيل (متأخرات / مخزون / طلبات يوم أو فترة)',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          report_type: {
            type: SchemaType.STRING,
            description: 'overdue | inventory | orders | pharmacy_month',
          },
          date: { type: SchemaType.STRING },
          from_date: { type: SchemaType.STRING },
          to_date: { type: SchemaType.STRING },
          year: { type: SchemaType.NUMBER },
          month: { type: SchemaType.NUMBER },
        },
        required: ['report_type'],
      },
    },
  ],
}];

async function runTool(name, args = {}) {
  const sb = adminClient();
  const now = egyptNowParts();
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 150);

  if (name === 'get_dashboard_summary') {
    const year = Number(args.year) || now.year;
    const month = Number(args.month) || now.month;
    const { data, error } = await sb.rpc('get_owner_dashboard', { p_year: year, p_month: month });
    if (error) return { error: error.message };
    return {
      period: { year, month },
      store: data?.store || {},
      inventory: data?.inventory || {},
      pharmacy_ar: data?.pharmacy_ar || {},
      crm: data?.crm || {},
      invoices: data?.invoices || {},
      channels: data?.channels || [],
      generated_at_egypt: now.date,
    };
  }

  if (name === 'get_inventory') {
    let q = sb.from('products')
      .select('id, name, stock, price, is_active')
      .eq('is_active', true)
      .order('stock', { ascending: true })
      .limit(limit);
    const filter = String(args.filter || 'all');
    if (filter === 'low') q = q.gt('stock', 0).lte('stock', 10);
    else if (filter === 'out') q = q.lte('stock', 0);
    else if (filter === 'in_stock') q = q.gt('stock', 0);
    if (args.search) q = q.ilike('name', `%${args.search}%`);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const rows = data || [];
    return {
      filter,
      count: rows.length,
      total_units: rows.reduce((s, p) => s + (p.stock || 0), 0),
      items: rows.map((p) => ({
        name: p.name,
        stock: p.stock,
        price: p.price,
        status: (p.stock || 0) <= 0 ? 'out' : (p.stock <= 10 ? 'low' : 'ok'),
      })),
    };
  }

  if (name === 'get_pharmacy_overdue') {
    const today = now.date;
    let q = sb.from('crm_pharmacy_invoices')
      .select('id, invoice_number, pharmacy_name, region, invoice_date, due_date, total, amount_paid, bottles, status, price_list')
      .neq('status', 'cancelled')
      .neq('status', 'paid')
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .order('due_date', { ascending: true })
      .limit(limit);
    if (args.region) q = q.ilike('region', `%${args.region}%`);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const rows = (data || [])
      .map((r) => ({
        ...r,
        remaining: Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0)),
      }))
      .filter((r) => r.remaining > 0);
    return {
      as_of: today,
      count: rows.length,
      remaining_total: rows.reduce((s, r) => s + r.remaining, 0),
      invoices: rows.slice(0, limit).map((r) => ({
        invoice_number: r.invoice_number,
        pharmacy_name: r.pharmacy_name,
        region: r.region,
        due_date: r.due_date,
        remaining: Math.round(r.remaining),
        total: Math.round(Number(r.total || 0)),
        bottles: r.bottles,
        price_list: r.price_list,
      })),
    };
  }

  if (name === 'get_pharmacy_invoices') {
    const today = now.date;
    let q = sb.from('crm_pharmacy_invoices')
      .select('id, invoice_number, pharmacy_name, region, invoice_date, due_date, total, amount_paid, bottles, status, price_list')
      .neq('status', 'cancelled')
      .order('invoice_date', { ascending: false })
      .limit(200);
    if (args.from_date) q = q.gte('invoice_date', args.from_date);
    if (args.to_date) q = q.lte('invoice_date', args.to_date);
    if (args.search) {
      q = q.or(`pharmacy_name.ilike.%${args.search}%,invoice_number.ilike.%${args.search}%`);
    }
    const { data, error } = await q;
    if (error) return { error: error.message };
    const status = String(args.status || 'all');
    let rows = (data || []).map((r) => {
      const remaining = Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0));
      let collection = 'open';
      if (r.status === 'paid' || remaining <= 0) collection = 'paid';
      else if (!r.due_date) collection = 'no_date';
      else if (r.due_date < today) collection = 'overdue';
      return { ...r, remaining, collection_status: collection };
    });
    if (status !== 'all') rows = rows.filter((r) => r.collection_status === status);
    rows = rows.slice(0, limit);
    return {
      count: rows.length,
      remaining_total: rows.reduce((s, r) => s + r.remaining, 0),
      invoices: rows.map((r) => ({
        invoice_number: r.invoice_number,
        pharmacy_name: r.pharmacy_name,
        region: r.region,
        invoice_date: r.invoice_date,
        due_date: r.due_date,
        remaining: Math.round(r.remaining),
        total: Math.round(Number(r.total || 0)),
        bottles: r.bottles,
        status: r.collection_status,
        price_list: r.price_list,
      })),
    };
  }

  if (name === 'get_orders') {
    let from = args.from_date;
    let to = args.to_date;
    if (args.date) {
      from = args.date;
      to = args.date;
    }
    if (!from && !to) {
      from = now.date;
      to = now.date;
    }
    const start = dayBoundsISO(from).start;
    const end = dayBoundsISO(to).end;
    let q = sb.from('orders')
      .select('order_number, customer_name, customer_phone, total, status, payment_method, payment_status, chat_channel, created_at, governorate')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (args.status && args.status !== 'all') q = q.eq('status', args.status);
    if (args.channel && args.channel !== 'all') q = q.eq('chat_channel', args.channel);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const rows = data || [];
    return {
      from,
      to,
      count: rows.length,
      revenue: Math.round(rows.reduce((s, o) => s + Number(o.total || 0), 0)),
      by_status: rows.reduce((acc, o) => {
        acc[o.status || 'unknown'] = (acc[o.status || 'unknown'] || 0) + 1;
        return acc;
      }, {}),
      by_channel: rows.reduce((acc, o) => {
        const ch = o.chat_channel || 'web';
        acc[ch] = (acc[ch] || 0) + 1;
        return acc;
      }, {}),
      orders: rows.map((o) => ({
        order_number: o.order_number,
        customer_name: o.customer_name,
        phone: o.customer_phone,
        total: Math.round(Number(o.total || 0)),
        status: o.status,
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        channel: o.chat_channel || 'web',
        governorate: o.governorate,
        created_at: o.created_at,
      })),
    };
  }

  if (name === 'get_order_detail') {
    const on = String(args.order_number || '').trim();
    const { data: order, error } = await sb.from('orders')
      .select('*')
      .eq('order_number', on)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!order) return { error: 'الطلب غير موجود' };
    const { data: items } = await sb.from('order_items')
      .select('product_name, quantity, unit_price, total')
      .eq('order_id', order.id);
    return {
      order: {
        order_number: order.order_number,
        customer_name: order.customer_name,
        phone: order.customer_phone,
        address: order.address,
        city: order.city,
        governorate: order.governorate,
        total: order.total,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        discount: order.discount,
        status: order.status,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        deposit_amount: order.deposit_amount,
        channel: order.chat_channel || 'web',
        created_at: order.created_at,
      },
      items: items || [],
    };
  }

  if (name === 'get_crm_visits') {
    let from = args.from_date || args.date || now.date;
    let to = args.to_date || args.date || from;
    const start = dayBoundsISO(from).start;
    const end = dayBoundsISO(to).end;
    let q = sb.from('crm_visits')
      .select('id, visited_at, visit_type, time_of_day, gps_verified, distance_from_doctor, notes, crm_reps(name), crm_doctors(name, address)')
      .gte('visited_at', start)
      .lt('visited_at', end)
      .order('visited_at', { ascending: false })
      .limit(limit);
    if (args.flagged_only) q = q.eq('gps_verified', false);
    const { data, error } = await q;
    if (error) return { error: error.message };
    let rows = data || [];
    if (args.rep_name) {
      const needle = String(args.rep_name).toLowerCase();
      rows = rows.filter((v) => (v.crm_reps?.name || '').toLowerCase().includes(needle));
    }
    return {
      from,
      to,
      count: rows.length,
      flagged: rows.filter((v) => !v.gps_verified).length,
      visits: rows.map((v) => ({
        rep: v.crm_reps?.name,
        doctor: v.crm_doctors?.name,
        address: v.crm_doctors?.address,
        visited_at: v.visited_at,
        type: v.visit_type,
        time_of_day: v.time_of_day,
        gps_ok: !!v.gps_verified,
        distance_m: v.distance_from_doctor,
        notes: v.notes ? String(v.notes).slice(0, 120) : null,
      })),
    };
  }

  if (name === 'get_reps_performance') {
    const year = Number(args.year) || now.year;
    const month = Number(args.month) || now.month;
    const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+03:00`;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+03:00`;
    const { data: reps, error } = await sb.from('crm_reps')
      .select('id, name, role, active, territory, phone')
      .eq('active', true)
      .order('name');
    if (error) return { error: error.message };
    const { data: visits } = await sb.from('crm_visits')
      .select('rep_id, gps_verified')
      .gte('visited_at', start)
      .lt('visited_at', end);
    const byRep = {};
    for (const v of visits || []) {
      if (!byRep[v.rep_id]) byRep[v.rep_id] = { visits: 0, flagged: 0 };
      byRep[v.rep_id].visits += 1;
      if (!v.gps_verified) byRep[v.rep_id].flagged += 1;
    }
    return {
      period: { year, month },
      reps: (reps || []).map((r) => ({
        name: r.name,
        role: r.role,
        territory: r.territory,
        phone: r.phone,
        visits_month: byRep[r.id]?.visits || 0,
        flagged_month: byRep[r.id]?.flagged || 0,
      })),
    };
  }

  if (name === 'search_clients') {
    const query = String(args.query || '').trim();
    if (!query) return { error: 'query required' };
    let q = sb.from('crm_doctors')
      .select('id, name, phone, address, doctor_type, org_type, is_active, crm_bricks(name)')
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%,address.ilike.%${query}%`)
      .order('name')
      .limit(limit);
    const t = String(args.type || 'all');
    if (t === 'pharmacy') q = q.ilike('doctor_type', '%pharm%');
    else if (t === 'doctor') q = q.not('doctor_type', 'ilike', '%pharm%');
    const { data, error } = await q;
    if (error) return { error: error.message };
    return {
      count: (data || []).length,
      clients: (data || []).map((d) => ({
        name: d.name,
        phone: d.phone,
        address: d.address,
        type: d.doctor_type || d.org_type,
        active: d.is_active,
        brick: d.crm_bricks?.name,
      })),
    };
  }

  if (name === 'get_today_snapshot') {
    const [orders, overdue, low] = await Promise.all([
      runTool('get_orders', { date: now.date, limit: 100 }),
      runTool('get_pharmacy_overdue', { limit: 20 }),
      runTool('get_inventory', { filter: 'low', limit: 20 }),
    ]);
    return {
      date: now.date,
      orders_today: { count: orders.count, revenue: orders.revenue, by_channel: orders.by_channel, by_status: orders.by_status },
      pharmacy_overdue: { count: overdue.count, remaining_total: overdue.remaining_total },
      low_stock_count: low.count,
      sample_low_stock: (low.items || []).slice(0, 8),
      sample_orders: (orders.orders || []).slice(0, 8),
    };
  }

  if (name === 'export_csv_report') {
    const type = String(args.report_type || '');
    let rows = [];
    let filename = `montana-report-${now.date}.csv`;

    if (type === 'overdue') {
      const r = await runTool('get_pharmacy_overdue', { limit: 200 });
      rows = (r.invoices || []).map((i) => ({
        invoice_number: i.invoice_number,
        pharmacy: i.pharmacy_name,
        region: i.region,
        due_date: i.due_date,
        remaining: i.remaining,
        total: i.total,
        bottles: i.bottles,
        price_list: i.price_list,
      }));
      filename = `pharmacy-overdue-${now.date}.csv`;
    } else if (type === 'inventory') {
      const r = await runTool('get_inventory', { filter: 'all', limit: 200 });
      rows = (r.items || []).map((i) => ({
        name: i.name,
        stock: i.stock,
        price: i.price,
        status: i.status,
      }));
      filename = `inventory-${now.date}.csv`;
    } else if (type === 'orders') {
      const r = await runTool('get_orders', {
        date: args.date,
        from_date: args.from_date,
        to_date: args.to_date,
        limit: 200,
      });
      rows = (r.orders || []).map((o) => ({
        order_number: o.order_number,
        customer: o.customer_name,
        phone: o.phone,
        total: o.total,
        status: o.status,
        channel: o.channel,
        governorate: o.governorate,
        created_at: o.created_at,
      }));
      filename = `orders-${r.from || now.date}.csv`;
    } else if (type === 'pharmacy_month') {
      const year = Number(args.year) || now.year;
      const month = Number(args.month) || now.month;
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const toDay = new Date(`${nextY}-${String(nextM).padStart(2, '0')}-01T00:00:00+03:00`);
      toDay.setDate(toDay.getDate() - 1);
      const to = toDay.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
      const r = await runTool('get_pharmacy_invoices', { from_date: from, to_date: to, status: 'all', limit: 200 });
      rows = (r.invoices || []).map((i) => ({
        invoice_number: i.invoice_number,
        pharmacy: i.pharmacy_name,
        region: i.region,
        invoice_date: i.invoice_date,
        due_date: i.due_date,
        remaining: i.remaining,
        total: i.total,
        bottles: i.bottles,
        status: i.status,
        price_list: i.price_list,
      }));
      filename = `pharmacy-${year}-${String(month).padStart(2, '0')}.csv`;
    } else {
      return { error: 'report_type غير معروف. استخدم: overdue | inventory | orders | pharmacy_month' };
    }

    return {
      filename,
      row_count: rows.length,
      csv: toCsv(rows),
      note: rows.length ? 'تم تجهيز الملف للتنزيل' : 'مفيش صفوف للتصدير',
    };
  }

  return { error: `أداة غير معروفة: ${name}` };
}

function historyToGemini(history) {
  const out = [];
  for (const m of history || []) {
    if (!m?.text) continue;
    const role = m.role === 'model' || m.role === 'assistant' ? 'model' : 'user';
    out.push({ role, parts: [{ text: String(m.text).slice(0, 4000) }] });
  }
  return out.slice(-16);
}

async function handleOwnerAssistant({ accessToken, message, history }) {
  await assertOwner(accessToken);
  if (!genAI) {
    const err = new Error('مساعد محمد عابد غير متاح حاليًا (GEMINI_API_KEY)');
    err.status = 503;
    throw err;
  }
  if (!SERVICE_KEY) {
    const err = new Error('SERVER misconfigured (SERVICE_ROLE)');
    err.status = 503;
    throw err;
  }

  const text = String(message || '').trim().slice(0, 4000);
  if (!text) {
    const err = new Error('message required');
    err.status = 400;
    throw err;
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools,
    generationConfig: { maxOutputTokens: 8192 },
  });

  const now = egyptNowParts();
  const chat = model.startChat({
    history: [
      {
        role: 'user',
        parts: [{ text: `(سياق النظام: النهاردة بمصر ${now.date}، الساعة تقريبية حسب السيرفر. أنت محمد عابد مساعد المالك.)` }],
      },
      {
        role: 'model',
        parts: [{ text: `تمام — أنا محمد عابد، جاهز أجاوبك من بيانات مونتانيا المباشرة. النهاردة ${now.date}.` }],
      },
      ...historyToGemini(history),
    ],
  });

  let result = await chat.sendMessage(text);
  let calls = result.response.functionCalls();
  let download = null;
  let guard = 0;

  while (calls?.length && guard < 8) {
    const responses = [];
    for (const call of calls) {
      const output = await runTool(call.name, call.args || {});
      if (call.name === 'export_csv_report' && output?.csv) {
        download = { filename: output.filename, csv: output.csv, row_count: output.row_count };
      }
      // Don't send huge CSV back into the model context
      const forModel = output?.csv
        ? { filename: output.filename, row_count: output.row_count, note: output.note }
        : output;
      responses.push({
        functionResponse: { name: call.name, response: forModel },
      });
    }
    result = await chat.sendMessage(responses);
    calls = result.response.functionCalls();
    guard += 1;
  }

  let reply = result.response.text() || 'تمام — لو حابب تفاصيل أكتر، حدّد اليوم أو النوع اللي محتاجه.';
  return { reply, download, date: now.date };
}

module.exports = { handleOwnerAssistant, assertOwner, egyptToday };
