/**
 * Import Active List M 6 all egypt.xlsx → crm_doctors
 * Run: node scripts/import-m6-all-egypt.js
 */
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const IMPORT_TAG = 'Active M6 AllEgypt Jul2026';
const INPUT = 'c:/Users/mo-ab/Desktop/new/Active List M 6 all egypt.xlsx';

function normalizeClass(raw) {
  const c = String(raw || '').toUpperCase().trim();
  if (['AB1', 'AB2', 'BB1', 'BB2'].includes(c)) return c;
  if (c === 'A') return 'AB2';
  if (c === 'B') return 'BB2';
  if (/^AA/.test(c)) return c.includes('1') ? 'AB1' : 'AB2';
  if (/^BA/.test(c)) return c.includes('1') ? 'BB1' : 'BB2';
  if (/^AB|^AC/.test(c)) return 'AB2';
  if (/^BB|^BC/.test(c)) return 'BB2';
  return 'AB2';
}

function mapOrg(orgName, specialty) {
  const o = String(orgName || '').trim();
  const u = (o + ' ' + (specialty || '')).toUpperCase();
  let doctor_type = 'doctor';
  if (u.includes('PHARM') || u.includes('CHAIN') || u.includes('DISTRIBUTOR') || u.includes('CONTRACTOR')) {
    doctor_type = 'pharmacy';
  } else if (u.includes('HOSPITAL') || u.includes('INSTITUTE')) {
    doctor_type = 'hospital';
  } else if (u.includes('POLY') || u.includes('CENTER')) {
    doctor_type = 'polyclinic';
  }
  return { org_type: o || null, doctor_type };
}

function mapSpecialty(s) {
  const v = String(s || '').trim();
  if (!v || v.toLowerCase() === 'null' || /pharm/i.test(v)) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function normKey(name, address) {
  return `${String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${String(address || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

const BRICK_ALIASES = {
  'Alex East 1': 'East Alex 1',
  'Alex East 2': 'East Alex 2',
  'Alex East 3': 'East Alex 3',
  'Alex East 4': 'East Alex 4',
  'Alex East 5': 'East Alex 5',
  FAISAL: 'Faisal 1',
  HARAM: 'Haram 1',
  GIZA: 'Giza 1',
  OCTOBER: 'October',
  ZAYED: 'Zayed',
};

function excelBrickToLabel(raw) {
  let b = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!b) return null;
  if (BRICK_ALIASES[b]) return BRICK_ALIASES[b];
  if (BRICK_ALIASES[b.toUpperCase()]) return BRICK_ALIASES[b.toUpperCase()];
  const m = b.match(/^(Giza|Imbaba|Faisal|Haram|Fayoum|Bani\s*Suif|Maadi|Helwan|October|Zayed)\s*(\d+)$/i);
  if (m) {
    let area = m[1].replace(/\s+/g, ' ');
    if (/bani/i.test(area)) area = 'Bani Suif';
    else area = area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
    return `${area} ${m[2]}`;
  }
  return b;
}

function resolveBrickId(excelBrick, bricks) {
  const label = excelBrickToLabel(excelBrick);
  if (!label) return null;
  const lower = label.toLowerCase();
  let hit = bricks.find((b) => {
    const short = b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase();
    return short === lower;
  });
  if (hit) return hit.id;
  hit = bricks.find((b) => {
    const short = b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase();
    return short.includes(lower) || lower.includes(short);
  });
  return hit?.id || null;
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

  const { data: existingDocs } = await sb.from('crm_doctors').select('name,address');
  const seen = new Set((existingDocs || []).map((d) => normKey(d.name, d.address)));

  const raw = XLSX.utils.sheet_to_json(XLSX.readFile(INPUT).Sheets.Data, { defval: '' });
  const rows = [];
  let dup = 0;
  const noBrick = {};

  for (const row of raw) {
    const name = String(row['HCO Name'] || '').trim();
    if (!name) continue;
    const address = String(row.Address || '').trim() || null;
    const keyDup = normKey(name, address);
    if (seen.has(keyDup)) {
      dup += 1;
      continue;
    }

    const excelBrick = String(row['Brick Name'] || '').trim();
    const brick_id = resolveBrickId(excelBrick, bricks);
    if (!brick_id) {
      noBrick[excelBrick] = (noBrick[excelBrick] || 0) + 1;
      continue;
    }

    const { org_type, doctor_type } = mapOrg(row['Organization Type Name'], row.Speciality);
    // Keep territory code as geography hint only — not as a live rep
    const terr = String(row['User Territory'] || '').trim();
    const notes = [IMPORT_TAG, terr, excelBrick ? `Brick:${excelBrick}` : ''].filter(Boolean).join(' · ');

    seen.add(keyDup);
    rows.push({
      name,
      address,
      phone: null,
      brick_id,
      org_type,
      doctor_type,
      class: normalizeClass(row.Class),
      specialty: mapSpecialty(row.Speciality),
      approved: true,
      is_active: true,
      notes,
    });
  }

  console.log('File rows:', raw.length);
  console.log('To insert:', rows.length, '| dups:', dup, '| no brick rows:', Object.values(noBrick).reduce((a, b) => a + b, 0));
  if (Object.keys(noBrick).length) console.log('Unmatched bricks:', noBrick);

  const { data: prev } = await sb.from('crm_doctors').select('id').ilike('notes', `%${IMPORT_TAG}%`);
  if (prev?.length) {
    const ids = prev.map((d) => d.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      await sb.from('crm_plan_items').delete().in('doctor_id', chunk);
      await sb.from('crm_week_plan_days').delete().in('doctor_id', chunk);
      const { error } = await sb.from('crm_doctors').delete().in('id', chunk);
      if (error) throw error;
    }
    console.log('Removed previous same-tag:', ids.length);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await sb.from('crm_doctors').insert(chunk);
    if (error) {
      console.error('fail at', i, error.message);
      throw error;
    }
    inserted += chunk.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }
  console.log('\nDone:', inserted);

  const { count } = await sb.from('crm_doctors').select('*', { count: 'exact', head: true });
  const byType = {};
  for (const r of rows) byType[r.doctor_type] = (byType[r.doctor_type] || 0) + 1;
  console.log('crm_doctors total:', count);
  console.log('By type:', byType);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
