/**
 * Import Macro 7 (Maadi & Helwan) + Active Giza Derma list.
 * Run: node scripts/import-maadi-active.js
 */
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const URL = 'https://ikryeyqrithikabwidov.supabase.co';
const IMPORT_TAG = 'Maadi-Helwan+ActiveGiza Jul2026';

function normalizeClass(raw) {
  const c = String(raw || '').toUpperCase().trim();
  if (['AB1', 'AB2', 'BB1', 'BB2'].includes(c)) return c;
  if (c === 'A' || c === 'AA' || c === 'AB') return 'AB2';
  if (c === 'B' || c === 'BB' || c === 'C') return 'BB2';
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
  if (u.includes('PHARM') || u.includes('CHAINS') || u.includes('DISTRIBUTOR')) doctor_type = 'pharmacy';
  else if (u.includes('HOSPITAL') || u.includes('INSTITUTE')) doctor_type = 'hospital';
  else if (u.includes('POLY') || u.includes('CENTER')) doctor_type = 'polyclinic';
  return { org_type: o || null, doctor_type };
}

function mapSpecialty(s) {
  const v = String(s || '').trim();
  if (!v || /pharm/i.test(v)) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function normalizePhone(raw) {
  if (raw == null || raw === '') return null;
  let p = String(raw).replace(/[^\d+]/g, '');
  if (!p) return null;
  if (/^\d+$/.test(p) && p.length === 10 && p.startsWith('1')) p = '0' + p;
  if (/^\d+$/.test(p) && p.length === 11 && p.startsWith('01')) return p;
  if (/^\d+$/.test(p) && p.length >= 9) return p;
  return String(raw).trim() || null;
}

function buildAddress(parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' — ') || null;
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
  if (upper === 'MAADI') return 'Maadi 1';
  if (upper === 'HELWAN') return 'Helwan 1';
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
    return short === lower || b.name.toLowerCase() === lower;
  });
  if (hit) return hit.id;
  hit = bricks.find((b) => {
    const short = b.name.replace(/^B\d+\s*—\s*/, '').toLowerCase();
    return short.includes(lower) || lower.includes(short);
  });
  return hit?.id || null;
}

function freqToTarget(freq) {
  const n = Number(freq);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(31, Math.round(n));
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

  // Existing doctors for dedup
  const { data: existingDocs } = await sb.from('crm_doctors').select('id,name,address,notes');
  const seen = new Set((existingDocs || []).map((d) => normKey(d.name, d.address)));

  const rows = [];
  const stats = { maadi: 0, active: 0, dup: 0, noBrick: [] };

  // ---- Macro 7: Maadi & Helwan only ----
  {
    const path = 'c:/Users/mo-ab/Desktop/new/Macro 7 list (Maadi & helwan).xlsx';
    const raw = XLSX.utils.sheet_to_json(XLSX.readFile(path).Sheets.Sheet1, { defval: '' });
    for (const row of raw) {
      const terr = String(row['Proposed Rep Territory'] || '');
      const brick = String(row.Brick || '').trim();
      if (!/maadi|helwan/i.test(terr + ' ' + brick)) continue;
      const name = String(row.Name || '').trim();
      if (!name) continue;

      const address = String(row['IMS Description'] || '').trim() || null;
      const keyDup = normKey(name, `${brick}|${address || ''}`);
      if (seen.has(keyDup) || seen.has(normKey(name, address || ''))) {
        stats.dup += 1;
        continue;
      }

      const brick_id = resolveBrickId(brick, bricks);
      if (!brick_id) {
        stats.noBrick.push({ src: 'Macro7', name, brick });
        continue;
      }

      const { org_type, doctor_type } = mapOrg('', row.Specialty);
      const notes = [IMPORT_TAG, 'Macro7 Maadi-Helwan', brick, row.ID ? `ID:${row.ID}` : '']
        .filter(Boolean)
        .join(' · ');

      seen.add(keyDup);
      seen.add(normKey(name, address || ''));
      rows.push({
        name,
        address,
        phone: null,
        brick_id,
        org_type,
        doctor_type,
        class: normalizeClass(row['Class D']),
        specialty: mapSpecialty(row.Specialty),
        target_visits_per_month: freqToTarget(row.Frequency),
        approved: true,
        is_active: true,
        notes,
      });
      stats.maadi += 1;
    }
    console.log('Macro7 Maadi/Helwan:', stats.maadi);
  }

  // ---- Active list All Lines Derma (all GIZA) ----
  {
    const path = 'c:/Users/mo-ab/Desktop/new/Active list All Lines Derma.xlsx';
    const raw = XLSX.utils.sheet_to_json(XLSX.readFile(path).Sheets['ACTIVE HCOs'], { defval: '' });
    for (const row of raw) {
      const name = String(row['HCO Name'] || '').trim();
      if (!name) continue;

      const address = buildAddress([
        row['Building Number'],
        row['Street Name'],
        row['Area/City'],
        row['Nearest landmark'],
      ]);
      const keyDup = normKey(name, address);
      if (seen.has(keyDup)) {
        stats.dup += 1;
        continue;
      }

      const brick = String(row['Brick Name'] || '').trim();
      const brick_id = resolveBrickId(brick, bricks);
      if (!brick_id) {
        stats.noBrick.push({ src: 'Active', name, brick });
        continue;
      }

      const { org_type, doctor_type } = mapOrg(row['Organization Type Name'], row.Speciality);
      const phone = normalizePhone(row['Mobile Number']) || normalizePhone(row['Clinic Phone']);
      const notes = [
        IMPORT_TAG,
        'Active Giza Derma',
        String(row['User Territory'] || '').trim(),
        brick ? `Brick:${brick}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      seen.add(keyDup);
      rows.push({
        name,
        address,
        phone,
        brick_id,
        org_type,
        doctor_type,
        class: normalizeClass(row['1st Class']),
        specialty: mapSpecialty(row.Speciality),
        target_visits_per_month: freqToTarget(row.FREQ),
        approved: true,
        is_active: true,
        notes,
      });
      stats.active += 1;
    }
    console.log('Active Giza:', stats.active);
  }

  console.log('To insert:', rows.length, '| dups skipped:', stats.dup, '| no brick:', stats.noBrick.length);
  if (stats.noBrick.length) console.log(stats.noBrick.slice(0, 10));

  // Remove previous same-tag only
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
  for (let i = 0; i < rows.length; i += 80) {
    const chunk = rows.slice(i, i + 80);
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
  console.log('Stats:', { maadi: stats.maadi, active: stats.active, dup: stats.dup });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
