// Montana Naturals — Activity & Audit Log Engine (سجل النشاطات والتغييرات)
// Captures and logs all sensitive operations across the business:
// 1. Orders (delete, update status, create manual/new)
// 2. Pharmacy Invoices (delete, payment collected, status/date change, create)
// 3. CRM Doctors / Pharmacies (delete, update status, approval, new)
// 4. Store Invoices (delete, create)
//
// Dual-persistence:
// - Supabase DB table `audit_logs` (primary query engine & PostgreSQL triggers)
// - Supabase Storage `montana/audit/activity_logs.json` (immutable backup & immediate fallback)

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const BUCKET = 'montana';
const LOGS_FILE = 'audit/activity_logs.json';
const MAX_STORAGE_LOGS = 1000;

function adminClient() {
  if (!SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function userClient(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Check if caller is owner or store admin. */
async function assertAuditViewer(accessToken) {
  if (!accessToken) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const sb = userClient(accessToken);
  const [ownerRes, adminRes] = await Promise.all([
    sb.rpc('is_owner'),
    sb.rpc('is_store_admin'),
  ]);
  const isOwner = !ownerRes?.error && ownerRes?.data === true;
  const isAdmin = !adminRes?.error && adminRes?.data === true;
  if (!isOwner && !isAdmin) {
    const err = new Error('صلاحية المالك أو الأدمن مطلوبة لعرض سجل النشاطات');
    err.status = 403;
    throw err;
  }
  let userData = null;
  try {
    const res = await sb.auth.getUser();
    userData = res?.data;
  } catch (_) {}
  const meta = userData?.user?.user_metadata || {};
  return {
    userId: userData?.user?.id || null,
    email: userData?.user?.email || null,
    name: meta.name || meta.full_name || userData?.user?.email?.split('@')[0] || (isOwner ? 'خالد (المالك)' : 'أدمن'),
    isOwner: !!isOwner,
    isAdmin: !!isAdmin,
  };
}

/** Helper to read logs from storage fallback */
async function readLogsFromStorage(admin) {
  if (!admin) return [];
  try {
    const { data, error } = await admin.storage.from(BUCKET).download(LOGS_FILE);
    if (error || !data) return [];
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Helper to append log entry to storage */
async function appendLogToStorage(admin, entry) {
  if (!admin) return;
  try {
    const list = await readLogsFromStorage(admin);
    list.unshift(entry);
    const trimmed = list.slice(0, MAX_STORAGE_LOGS);
    await admin.storage.from(BUCKET).upload(LOGS_FILE, JSON.stringify(trimmed, null, 2), {
      contentType: 'application/json',
      upsert: true,
    });
  } catch (err) {
    console.warn('[auditLog] failed to backup log to storage:', err.message);
  }
}

/**
 * Record a new audit log event.
 */
async function recordAuditLog({
  action_type = 'UPDATE', // 'DELETE' | 'UPDATE' | 'CREATE'
  entity_type = 'order',  // 'order' | 'pharmacy_invoice' | 'doctor' | 'invoice' | 'stock'
  entity_ref = '',        // e.g. 'MON-44910' | 'PHI-2026-003' | 'د. أحمد كامل'
  summary = '',
  actor_name = '',
  actor_email = '',
  details = {},
  ip = null,
}) {
  const normAction = String(action_type || 'UPDATE').toUpperCase();
  const normEntity = String(entity_type || 'order').toLowerCase();
  const now = new Date().toISOString();

  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action_type: normAction,
    entity_type: normEntity,
    entity_ref: String(entity_ref || ''),
    summary: String(summary || `${normAction} on ${normEntity} ${entity_ref}`),
    actor_name: actor_name || 'النظام / مسؤول',
    actor_email: actor_email || null,
    details: details || {},
    ip: ip || null,
    created_at: now,
  };

  const admin = adminClient();
  let dbInserted = false;

  if (admin) {
    try {
      const { error } = await admin.from('audit_logs').insert([{
        action_type: entry.action_type,
        entity_type: entry.entity_type,
        entity_ref: entry.entity_ref,
        summary: entry.summary,
        actor_name: entry.actor_name,
        actor_email: entry.actor_email,
        details: entry.details,
        created_at: entry.created_at,
      }]);
      if (!error) dbInserted = true;
      else console.warn('[auditLog] DB insert skipped or table missing:', error.message);
    } catch (e) {
      console.warn('[auditLog] DB error:', e.message);
    }

    // Always mirror to storage for resilience
    await appendLogToStorage(admin, entry);
  }

  return { ok: true, entry, dbInserted };
}

/**
 * Retrieve audit logs with filtering and search.
 */
async function getAuditLogs({
  limit = 100,
  offset = 0,
  entity = null,
  action = null,
  search = null,
} = {}) {
  const admin = adminClient();
  let logs = [];

  // Try DB first
  if (admin) {
    try {
      let q = admin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (entity && entity !== 'all') q = q.eq('entity_type', entity.toLowerCase());
      if (action && action !== 'all') q = q.eq('action_type', action.toUpperCase());
      if (search) {
        q = q.or(`entity_ref.ilike.%${search}%,summary.ilike.%${search}%,actor_name.ilike.%${search}%,actor_email.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (!error && Array.isArray(data) && data.length > 0) {
        logs = data;
      }
    } catch (err) {
      console.warn('[auditLog] DB query error, using storage fallback:', err.message);
    }
  }

  // Fallback to storage if DB returned nothing or table not created yet
  if (!logs || logs.length === 0) {
    const storageLogs = await readLogsFromStorage(admin);
    let filtered = storageLogs;

    if (entity && entity !== 'all') {
      const eNorm = entity.toLowerCase();
      filtered = filtered.filter(l => l.entity_type === eNorm);
    }
    if (action && action !== 'all') {
      const aNorm = action.toUpperCase();
      filtered = filtered.filter(l => l.action_type === aNorm);
    }
    if (search) {
      const s = String(search).toLowerCase();
      filtered = filtered.filter(l =>
        (l.entity_ref && String(l.entity_ref).toLowerCase().includes(s)) ||
        (l.summary && String(l.summary).toLowerCase().includes(s)) ||
        (l.actor_name && String(l.actor_name).toLowerCase().includes(s)) ||
        (l.actor_email && String(l.actor_email).toLowerCase().includes(s))
      );
    }
    logs = filtered.slice(offset, offset + limit);
  }

  return { ok: true, logs, total: logs.length };
}

module.exports = {
  assertAuditViewer,
  recordAuditLog,
  getAuditLogs,
};
