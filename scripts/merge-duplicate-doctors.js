/**
 * Merge duplicate crm_doctors: keep fullest record, delete rest.
 * Match: same normalized name + same brick, OR same name + same address.
 * Run: node scripts/merge-duplicate-doctors.js
 */
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';

function normName(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-z0-9]/gi, '')
    .trim();
}

function normAddr(a) {
  return String(a || '')
    .toLowerCase()
    .replace(/أ|إ|آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function completeness(d) {
  let s = 0;
  if (d.phone) s += 12;
  const al = (d.address || '').length;
  if (al > 10) s += Math.min(8, Math.floor(al / 20));
  if (d.specialty) s += 3;
  if (d.org_type) s += 2;
  if (d.target_visits_per_month) s += 2;
  if (d.lat && d.lng) s += 5;
  if (d.class) s += 1;
  if (d.credit_limit) s += 2;
  // Prefer Active Giza rows (have phones/street) slightly
  if (/Active Giza/i.test(d.notes || '')) s += 4;
  if (/Active M6/i.test(d.notes || '')) s += 2;
  if (d.is_active !== false) s += 1;
  if (d.approved) s += 1;
  return s;
}

function pickBest(group) {
  return [...group].sort((a, b) => completeness(b) - completeness(a) || String(a.id).localeCompare(String(b.id)))[0];
}

function mergeFields(winner, losers) {
  const all = [winner, ...losers];
  const pick = (fn) => {
    for (const d of all.sort((a, b) => completeness(b) - completeness(a))) {
      const v = fn(d);
      if (v != null && v !== '') return v;
    }
    return null;
  };
  // Longest address wins among non-empty
  const bestAddr = all
    .map((d) => d.address)
    .filter((a) => a && String(a).trim())
    .sort((a, b) => String(b).length - String(a).length)[0] || null;

  const types = all.map((d) => d.doctor_type).filter(Boolean);
  // Prefer non-doctor specificity if any pharmacy/hospital/poly
  let doctor_type = winner.doctor_type || 'doctor';
  for (const t of ['pharmacy', 'hospital', 'polyclinic']) {
    if (types.includes(t)) {
      doctor_type = t;
      break;
    }
  }

  const notesParts = [...new Set(all.map((d) => d.notes).filter(Boolean))];
  const notes = notesParts.join(' || ').slice(0, 2000);

  return {
    phone: pick((d) => d.phone),
    address: bestAddr,
    specialty: pick((d) => d.specialty),
    org_type: pick((d) => d.org_type),
    class: pick((d) => d.class),
    doctor_type,
    target_visits_per_month: pick((d) => d.target_visits_per_month),
    lat: pick((d) => d.lat),
    lng: pick((d) => d.lng),
    credit_limit: pick((d) => d.credit_limit),
    credit_terms_days: pick((d) => d.credit_terms_days),
    brick_id: pick((d) => d.brick_id) || winner.brick_id,
    approved: all.some((d) => d.approved),
    is_active: all.some((d) => d.is_active !== false),
    notes: notes || winner.notes,
  };
}

async function loadAll(sb) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('crm_doctors')
      .select(
        'id,name,address,phone,brick_id,org_type,doctor_type,class,specialty,notes,target_visits_per_month,lat,lng,credit_limit,credit_terms_days,is_active,approved'
      )
      .range(from, from + 999);
    if (error) throw error;
    if (!data.length) break;
    all.push(...data);
    from += 1000;
    if (data.length < 1000) break;
  }
  return all;
}

function buildGroups(all) {
  const groups = new Map();

  const add = (key, d) => {
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  };

  // Pass 1: name + brick
  for (const d of all) {
    const nn = normName(d.name);
    if (!nn || nn.length < 3) continue;
    if (d.brick_id) add(`nb:${nn}|${d.brick_id}`, d);
  }

  // Pass 2: name + substantial address (merge across bricks if same addr)
  for (const d of all) {
    const nn = normName(d.name);
    const na = normAddr(d.address);
    if (!nn || nn.length < 3) continue;
    if (na.length >= 12) add(`na:${nn}|${na}`, d);
  }

  // Union-find style: merge overlapping groups that share an id
  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
    return parent.get(id);
  };
  const union = (a, b) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  for (const [, members] of groups) {
    if (members.length < 2) continue;
    for (let i = 1; i < members.length; i++) union(members[0].id, members[i].id);
  }

  const byRoot = new Map();
  for (const d of all) {
    if (!parent.has(d.id)) continue;
    const r = find(d.id);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(d);
  }

  return [...byRoot.values()].filter((g) => g.length > 1);
}

