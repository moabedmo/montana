/**
 * Import ALL doctors from IMS Excel → SQL migrations (chunked)
 * Run: node scripts/import-doctors-full.js [excel-path]
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_FILE = 'c:/Users/mo-ab/Desktop/Dr List - Bani Suief & Fayoum (Amira Nabil).xlsx';
const INPUT = process.argv[2] || DEFAULT_FILE;
const MIG_DIR = path.join(__dirname, '../supabase/migrations');
const CHUNK_SIZE = 400;
const IMPORT_TAG = 'IMS Dr List import';

function sqlEscape(s) {
  return String(s || '').replace(/'/g, "''");
}

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
  else if (u.includes('HOSPITAL')) doctor_type = 'hospital';
  else if (u.includes('POLY')) doctor_type = 'polyclinic';
  return { org_type: o || null, doctor_type };
}

function mapSpecialty(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/dakahleia/g, 'dakahlia')
    .replace(/suief/g, 'suif')
    .replace(/kalubeia/g, 'kalubia')
    .replace(/gharbeia/g, 'gharbia')
    .replace(/behira/g, 'behera')
    .replace(/menofeya/g, 'menofia')
    .replace(/alex east/g, 'eastalex')
    .replace(/east alex/g, 'eastalex');
}

function loadCrmBrickMap() {
  const sql = fs.readFileSync(path.join(MIG_DIR, '018_crm_ims_bricks_seed.sql'), 'utf8');
  const crmBricks = [...sql.matchAll(/,\s*'(B\d+[^']*)'/g)].map(m => m[1]);
  const byNorm = {};
  for (const b of crmBricks) {
    const label = b.replace(/^B\d+\s*—\s*/, '');
    byNorm[norm(label)] = label;
  }
  return { crmBricks, byNorm };
}

function resolveBrickLabel(excelBrick, byNorm, crmBricks) {
  const eb = String(excelBrick || '').trim();
  if (!eb) return null;

  const aliases = {
    'Alex East 1': 'East Alex 1',
    'Alex East 2': 'East Alex 2',
    'Alex East 3': 'East Alex 3',
    'Alex East 4': 'East Alex 4',
    'Alex East 5': 'East Alex 5',
    'Alex West / Marsa Matrouh 1': 'Alex West / Marsa Matrouh 1',
    'Assuit / New Valley 1': 'Assuit / New Valley 1',
    'Assuit 1': 'Assuit 1',
    'Quena / Red Sea 1': 'Quena / Red Sea 1',
    'Port Said / North Sinai 1': 'Port Said / North Sinai 1',
    'Suez / South Sinai 1': 'Suez / South Sinai 1',
    'Shobra El Khemah': 'Shobra El Khemah',
    'El Koubah': 'El Koubah',
    'Cairo Center': 'Cairo Center',
    'Kalubia 1': 'Kalubia 1',
    'Bani Suif 1': 'Bani Suif 1',
  };
  const key = aliases[eb] || eb;
  if (byNorm[norm(key)]) return byNorm[norm(key)];

  const n = norm(key);
  for (const [k, v] of Object.entries(byNorm)) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  for (const b of crmBricks) {
    const label = b.replace(/^B\d+\s*—\s*/, '');
    if (norm(label).includes(n) || n.includes(norm(label).slice(0, 6))) return label;
  }
  return key;
}

function territoryNote(row) {
  const t = String(row['User Territory'] || '').trim();
  const no = String(row['No'] || '').trim();
  if (t && no) return `${t} · ${no}`;
  return t || no || '';
}

function rowToDoctor(row, brickMap) {
  const name = String(row['HCO Name'] || '').trim();
  if (!name) return null;
  const brickExcel = String(row['Brick Name'] || '').trim();
  const brickLabel = brickMap[brickExcel];
  if (!brickLabel) return { error: brickExcel, name };

  const { org_type, doctor_type } = mapOrg(row['Organization Type Name']);
  const terr = territoryNote(row);
  const notes = [IMPORT_TAG, terr].filter(Boolean).join(' · ');

  return {
    name,
    address: String(row['Address'] || '').trim() || null,
    phone: String(row['Phone'] || '').trim() || null,
    brickLabel,
    org_type,
    doctor_type,
    class: normalizeClass(row['Class']),
    specialty: mapSpecialty(row['Speciality'] || row['Specialty']),
    notes
  };
}

