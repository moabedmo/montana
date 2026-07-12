/**
 * Import doctors from IMS Excel list → SQL seed
 * Run: node scripts/import-doctors-excel.js "path/to/file.xlsx"
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DEFAULT_FILE = 'c:/Users/mo-ab/Desktop/Dr List - Bani Suief & Fayoum (Amira Nabil).xlsx';
const INPUT = process.argv[2] || DEFAULT_FILE;
const OUT_SQL = path.join(__dirname, '../supabase/migrations/019_crm_doctors_bani_suief_fayoum.sql');
const OUT_CSV = path.join(__dirname, '../crm/data/doctors-bani-suief-fayoum.csv');

const TERRITORY_FILTER = /M 6_Bani Suef|Bani Suef - Fayoum/i;
const BRICK_FILTER = /^(Fayoum|Bani Suif)\s/i;
const IMPORT_TAG = 'Amira Nabil IMS import';

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
  if (/^AB/.test(c) || /^AC/.test(c)) return 'AB2';
  if (/^BB/.test(c) || /^BC/.test(c)) return 'BB2';
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

function brickMatchSql(brickName) {
  const b = String(brickName || '').trim();
  return `(b.name ilike '%${sqlEscape(b)}%' OR b.name ilike '%${sqlEscape(b.replace(/uif/g, 'uef'))}%')`;
}

function shouldInclude(row) {
  const territory = row['User Territory'] || '';
  const brick = row['Brick Name'] || '';
  return TERRITORY_FILTER.test(territory) || BRICK_FILTER.test(brick);
}

function rowToDoctor(row) {
  const name = String(row['HCO Name'] || '').trim();
  if (!name) return null;
  const { org_type, doctor_type } = mapOrg(row['Organization Type Name']);
  const territory = String(row['User Territory'] || '').trim();
  const notes = [IMPORT_TAG, territory, row['No'] ? `No:${row['No']}` : ''].filter(Boolean).join(' · ');
  return {
    name,
    address: String(row['Address'] || '').trim() || null,
    phone: String(row['Phone'] || '').trim() || null,
    brickName: String(row['Brick Name'] || '').trim(),
    org_type,
    doctor_type,
    class: normalizeClass(row['Class']),
    specialty: mapSpecialty(row['Speciality'] || row['Specialty']),
    notes
  };
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error('File not found:', INPUT);
    process.exit(1);
  }

  const wb = XLSX.readFile(INPUT);
  const raw = XLSX.utils.sheet_to_json(wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const doctors = raw.filter(shouldInclude).map(rowToDoctor).filter(Boolean);

  const byBrick = {};
  doctors.forEach(d => { byBrick[d.brickName] = (byBrick[d.brickName] || 0) + 1; });

  console.log('Input:', INPUT);
  console.log('Doctors to import:', doctors.length);
  console.log('By brick:', byBrick);

  const noBrick = doctors.filter(d => !d.brickName);
  if (noBrick.length) console.warn('Without brick:', noBrick.length);

  const lines = [];
  lines.push('-- Doctors: Bani Suef & Fayoum (Amira Nabil territory)');
  lines.push(`-- Source: ${path.basename(INPUT)}`);
  lines.push(`-- Count: ${doctors.length}`);
  lines.push('-- Requires migration 018 (IMS bricks) first');
  lines.push('');
  lines.push('alter table crm_doctors add column if not exists doctor_type text default \'doctor\';');
  lines.push('');
  lines.push(`delete from crm_plan_items where doctor_id in (select id from crm_doctors where notes like '%${sqlEscape(IMPORT_TAG)}%');`);
  lines.push(`delete from crm_doctors where notes like '%${sqlEscape(IMPORT_TAG)}%';`);
  lines.push('');

  for (const d of doctors) {
    if (!d.brickName) continue;
    const addr = d.address ? `'${sqlEscape(d.address)}'` : 'null';
    const phone = d.phone ? `'${sqlEscape(d.phone)}'` : 'null';
    const org = d.org_type ? `'${sqlEscape(d.org_type)}'` : 'null';
    const spec = d.specialty ? `'${sqlEscape(d.specialty)}'` : 'null';
    lines.push(
      `insert into crm_doctors (name, address, phone, brick_id, org_type, doctor_type, class, specialty, approved, notes)` +
      ` select '${sqlEscape(d.name)}', ${addr}, ${phone}, b.id, ${org}, '${d.doctor_type}', '${d.class}', ${spec}, true, '${sqlEscape(d.notes)}'` +
      ` from crm_bricks b where ${brickMatchSql(d.brickName)};`
    );
  }

  lines.push('');
  lines.push(`-- Imported ${doctors.length} doctors`);

  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
  const csvHeader = 'name,class,specialty,type,brick,address,phone,notes';
  const csvRows = doctors.map(d =>
    [d.name, d.class, d.specialty || '', d.doctor_type, d.brickName, d.address || '', d.phone || '', d.notes]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  fs.writeFileSync(OUT_CSV, '\uFEFF' + csvHeader + '\r\n' + csvRows.join('\r\n'), 'utf8');
  fs.writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');

  console.log('Wrote', OUT_SQL);
  console.log('Wrote', OUT_CSV);
}

main();