async function reassignAndDelete(sb, keepId, dropIds) {
  const tables = [
    { table: 'crm_visits', col: 'doctor_id' },
    { table: 'crm_plan_items', col: 'doctor_id' },
    { table: 'crm_week_plan_days', col: 'doctor_id' },
    { table: 'crm_discount_approvals', col: 'doctor_id' },
    { table: 'invoices', col: 'doctor_id' },
    { table: 'crm_pharmacy_invoices', col: 'pharmacy_id' },
  ];

  for (const { table, col } of tables) {
    for (let i = 0; i < dropIds.length; i += 50) {
      const chunk = dropIds.slice(i, i + 50);
      // For unique-constrained tables, delete conflicting rows first then update
      if (table === 'crm_week_plan_days' || table === 'crm_plan_items') {
        // delete drop rows that would collide; then update rest
        const { error: e1 } = await sb.from(table).delete().in(col, chunk);
        if (e1 && !/does not exist/i.test(e1.message)) {
          // try update instead
          const { error: e2 } = await sb.from(table).update({ [col]: keepId }).in(col, chunk);
          if (e2) console.warn(table, e2.message);
        }
      } else {
        const { error } = await sb.from(table).update({ [col]: keepId }).in(col, chunk);
        if (error) {
          // invoices / soft refs — null then ok
          if (table === 'invoices' || table === 'crm_pharmacy_invoices') {
            await sb.from(table).update({ [col]: null }).in(col, chunk);
          } else {
            console.warn(table, error.message);
          }
        }
      }
    }
  }

  for (let i = 0; i < dropIds.length; i += 50) {
    const chunk = dropIds.slice(i, i + 50);
    // clean visit children via visits already reassigned — delete leftover visits on drop ids
    const { data: leftoverVisits } = await sb.from('crm_visits').select('id').in('doctor_id', chunk);
    if (leftoverVisits?.length) {
      const vids = leftoverVisits.map((v) => v.id);
      await sb.from('crm_visit_samples').delete().in('visit_id', vids);
      await sb.from('crm_visit_materials').delete().in('visit_id', vids);
      await sb.from('crm_visit_products').delete().in('visit_id', vids);
      await sb.from('crm_visits').delete().in('id', vids);
    }
    const { error } = await sb.from('crm_doctors').delete().in('id', chunk);
    if (error) throw error;
  }
}

async function main() {
  const keys = JSON.parse(
    execSync('npx supabase projects api-keys --project-ref ikryeyqrithikabwidov -o json', {
      encoding: 'utf8',
    })
  );
  const key = keys.find((k) => k.id === 'service_role' || k.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role not found');
  const sb = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const all = await loadAll(sb);
  console.log('Loaded:', all.length);

  const mergeGroups = buildGroups(all);
  console.log('Duplicate groups to merge:', mergeGroups.length);
  console.log(
    'Rows that will be removed:',
    mergeGroups.reduce((s, g) => s + g.length - 1, 0)
  );

  let merged = 0;
  let removed = 0;

  for (const group of mergeGroups) {
    // unique by id
    const uniq = [...new Map(group.map((d) => [d.id, d])).values()];
    if (uniq.length < 2) continue;

    const winner = pickBest(uniq);
    const losers = uniq.filter((d) => d.id !== winner.id);
    const patch = mergeFields(winner, losers);

    const { error: uErr } = await sb.from('crm_doctors').update(patch).eq('id', winner.id);
    if (uErr) {
      console.error('update fail', winner.name, uErr.message);
      continue;
    }

    await reassignAndDelete(
      sb,
      winner.id,
      losers.map((d) => d.id)
    );
    merged += 1;
    removed += losers.length;
    if (merged % 50 === 0) process.stdout.write(`\rMerged groups ${merged}, removed ${removed}`);
  }

  console.log(`\nDone. Groups merged: ${merged}, rows removed: ${removed}`);

  const { count } = await sb.from('crm_doctors').select('*', { count: 'exact', head: true });
  console.log('crm_doctors now:', count);

  // Remaining exact name+brick dups?
  const after = await loadAll(sb);
  const left = buildGroups(after).length;
  console.log('Remaining dup groups:', left);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
