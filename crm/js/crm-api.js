// Montana CRM — client API layer
// Talks directly to Supabase (anon key + RLS), matching this project's existing pattern (see admin.js).

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const REP_CACHE_KEY = 'crm_rep_cache';

async function repFor(userId) {
  if (!userId) return null;
  const cached = (() => { try { const c = JSON.parse(localStorage.getItem(REP_CACHE_KEY)); return c?.user_id === userId ? c : null; } catch { return null; } })();
  if (cached) return cached;
  const { data } = await sb.from('crm_reps').select('*, crm_offices(name)').eq('user_id', userId).maybeSingle();
  if (data) localStorage.setItem(REP_CACHE_KEY, JSON.stringify(data));
  return data || null;
}

export const auth = {
  async login(email, password, { role = 'rep' } = {}) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const rep = await repFor(data.user.id);
    if (rep?.active) {
      if (role === 'admin' && rep.role !== 'admin') {
        throw new Error('This account is a sales rep, not a CRM admin.');
      }
      return { user: data.user, rep };
    }
    const canAdmin = await isCrmAdminAccess();
    if (canAdmin && role === 'admin') {
      return { user: data.user, rep: null, storeAdmin: true };
    }
    throw new Error('No active CRM account for this user.');
  },
  async logout() { localStorage.removeItem(REP_CACHE_KEY); await sb.auth.signOut(); },
  async me() {
    const { data } = await sb.auth.getSession();
    const user = data?.session?.user;
    if (!user) return null;
    const rep = await repFor(user.id);
    return { user, rep };
  }
};

/** Store admin or CRM admin — used for admin panel access gate */
export async function isCrmAdminAccess() {
  const { data, error } = await sb.rpc('is_crm_admin');
  if (error) return false;
  return data === true;
}

export const geo = {
  bricks: async () => {
    const { data, error } = await sb.from('crm_bricks').select('*, crm_areas(name, crm_offices(name))').order('name');
    if (error) throw error;
    return data;
  },
  repBricks: async (repId) => {
    const { data, error } = await sb.from('crm_rep_bricks').select('brick_id, crm_bricks(*)').eq('rep_id', repId);
    if (error) throw error;
    return (data || []).map(r => r.crm_bricks);
  }
};

