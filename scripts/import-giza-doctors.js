/**
 * Import Giza-team doctor lists from Desktop/new Excel files.
 * Run: node scripts/import-giza-doctors.js
 */
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const IMPORT_TAG = 'Giza team Jul2026 import';

const FILES = [
  {
    rep: 'Mayar Ezat',
    path: 'c:/Users/mo-ab/Desktop/new/Dr List - Doki & Mohandesen & Imbaba (Mayar Ezat).xlsx',
    include(row) {
      const t = String(row['User Territory'] || '');
      const b = String(row['Brick Name'] || '').trim();
      if (/Dokki|Mohandessin|Imbaba|Zamalek/i.test(t)) return true;
      if (/^Imbaba\s*[123]?$/i.test(b)) return true;
      return false;
    },
  },
  {
    rep: 'Sarah Lashen',
    path: 'c:/Users/mo-ab/Desktop/new/Dr List - October & Zayed (Sarah Lashen).xlsx',
    include(row) {
      const t = String(row['User Territory'] || '');
      const b = String(row['Brick Name'] || '').trim();
      if (!/October|Zayed|Hadayek|Fardouse/i.test(t)) return false;
      // Territory field is noisy (national list) — keep Giza-area bricks only
      return /^(Giza|Imbaba|Faisal|Haram)\b/i.test(b);
    },
  },
  {
    rep: 'Gamal Abd El Azem',
    path: 'c:/Users/mo-ab/Desktop/new/Dr List -  Haram& Faisal & Giza (Gamal Abd El Azem).xlsx',
    include(row) {
      const b = String(row['Brick Name'] || '').trim();
      return /^(Giza|Imbaba|Faisal|Haram|FAISAL|HARAM|GIZA|October|Zayed)\b/i.test(b);
    },
  },
  {
    rep: 'Amira Nabil',
    path: 'c:/Users/mo-ab/Desktop/new/Dr List - Bani Suief & Fayoum (Amira Nabil).xlsx',
    include(row) {
      const t = String(row['User Territory'] || '');
      const b = String(row['Brick Name'] || '').trim();
      return /Bani Suef|Fayoum/i.test(t) || /^(Fayoum|Bani Suif)\b/i.test(b);
    },
  },
];

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

function mapOrg(orgName) {
  const o = String(orgName || '').trim();
  const u = o.toUpperCase();
  let doctor_type = 'doctor';
  if (u.includes('PHARM')) doctor_type = 'pharmacy';
  else if (u.includes('HOSPITAL') || u === 'UNH' || u.includes('UNIVERSITY')) doctor_type = 'hospital';
  else if (u.includes('POLY')) doctor_type = 'polyclinic';
  else if (u.includes('CLINIC') || u === 'MOH' || u.includes('HEALTH')) doctor_type = 'doctor';
  return { org_type: o || null, doctor_type };
}