function insertLine(d) {
  const addr = d.address ? `'${sqlEscape(d.address)}'` : 'null';
  const phone = d.phone ? `'${sqlEscape(d.phone)}'` : 'null';
  const org = d.org_type ? `'${sqlEscape(d.org_type)}'` : 'null';
  const spec = d.specialty ? `'${sqlEscape(d.specialty)}'` : 'null';
  const pat = sqlEscape(d.brickLabel);
  return (
    `insert into crm_doctors (name, address, phone, brick_id, org_type, doctor_type, class, specialty, approved, notes)` +
    ` select '${sqlEscape(d.name)}', ${addr}, ${phone}, b.id, ${org}, '${d.doctor_type}', '${d.class}', ${spec}, true, '${sqlEscape(d.notes)}'` +
    ` from crm_bricks b where b.name ilike '%${pat}%' limit 1;`
  );
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('File not found:', INPUT);
    process.exit(1);
  }

  const { crmBricks, byNorm } = loadCrmBrickMap();
  const raw = XLSX.utils.sheet_to_json(
    XLSX.readFile(INPUT).Sheets['Data'],
    { defval: '' }
  );

  const excelBricks = [...new Set(raw.map(r => r['Brick Name']).filter(Boolean))];
  const brickMap = {};
  const unmappedBricks = [];
  for (const eb of excelBricks) {
    const label = resolveBrickLabel(eb, byNorm, crmBricks);
    if (label) brickMap[eb] = label;
    else unmappedBricks.push(eb);
  }

  const doctors = [];
  const errors = [];
  for (const row of raw) {
    const d = rowToDoctor(row, brickMap);
    if (!d) continue;
    if (d.error) { errors.push(d); continue; }
    doctors.push(d);
  }

  console.log('Doctors:', doctors.length, 'Unmapped bricks:', unmappedBricks.length, errors.length);
  if (unmappedBricks.length) console.log('Unmapped:', unmappedBricks.join(', '));

  // Remove old chunk files
  for (const f of fs.readdirSync(MIG_DIR)) {
    if (/^020_crm_doctors_ims/.test(f)) fs.unlinkSync(path.join(MIG_DIR, f));
  }

  const header = [
    '-- Full IMS doctor list import',
    `-- Source: ${path.basename(INPUT)}`,
    `-- Doctors: ${doctors.length}`,
    '-- Requires: 018_crm_ims_bricks_seed.sql',
    '-- Run parts 020_* in order (part 01 runs cleanup)',
    '',
    'alter table crm_doctors add column if not exists doctor_type text default \'doctor\';',
    ''
  ];

  const cleanup = [
    "delete from crm_plan_items where doctor_id in (select id from crm_doctors where notes ilike '%IMS%Dr List import%' or notes ilike '%Amira Nabil IMS import%');",
    "delete from crm_doctors where notes ilike '%IMS%Dr List import%' or notes ilike '%Amira Nabil IMS import%';",
    ''
  ];

  const chunks = [];
  for (let i = 0; i < doctors.length; i += CHUNK_SIZE) {
    chunks.push(doctors.slice(i, i + CHUNK_SIZE));
  }

  chunks.forEach((chunk, idx) => {
    const part = String(idx + 1).padStart(2, '0');
    const lines = [...header];
    if (idx === 0) lines.push(...cleanup);
    lines.push(`-- Part ${part}/${String(chunks.length).padStart(2, '0')} · ${chunk.length} rows`);
    lines.push('');
    chunk.forEach(d => lines.push(insertLine(d)));
    lines.push('');
    lines.push(`-- end part ${part}`);
    const file = path.join(MIG_DIR, `020_crm_doctors_ims_${part}.sql`);
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log('Wrote', file, chunk.length, 'rows');
  });

  // Summary manifest
  fs.writeFileSync(
    path.join(MIG_DIR, '020_crm_doctors_ims_README.txt'),
    [
      `Import ${doctors.length} doctors in ${chunks.length} SQL parts.`,
      'Run in Supabase SQL Editor in order:',
      ...chunks.map((_, i) => `  ${i + 1}. 020_crm_doctors_ims_${String(i + 1).padStart(2, '0')}.sql`),
      '',
      'Note: 019 is superseded by 020 (includes Bani Suef/Fayoum).',
      unmappedBricks.length ? `Unmapped bricks (${unmappedBricks.length}): ${unmappedBricks.join(', ')}` : 'All bricks mapped.',
      errors.length ? `Rows skipped (no brick): ${errors.length}` : ''
    ].join('\n'),
    'utf8'
  );
}

main();
