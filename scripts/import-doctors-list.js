/**
 * Import doctors from Desktop List.xlsx → crm_doctors (live Supabase).
 * Run: node scripts/import-doctors-list.js [path-to-xlsx]
 */
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const INPUT = process.argv[2] || 'c:/Users/mo-ab/Desktop/List.xlsx';
const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const IMPORT_TAG = 'List.xlsx import';
const DEFAULT_BRICK = 'B9 — Cairo East 1';

function normalizeClass(raw) {
  const c = String(raw || '').toUpperCase().trim();
  if (['AB1', 'AB2', 'BB1', 'BB2'].includes(c)) return c;
  if (c === 'A') return 'AB2';
  if (c === 'B') return 'BB2';
  if (c === 'C') return 'BB2';
  return 'AB2';
}

function mapOrg(orgName) {
  const o = String(orgName || '').trim();
  const u = o.toUpperCase();
  let doctor_type = 'doctor';
  if (u.includes('PHARM')) doctor_type = 'pharmacy';
  else if (u.includes('HOSPITAL')) doctor_type = 'hospital';
  else if (u.includes('POLY')) doctor_type = 'polyclinic';
  else if (u.includes('CLINIC')) doctor_type = 'doctor';
  return { org_type: o || null, doctor_type };
}

function mapSpecialty(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function normalizePhone(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let p = String(raw).trim();
  if (!p) return null;
  if (/^\d+$/.test(p) && p.length === 10 && p.startsWith('1')) p = '0' + p;
  return p;
}

function territoryToBrickHint(territory) {
  const t = String(territory || '').toLowerCase().trim();
  if (t.includes('cairo east')) return 'Cairo East 1';
  if (t.includes('cairo west')) return 'Cairo West 1';
  if (t.includes('cairo south')) return 'Cairo South 1';
  if (t.includes('cairo')) return 'Cairo Center';
  return null;
}

async function main() {
  const keys = JSON.parse(
    execSync('npx supabase projects api-keys --project-ref ikryeyqrithikabwidov -o json', {
      encoding: 'utf8',
    })
  );
  const key = keys.find((k) => k.id === 'service_role' || k.name === 'service_role')?.api_key;
  if (!key) throw new Error('service_role key not found');
  const sb = createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: bricks, error: bErr } = await sb.from('crm_bricks').select('id,name');
  if (bErr) throw bErr;
  const byName = Object.fromEntries((bricks || []).map((b) => [b.name, b.id]));

  function resolveBrickId(row) {
    const excelBrick = String(row['Brick Name'] || '').trim();
    if (excelBrick) {
      const hit = (bricks || []).find(
        (b) =>
          b.name === excelBrick ||
          b.name.toLowerCase().includes(excelBrick.toLowerCase()) ||
          excelBrick.toLowerCase().includes(b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase())
      );
      if (hit) return hit.id;
    }
    const hint = territoryToBrickHint(row['User Territory']);
    if (hint) {
      const hit = (bricks || []).find((b) => b.name.toLowerCase().includes(hint.toLowerCase()));
      if (hit) return hit.id;
    }
    return byName[DEFAULT_BRICK] || null;
  }

  const wb = XLSX.readFile(INPUT);
  const sheet = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const rows = [];
  for (const row of raw) {
    const name = String(row['HCO Name'] || '').trim();
    if (!name) continue;
    const { org_type, doctor_type } = mapOrg(row['Organization Type Name']);
    const terr = String(row['User Territory'] || '').trim();
    const no = String(row['No'] || '').trim();
    const notes = [IMPORT_TAG, terr, no ? `No:${no}` : ''].filter(Boolean).join(' · ');
    const brick_id = resolveBrickId(row);
    if (!brick_id) {
      console.warn('Skip (no brick):', name);
      continue;
    }
    rows.push({
      name,
      address: String(row['Address'] || '').trim() || null,
      phone: normalizePhone(row['Phone']),
      brick_id,
      org_type,
      doctor_type,
      class: normalizeClass(row['Class']),
      specialty: mapSpecialty(row['Speciality'] || row['Specialty']),
      approved: true,
      // Admin must flip Active before reps can see them
      is_active: false,
      notes,
    });
  }

  console.log('File:', INPUT);
  console.log('Rows to insert:', rows.length);

  // Replace previous import from this file only
  const { data: existing } = await sb
    .from('crm_doctors')
    .select('id')
    .ilike('notes', `%${IMPORT_TAG}%`);
  if (existing?.length) {
    const ids = existing.map((d) => d.id);
    await sb.from('crm_plan_items').delete().in('doctor_id', ids);
    const { error: delErr } = await sb.from('crm_doctors').delete().in('id', ids);
    if (delErr) throw delErr;
    console.log('Removed previous List.xlsx import:', ids.length);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await sb.from('crm_doctors').insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }

  const { count } = await sb.from('crm_doctors').select('*', { count: 'exact', head: true });
  const { count: pharmInv } = await sb
    .from('crm_pharmacy_invoices')
    .select('*', { count: 'exact', head: true });

  const byType = {};
  for (const r of rows) byType[r.doctor_type] = (byType[r.doctor_type] || 0) + 1;
  console.log('Inserted:', inserted);
  console.log('By type:', byType);
  console.log('crm_doctors total:', count);
  console.log('crm_pharmacy_invoices (unchanged check):', pharmInv);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