export const doctors = {
  list: async () => {
    const { data, error } = await sb.from('crm_doctors').select('*, crm_bricks(name)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  get: async (id) => {
    const { data, error } = await sb.from('crm_doctors').select('*, crm_bricks(name)').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  create: async (doctor) => {
    const { data: { session } } = await sb.auth.getSession();
    const rep = await repFor(session?.user?.id);
    const payload = { ...doctor, added_by: rep?.id || null, approved: rep?.role === 'admin' };
    const { data, error } = await sb.from('crm_doctors').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, patch) => {
    const { data, error } = await sb.from('crm_doctors').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  // Bulk insert (Excel import) — chunked so large sheets don't hit limits
  createMany: async (rows) => {
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await sb.from('crm_doctors').insert(rows.slice(i, i + 200)).select('id');
      if (error) throw new Error(`Row ${i + 1}+: ${error.message}`);
      inserted += data.length;
    }
    return inserted;
  }
};

export const products = {
  // includes crm_materials — the rep Materials screen and the admin
  // eDetailing counters both read p.crm_materials off this result
  list: async () => {
    const { data, error } = await sb.from('crm_products').select('*, crm_materials(*)').order('name');
    if (error) throw error;
    return data;
  },
  create: async (product) => {
    const { data, error } = await sb.from('crm_products').insert(product).select().single();
    if (error) throw error;
    return data;
  },
  update: async (id, patch) => {
    const { data, error } = await sb.from('crm_products').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  listWithStock: async () => {
    const { data, error } = await sb.rpc('list_rep_sample_stock');
    if (error) throw error;
    return data || [];
  },
  listStoreCatalog: async () => {
    const { data, error } = await sb.rpc('list_rep_store_catalog');
    if (error) throw error;
    return data || [];
  },
  syncStoreLinks: async () => {
    const { data, error } = await sb.rpc('sync_crm_store_product_links');
    if (error) throw error;
    return data;
  },
  ensureFromStore: async () => {
    const { data, error } = await sb.rpc('ensure_crm_products_from_store');
    if (error) throw error;
    return data;
  }
};

export const materials = {
  list: async () => {
    const { data, error } = await sb.from('crm_materials').select('*, crm_products(name)').eq('active', true).order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async upload(file, productId, title, type) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const key = `crm-materials/${Date.now()}_${file.name}`;
    const { error: upErr } = await sb.storage.from('montana').upload(key, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    const { data: pub } = sb.storage.from('montana').getPublicUrl(key);
    const { data, error } = await sb.from('crm_materials').insert({
      product_id: productId,
      title: title || file.name,
      type: type || (ext === 'pdf' ? 'pdf' : 'image'),
      url: pub.publicUrl
    }).select().single();
    if (error) throw error;
    return data;
  }
};

// Admin: upload/browse reconciliation spreadsheets (e.g. distributor sales
// sheets) — stored as plain files for reference/download, not auto-parsed.
export const salesFileUploads = {
  list: async () => {
    const { data, error } = await sb.storage.from('montana').list('crm-sales-imports', {
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) throw error;
    return (data || []).filter((f) => f.name && !f.name.startsWith('.'));
  },
  upload: async (file) => {
    const key = `crm-sales-imports/${Date.now()}_${file.name}`;
    const { error } = await sb.storage.from('montana').upload(key, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return key;
  },
  urlFor: (name) => sb.storage.from('montana').getPublicUrl(`crm-sales-imports/${name}`).data.publicUrl,
  remove: async (name) => {
    const { error } = await sb.storage.from('montana').remove([`crm-sales-imports/${name}`]);
    if (error) throw error;
  },
};

export const plans = {
  currentPlan: async (repId) => {
    const month = new Date(); month.setDate(1);
    const monthStr = month.toISOString().slice(0, 10);
    const { data: plan } = await sb.from('crm_cycle_plans').select('*').eq('rep_id', repId).eq('month', monthStr).maybeSingle();
    if (!plan) return { plan: null, items: [] };
    const { data: items, error } = await sb.from('crm_plan_items').select('*, crm_doctors(*, crm_bricks(name))').eq('cycle_plan_id', plan.id);
    if (error) throw error;
    return { plan, items: items || [] };
  },
  ensurePlan: async (repId) => {
    const month = new Date(); month.setDate(1);
    const monthStr = month.toISOString().slice(0, 10);
    let { data: plan } = await sb.from('crm_cycle_plans').select('*').eq('rep_id', repId).eq('month', monthStr).maybeSingle();
    if (!plan) {
      const ins = await sb.from('crm_cycle_plans').insert({ rep_id: repId, month: monthStr, status: 'active' }).select().single();
      if (ins.error) throw ins.error;
      plan = ins.data;
    }
    return plan;
  },
  addItem: async (planId, doctorId, plannedVisits = 1) => {
    const { data, error } = await sb.from('crm_plan_items')
      .insert({ cycle_plan_id: planId, doctor_id: doctorId, planned_visits: plannedVisits, completed_visits: 0 })
      .select('*, crm_doctors(*, crm_bricks(name))').single();
    if (error) throw error;
    return data;
  },
  removeItem: async (itemId) => {
    const { error } = await sb.from('crm_plan_items').delete().eq('id', itemId);
    if (error) throw error;
  },
  // Accepts a number (planned visits — legacy) or a patch object,
  // e.g. { preferred_time: 'PM' } for the rep's AM/PM schedule slot.
  updateItem: async (itemId, patch) => {
    if (typeof patch === 'number') patch = { planned_visits: patch };
    const { data, error } = await sb.from('crm_plan_items').update(patch).eq('id', itemId).select().single();
    if (error) throw error;
    return data;
  },
  // Fill this month's plan from doctor classes (AB1→4, AB2→3, BB1→2, BB2→1
  // visits — crm_class_rules). Skips doctors already in the plan.
  autoGenerate: async () => {
    const { data, error } = await sb.rpc('crm_generate_plan');
    if (error) throw error;
    return data; // { plan_id, added }
  }
};

export const visits = {
  // GPS verification, the plan-item counter and the first-visit doctor
  // location are all handled by database triggers (003_crm_hardening.sql) —
  // the client only sends raw coordinates. client_id makes the insert
  // idempotent so the offline queue can never create duplicates.
  submit: async (v) => {
    const { data: { session } } = await sb.auth.getSession();
    const rep = await repFor(session.user.id);
    const doctorId = v.doctor_id || v.doctorId;
    const planItemId = v.plan_item_id || v.planItemId;
    const clientId = v.client_id || crypto.randomUUID();

    let photoUrl = null;
    if (v.photo_data) {
      try {
        const blob = await (await fetch(v.photo_data)).blob();
        const key = `crm-visits/${clientId}.jpg`;
        const { error: phErr } = await sb.storage.from('montana').upload(key, blob, { contentType: 'image/jpeg', upsert: true });
        if (!phErr) photoUrl = sb.storage.from('montana').getPublicUrl(key).data.publicUrl;
      } catch { /* photo is optional — never block the visit report */ }
    }

    const { data: visit, error } = await sb.from('crm_visits').insert({
      client_id: clientId,
      rep_id: rep.id, doctor_id: doctorId, plan_item_id: planItemId || null,
      lat: v.lat, lng: v.lng,
      notes: v.notes || null, competitor_products: v.competitor_products || v.competitorProducts || [],
      time_of_day: v.time_of_day || 'AM', visit_type: v.visit_type || 'regular',
      needs_b2b_invoice: !!v.needs_b2b_invoice,
      photo_url: photoUrl,
      financial_requests: v.financial_requests || []
    }).select().single();
    if (error) {
      // 23505 = this client_id was already inserted (offline retry) — done
      if (error.code === '23505') return { duplicate: true, client_id: clientId };
      throw error;
    }

    if (v.samples && v.samples.length) {
      const rows = v.samples
        .map(s => ({ visit_id: visit.id, product_id: s.product_id || s.productId, quantity: s.qty ?? s.quantity ?? 0 }))
        .filter(s => s.quantity > 0);
      if (rows.length) await sb.from('crm_visit_samples').insert(rows);
    }
    if (v.products && v.products.length) {
      await sb.from('crm_visit_products').insert(v.products.map(pid => ({ visit_id: visit.id, product_id: pid })));
    }
    if (v.materials && v.materials.length) {
      await sb.from('crm_visit_materials').insert(v.materials.map(m => ({ visit_id: visit.id, material_id: m.id, seconds_viewed: m.seconds || 0 })));
    }
    return visit;
  },
  findForDay: async (repId, doctorId, dateKey) => {
    const next = new Date(dateKey + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    const nextKey = next.toISOString().slice(0, 10);
    const { data, error } = await sb.from('crm_visits')
      .select('*, crm_visit_samples(quantity, crm_products(name)), crm_doctors(name)')
      .eq('rep_id', repId)
      .eq('doctor_id', doctorId)
      .gte('visited_at', dateKey)
      .lt('visited_at', nextKey)
      .order('visited_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  /** Latest visit for same doctor + calendar day + AM/PM slot */
  findForDaySlot: async (repId, doctorId, dateKey, timeOfDay = 'AM') => {
    const slot = timeOfDay === 'PM' ? 'PM' : 'AM';
    const next = new Date(dateKey + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    const nextKey = next.toISOString().slice(0, 10);
    const { data, error } = await sb.from('crm_visits')
      .select('*, crm_visit_samples(quantity, crm_products(name)), crm_doctors(name)')
      .eq('rep_id', repId)
      .eq('doctor_id', doctorId)
      .eq('time_of_day', slot)
      .gte('visited_at', dateKey)
      .lt('visited_at', nextKey)
      .order('visited_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  listForDoctorMonth: async (repId, doctorId, year, month) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const { data, error } = await sb.from('crm_visits')
      .select('id, visited_at, time_of_day, visit_type, notes')
      .eq('rep_id', repId)
      .eq('doctor_id', doctorId)
      .gte('visited_at', start)
      .lte('visited_at', end + 'T23:59:59')
      .order('visited_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  myVisits: async (repId) => {
    const { data, error } = await sb.from('crm_visits').select('*, crm_doctors(name), crm_visit_samples(*, crm_products(name))').eq('rep_id', repId).order('visited_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data;
  },
  adminAll: async (opts = {}) => {
    let q = sb.from('crm_visits').select('*, crm_doctors(name, address, doctor_type, crm_bricks(name)), crm_reps(name), crm_visit_samples(*, crm_products(name))').order('visited_at', { ascending: false }).limit(300);
    if (opts.repId) q = q.eq('rep_id', opts.repId);
    if (opts.flagged) q = q.eq('gps_verified', false);
    if (opts.b2bPending) q = q.eq('b2b_invoice_status', 'pending');
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },
  approve: async (id) => {
    const { data, error } = await sb.from('crm_visits').update({ gps_verified: true }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  getAdminStats: async (year, month) => {
    const { data, error } = await sb.rpc('get_admin_visit_stats', {
      p_year: year || null,
      p_month: month || null
    });
    if (error) throw error;
    return data;
  }
};

export const leaderboard = {
  get: async () => {
    const { data, error } = await sb.from('crm_leaderboard').select('*');
    if (error) throw error;
    return data;
  }
};

export const samplesReport = {
  get: async () => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthIso = monthStart.toISOString();
    const { data, error } = await sb.from('crm_visit_samples').select('quantity, crm_products(name), crm_visits(visited_at, rep_id, doctor_id, crm_reps(name), crm_doctors(name, crm_bricks(name)))');
    if (error) throw error;
    return (data || []).filter(s => (s.crm_visits?.visited_at || '') >= monthIso);
  }
};

// Admin: give/reclaim sample custody per rep, and see current balances.
export const sampleCustody = {
  // Per-product rollup: warehouse stock left vs. total already handed to reps.
  summary: async () => {
    const { data, error } = await sb.from('crm_sample_stock_summary').select('*').order('product_name');
    if (error) throw error;
    return data || [];
  },
  // Per-rep × product balances (only non-zero rows are interesting to show).
  list: async () => {
    const { data, error } = await sb.from('crm_rep_sample_custody')
      .select('rep_id, product_id, quantity, updated_at, crm_reps(name), crm_products(name)')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  // The signed-in rep's own balances — RLS already scopes this to their rows.
  mine: async () => {
    const { data, error } = await sb.from('crm_rep_sample_custody').select('product_id, quantity');
    if (error) throw error;
    return data || [];
  },
  // qty > 0 gives samples to the rep, qty < 0 reclaims them back to the warehouse.
  allocate: async (repId, productId, qty, note) => {
    const { data, error } = await sb.rpc('crm_allocate_sample', {
      p_rep_id: repId, p_product_id: productId, p_qty: qty, p_note: note || null,
    });
    if (error) throw error;
    return data;
  },
};

// Rep-created B2B invoices — stock comes out of the rep's own sample
// custody, restricted to doctors/pharmacies in the rep's own bricks.
export const repInvoices = {
  create: async (doctorId, items, amountPaid, paymentType, notes, visitId, dueDate) => {
    const { data, error } = await sb.rpc('crm_rep_create_invoice', {
      p_doctor_id: doctorId, p_items: items, p_amount_paid: amountPaid || 0,
      p_payment_type: paymentType || 'cash', p_notes: notes || null,
      p_visit_id: visitId || null, p_due_date: dueDate || null,
    });
    if (error) throw error;
    return data;
  },
  // items: [{product_id, qty, list_price}] — discount <= 40% auto-creates the
  // invoice; above that it's queued for admin approval over Telegram.
  // Pass doctorId: null + customer: {name, phone, address} for a walk-in
  // client (a pharmacy/doctor not yet registered in the system).
  request: async (doctorId, items, discountPct, amountPaid, paymentType, notes, visitId, dueDate, customer) => {
    const { data, error } = await sb.rpc('crm_rep_request_invoice', {
      p_doctor_id: doctorId, p_items: items, p_discount_pct: discountPct || 0,
      p_amount_paid: amountPaid || 0, p_payment_type: paymentType || 'cash',
      p_notes: notes || null, p_visit_id: visitId || null, p_due_date: dueDate || null,
      p_customer_name: customer?.name || null, p_customer_phone: customer?.phone || null,
      p_customer_address: customer?.address || null,
    });
    if (error) throw error;
    return data;
  },
  myDiscountRequests: async () => {
    const { data, error } = await sb.rpc('crm_rep_list_discount_requests', { p_limit: 20 });
    if (error) throw error;
    return data || [];
  },
  mine: async () => {
    const { data, error } = await sb.rpc('crm_rep_list_invoices', { p_limit: 50 });
    if (error) throw error;
    return data || [];
  },
};

// Fire-and-forget: tells the admin on Telegram that a discount >40% needs approval.
export async function notifyDiscountRequest(payload) {
  try {
    await fetch('/api/crm-visit-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'discount_request', ...payload }),
    });
  } catch { /* non-blocking */ }
}

// Admin: every individual invoice (order-, doctor-, and rep-sourced) for a given month.
export const invoicesAdmin = {
  list: async (year, month) => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const { data, error } = await sb.from('invoices')
      .select('id, invoice_number, invoice_date, due_date, total, amount_paid, status, source_type, payment_type, crm_doctors(name, doctor_type), crm_reps(name)')
      .gte('invoice_date', start).lt('invoice_date', end)
      .order('invoice_date', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  // Attach a doctor_id to an invoice that doesn't have one yet (imported
  // rows, or walk-in invoices later matched to a registered client).
  linkDoctor: async (invoiceId, doctorId) => {
    const { data, error } = await sb.rpc('crm_link_invoice_doctor', { p_invoice_id: invoiceId, p_doctor_id: doctorId });
    if (error) throw error;
    return data;
  },
};

export const visitSchedule = {
  listMonth: async (repId, year, month) => {
    const mm = String(month).padStart(2, '0');
    const last = new Date(year, month, 0).getDate();
    const { data, error } = await sb.from('crm_visit_schedule')
      .select('*, crm_plan_items(*, crm_doctors(*, crm_bricks(name)))')
      .eq('rep_id', repId)
      .gte('scheduled_date', `${year}-${mm}-01`)
      .lte('scheduled_date', `${year}-${mm}-${String(last).padStart(2, '0')}`);
    if (error) throw error;
    return data || [];
  },
  assign: async (repId, planItemId, scheduledDate, timeOfDay = 'AM') => {
    const { data, error } = await sb.from('crm_visit_schedule')
      .upsert(
        { rep_id: repId, plan_item_id: planItemId, scheduled_date: scheduledDate, time_of_day: timeOfDay },
        { onConflict: 'plan_item_id,scheduled_date,time_of_day' }
      )
      .select('*, crm_plan_items(*, crm_doctors(*, crm_bricks(name)))')
      .single();
    if (error) throw error;
    return data;
  },
  unassign: async (scheduleId) => {
    const { error } = await sb.from('crm_visit_schedule').delete().eq('id', scheduleId);
    if (error) throw error;
  },
  updateSlot: async (scheduleId, timeOfDay) => {
    const { data, error } = await sb.from('crm_visit_schedule')
      .update({ time_of_day: timeOfDay })
      .eq('id', scheduleId)
      .select('*, crm_plan_items(*, crm_doctors(*, crm_bricks(name)))')
      .single();
    if (error) throw error;
    return data;
  },
};

export const dayLogs = {
  upsert: async (repId, dayType, notes = null) => {
    const logDate = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb.from('crm_day_logs')
      .upsert({ rep_id: repId, log_date: logDate, day_type: dayType, time_of_day: null, notes }, { onConflict: 'rep_id,log_date' })
      .select().single();
    if (error) throw error;
    return data;
  },
  listMonth: async (repId, year, month) => {
    const mm = String(month).padStart(2, '0');
    const last = new Date(year, month, 0).getDate();
    const { data, error } = await sb.from('crm_day_logs')
      .select('log_date, day_type, time_of_day')
      .eq('rep_id', repId)
      .gte('log_date', `${year}-${mm}-01`)
      .lte('log_date', `${year}-${mm}-${String(last).padStart(2, '0')}`);
    if (error) throw error;
    return data || [];
  },
  /** slot: 'AM' | 'PM' | null — null clears a field-work day (keeps leave/office rows) */
  setWorkSlot: async (repId, logDate, slot) => {
    if (!slot) {
      const { error } = await sb.from('crm_day_logs')
        .delete()
        .eq('rep_id', repId)
        .eq('log_date', logDate)
        .eq('day_type', 'field');
      if (error) throw error;
      return null;
    }
    const { data, error } = await sb.from('crm_day_logs')
      .upsert({
        rep_id: repId,
        log_date: logDate,
        day_type: 'field',
        time_of_day: slot,
        notes: null,
      }, { onConflict: 'rep_id,log_date' })
      .select().single();
    if (error) throw error;
    return data;
  },
};

export const reps = {
  list: async () => {
    const { data, error } = await sb.from('crm_reps').select('*, crm_offices(name)').order('name');
    if (error) throw error;
    return data;
  },
  update: async (id, patch) => {
    const { data, error } = await sb.from('crm_reps').update(patch).eq('id', id).select().single();
    if (error) throw error;
    localStorage.removeItem(REP_CACHE_KEY);
    return data;
  },
  // Rep accounts are created by the admin-users Edge Function using the
  // service-role key (email pre-confirmed, atomic rollback on failure).
  // If the function isn't deployed yet we fall back to the old anon signUp —
  // note the fallback stops working once 003_crm_hardening.sql is applied.
  create: async ({ email, password, name, phone, territory, officeId, brickIds }) => {
    const { data, error } = await sb.functions.invoke('admin-users', {
      body: { action: 'create_rep', email, password, name, phone, territory, officeId, brickIds }
    });
    if (!error) {
      if (data?.error) throw new Error(data.error);
      return data.rep;
    }
    if (!/Failed to send a request/i.test(error.message || '')) {
      throw new Error(await edgeErrorMessage(error) || error.message);
    }
    // ── legacy fallback (Edge Function not deployed) ──
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const sbTemp = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
    const { data: signUp, error: authErr } = await sbTemp.auth.signUp({ email, password });
    if (authErr) throw authErr;
    const userId = signUp.user?.id;
    if (!userId) throw new Error('Account created but pending email confirmation. Ask the rep to verify their email before first login.');
    const clientToUse = signUp.session ? sbTemp : sb;
    const { data: newRep, error: insErr } = await clientToUse.from('crm_reps').insert({
      user_id: userId, name, email, phone, territory,
      office_id: officeId || null, role: 'rep', active: true
    }).select().single();
    if (insErr) throw insErr;
    if (brickIds && brickIds.length) {
      await clientToUse.from('crm_rep_bricks').insert(brickIds.map(bid => ({ rep_id: newRep.id, brick_id: bid })));
    }
    return newRep;
  },
  // Deletes the crm_reps row AND the auth user via the Edge Function.
  setBricks: async (repId, brickIds) => {
    const { error: delErr } = await sb.from('crm_rep_bricks').delete().eq('rep_id', repId);
    if (delErr) throw delErr;
    if (brickIds?.length) {
      const { error: insErr } = await sb.from('crm_rep_bricks').insert(
        brickIds.map(bid => ({ rep_id: repId, brick_id: bid }))
      );
      if (insErr) throw insErr;
    }
    return true;
  },
  brickCounts: async () => {
    const { data, error } = await sb.from('crm_rep_bricks').select('rep_id');
    if (error) throw error;
    const counts = {};
    (data || []).forEach(r => { counts[r.rep_id] = (counts[r.rep_id] || 0) + 1; });
    return counts;
  },
  resetPassword: async (repId, password) => {
    const { data, error } = await sb.functions.invoke('admin-users', {
      body: { action: 'reset_password', repId, password }
    });
    if (error) throw new Error(await edgeErrorMessage(error) || error.message);
    if (data?.error) throw new Error(data.error);
    return true;
  },
  remove: async (repId) => {
    const { data, error } = await sb.functions.invoke('admin-users', {
      body: { action: 'delete_rep', repId }
    });
    if (!error) {
      if (data?.error) throw new Error(data.error);
      return true;
    }
    if (!/Failed to send a request/i.test(error.message || '')) {
      throw new Error(await edgeErrorMessage(error) || error.message);
    }
    // legacy fallback: table row only (auth user survives, but can't log in)
    await sb.from('crm_reps').update({ active: false }).eq('id', repId);
    const { error: delErr } = await sb.from('crm_reps').delete().eq('id', repId);
    if (delErr) throw delErr;
    return true;
  }
};

// Edge Functions return their JSON error body inside a FunctionsHttpError.
async function edgeErrorMessage(error) {
  try { return (await error.context?.json())?.error; } catch { return null; }
}

// ---------- Push notifications ----------
export const VAPID_PUBLIC_KEY = 'BFWNpQFEVPl1VilxlikRQhrCFLeN51aUpYA6Tzl3YWVikUUTk_LRt5w_THK_bzpBZ4kKCGGcJezdydXqi8MjOYA';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export const push = {
  supported: () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  async status() {
    if (!push.supported()) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'off';
  },
  async subscribe(repId) {
    if (!push.supported()) throw new Error('Push notifications are not supported on this device');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notification permission was not granted');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const j = sub.toJSON();
    const { error } = await sb.from('crm_push_subscriptions').upsert(
      { rep_id: repId, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
    return sub;
  },
  async unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await sb.from('crm_push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
};

export const adminPush = {
  supported: () => push.supported(),
  async status() {
    if (!adminPush.supported()) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration('/crm/admin/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'subscribed' : Notification.permission === 'denied' ? 'denied' : 'off';
  },
  async subscribe() {
    if (!adminPush.supported()) throw new Error('Push notifications are not supported');
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.user?.id) throw new Error('Please sign in again');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notification permission was not granted');
    const reg = await navigator.serviceWorker.register('/crm/admin/sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    const j = sub.toJSON();
    const { error } = await sb.from('crm_admin_push_subscriptions').upsert(
      { user_id: session.user.id, endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
      { onConflict: 'endpoint' }
    );
    if (error) throw error;
    return sub;
  },
  async unsubscribe() {
    const reg = await navigator.serviceWorker.getRegistration('/crm/admin/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await sb.from('crm_admin_push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
};

export async function getPharmacyCreditStatus(doctorId, additionalAmount = 0) {
  const { data, error } = await sb.rpc('get_pharmacy_credit_status', {
    p_doctor_id: doctorId,
    p_additional_amount: additionalAmount
  });
  if (error) throw error;
  return data;
}

export async function getRepMonthKpis(repId, year, month) {
  const { data, error } = await sb.rpc('get_rep_month_kpis', {
    p_rep_id: repId,
    p_year: year || null,
    p_month: month || null
  });
  if (error) throw error;
  return data;
}

export const invoiceIntegration = {
  openDoctorInvoice: async (doctorId, visitId) => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again');
    try { localStorage.setItem('__ADMIN_TOKEN__', session.access_token); } catch { /* private mode */ }
    sessionStorage.setItem('__ADMIN_TOKEN__', session.access_token);
    const at = encodeURIComponent(session.access_token);
    let url = `/invoice.html?doctor_id=${encodeURIComponent(doctorId)}&at=${at}`;
    if (visitId) url += `&visit_id=${encodeURIComponent(visitId)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  openSavedInvoice: async (invoiceDbId) => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again');
    try { localStorage.setItem('__ADMIN_TOKEN__', session.access_token); } catch { /* private mode */ }
    sessionStorage.setItem('__ADMIN_TOKEN__', session.access_token);
    const at = encodeURIComponent(session.access_token);
    window.open(`/invoice.html?invoice_id=${invoiceDbId}&at=${at}`, '_blank', 'noopener,noreferrer');
  },
  getDoctorInvoices: async (doctorId) => {
    const { data, error } = await sb.rpc('get_doctor_invoices', { p_doctor_id: doctorId, p_limit: 20 });
    if (error) throw error;
    return data || [];
  },
  getPendingB2b: async () => {
    const { data, error } = await sb.rpc('get_pending_b2b_visits', { p_limit: 50 });
    if (error) throw error;
    return data || [];
  },
  markVisitInvoiced: async (visitId, invoiceId) => {
    const { data, error } = await sb.rpc('mark_visit_invoiced', { p_visit_id: visitId, p_invoice_id: invoiceId });
    if (error) throw error;
    return data;
  },
  dismissB2b: async (visitId) => {
    const { data, error } = await sb.rpc('dismiss_b2b_visit', { p_visit_id: visitId });
    if (error) throw error;
    return data;
  },
  getSalesReport: async (year, month) => {
    const { data, error } = await sb.rpc('get_sales_report', { p_year: year || null, p_month: month || null });
    if (error) throw error;
    return data;
  },
  listStoreProducts: async () => {
    const { data, error } = await sb.rpc('list_store_products_for_link');
    if (error) throw error;
    return data || [];
  },
  getOverdueInvoices: async () => {
    const { data, error } = await sb.rpc('get_overdue_invoices', { p_limit: 50 });
    if (error) throw error;
    return data || [];
  },
  getArSchedule: async () => {
    const { data, error } = await sb.rpc('get_ar_collection_schedule', { p_limit: 100 });
    if (error) throw error;
    return data || [];
  },
  cancelAsReturn: async (invoiceId, reason) => {
    const { data, error } = await sb.rpc('cancel_invoice_as_return', { p_invoice_id: invoiceId, p_reason: reason || null });
    if (error) throw error;
    return data;
  }
};

export async function notifyVisitSubmitted(payload) {
  try {
    await fetch('/api/crm-visit-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch { /* non-blocking */ }
}

// ---------- GPS helpers ----------
export { SUPABASE_URL, SUPABASE_KEY };
export const GPS_THRESHOLD_M = 150;

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(Object.assign(new Error('Geolocation not supported'), { code: 0 })); return; }
    const ok = (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    const fail = (err) => reject(err);
    const lowAcc = { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 };
    const highAcc = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 };
    navigator.geolocation.getCurrentPosition(ok, (err) => {
      navigator.geolocation.getCurrentPosition(ok, fail, lowAcc);
    }, highAcc);
  });
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Offline queue ----------
const QUEUE_KEY = 'crm_offline_queue';
export const offlineQueue = {
  push(visit) {
    const q = offlineQueue.all();
    q.push({ ...visit, queuedAt: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  },
  all() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
  },
  clear() { localStorage.removeItem(QUEUE_KEY); },
  async flush() {
    const q = offlineQueue.all();
    if (!q.length) return { synced: 0 };
    let synced = 0;
    const remaining = [];
    for (const v of q) {
      try { await visits.submit(v); synced++; }
      catch { remaining.push(v); }
    }
    if (remaining.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    else offlineQueue.clear();
    return { synced, remaining: remaining.length };
  }
};