function mapSpecialty(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function normalizePhone(raw) {
  if (raw == null || raw === '') return null;
  let p = String(raw).trim();
  if (!p) return null;
  if (/^\d+$/.test(p) && p.length === 10 && p.startsWith('1')) p = '0' + p;
  return p;
}

function normKey(name, address) {
  return `${String(name || '').toLowerCase().replace(/\s+/g, ' ').trim()}|${String(address || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
}

function excelBrickToLabel(raw) {
  let b = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!b) return null;
  const upper = b.toUpperCase();
  if (upper === 'FAISAL') return 'Faisal 1';
  if (upper === 'HARAM') return 'Haram 1';
  if (upper === 'GIZA') return 'Giza 1';
  if (upper === 'OCTOBER') return 'October';
  if (upper === 'ZAYED') return 'Zayed';
  const m = b.match(/^(Giza|Imbaba|Faisal|Haram|Fayoum|Bani\s*Suif)\s*(\d+)$/i);
  if (m) {
    let area = m[1].replace(/\s+/g, ' ');
    if (/bani/i.test(area)) area = 'Bani Suif';
    else area = area.charAt(0).toUpperCase() + area.slice(1).toLowerCase();
    return `${area} ${m[2]}`;
  }
  return b;
}

async function ensureExtraBricks(sb) {
  const needed = [
    { name: 'B149 — October', label: 'October' },
    { name: 'B150 — Zayed', label: 'Zayed' },
  ];
  const { data: existing } = await sb.from('crm_bricks').select('id,name');
  const byName = Object.fromEntries((existing || []).map((b) => [b.name, b]));
  for (const n of needed) {
    if (byName[n.name]) continue;
    const hit = (existing || []).find((b) => b.name.toLowerCase().includes(n.label.toLowerCase()));
    if (hit) {
      byName[n.name] = hit;
      continue;
    }
    const { data, error } = await sb.from('crm_bricks').insert({ name: n.name }).select().single();
    if (error) throw error;
    console.log('Created brick:', data.name);
    byName[n.name] = data;
    existing.push(data);
  }

  // Link October/Zayed to Giza pharmacy governorate if table exists
  try {
    const { data: giza } = await sb
      .from('crm_pharmacy_regions')
      .select('id')
      .eq('region_type', 'governorate')
      .ilike('name', 'giza')
      .maybeSingle();
    if (giza?.id) {
      for (const n of needed) {
        const brick = byName[n.name] || (existing || []).find((b) => b.name === n.name);
        if (!brick) continue;
        await sb.from('crm_pharmacy_region_bricks').upsert(
          { region_id: giza.id, brick_id: brick.id },
          { onConflict: 'region_id,brick_id' }
        );
      }
    }
  } catch (e) {
    console.warn('pharmacy region link skip:', e.message);
  }

  return existing;
}

function resolveBrickId(excelBrick, bricks) {
  const label = excelBrickToLabel(excelBrick);
  if (!label) return null;
  const lower = label.toLowerCase();

  // Exact label after "Bxx — "
  let hit = bricks.find((b) => {
    const short = b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase();
    return short === lower || b.name.toLowerCase() === lower;
  });
  if (hit) return hit.id;

  // Contains
  hit = bricks.find((b) => {
    const short = b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase();
    return short.includes(lower) || lower.includes(short);
  });
  if (hit) return hit.id;

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

  let bricks = await ensureExtraBricks(sb);
  const { data: bricks2, error: bErr } = await sb.from('crm_bricks').select('id,name');
  if (bErr) throw bErr;
  bricks = bricks2;

  const seen = new Set();
  const rows = [];
  const stats = { perFile: {}, skippedNoBrick: [], skippedDup: 0 };

  for (const file of FILES) {
    const wb = XLSX.readFile(file.path);
    const raw = XLSX.utils.sheet_to_json(wb.Sheets.Data || wb.Sheets[wb.SheetNames[0]], { defval: '' });
    let n = 0;
    for (const row of raw) {
      const name = String(row['HCO Name'] || '').trim();
      if (!name) continue;
      if (!file.include(row)) continue;

      const keyDup = normKey(name, row.Address);
      if (seen.has(keyDup)) {
        stats.skippedDup += 1;
        continue;
      }

      const excelBrick = String(row['Brick Name'] || '').trim();
      const brick_id = resolveBrickId(excelBrick, bricks);
      if (!brick_id) {
        stats.skippedNoBrick.push({ rep: file.rep, name, brick: excelBrick });
        continue;
      }

      seen.add(keyDup);
      const { org_type, doctor_type } = mapOrg(row['Organization Type Name']);
      const terr = String(row['User Territory'] || '').trim();
      const no = String(row['No'] || '').trim();
      const notes = [IMPORT_TAG, file.rep, terr, no ? `No:${no}` : '', `Brick:${excelBrick}`]
        .filter(Boolean)
        .join(' · ');

      rows.push({
        name,
        address: String(row.Address || '').trim() || null,
        phone: normalizePhone(row.Phone),
        brick_id,
        org_type,
        doctor_type,
        class: normalizeClass(row.Class),
        specialty: mapSpecialty(row.Speciality || row.Specialty),
        approved: true,
        is_active: true,
        notes,
      });
      n += 1;
    }
    stats.perFile[file.rep] = n;
    console.log(`${file.rep}: ${n} rows`);
  }

  console.log('Total unique:', rows.length);
  console.log('Duplicates skipped:', stats.skippedDup);
  if (stats.skippedNoBrick.length) {
    console.log('No brick match:', stats.skippedNoBrick.length);
    console.log(stats.skippedNoBrick.slice(0, 15));
  }

  // Remove previous import with same tag
  const { data: existing } = await sb.from('crm_doctors').select('id').ilike('notes', `%${IMPORT_TAG}%`);
  if (existing?.length) {
    const ids = existing.map((d) => d.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      await sb.from('crm_plan_items').delete().in('doctor_id', chunk);
      await sb.from('crm_week_plan_days').delete().in('doctor_id', chunk);
      await sb.from('crm_discount_approvals').delete().in('doctor_id', chunk);
      const { error } = await sb.from('crm_doctors').delete().in('id', chunk);
      if (error) throw error;
    }
    console.log('Removed previous same-tag import:', ids.length);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 80) {
    const chunk = rows.slice(i, i + 80);
    const { error } = await sb.from('crm_doctors').insert(chunk);
    if (error) {
      console.error('Insert failed at', i, error.message);
      throw error;
    }
    inserted += chunk.length;
    process.stdout.write(`\rInserted ${inserted}/${rows.length}`);
  }
  console.log('\nDone. Inserted:', inserted);

  const { count } = await sb.from('crm_doctors').select('*', { count: 'exact', head: true });
  console.log('crm_doctors total now:', count);

  const typeCount = {};
  for (const r of rows) typeCount[r.doctor_type] = (typeCount[r.doctor_type] || 0) + 1;
  console.log('By type:', typeCount);
  console.log('Per file:', stats.perFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
