/**
 * Parse IMS brick Excel files → SQL seed for crm_offices / crm_areas / crm_bricks
 * Run: node scripts/import-ims-bricks.js
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const FILE_SHARES = 'c:/Users/mo-ab/Desktop/تقسيم بريكات الجمهورية حسب ال IMS.xlsx';
const FILE_BRICKS = 'c:/Users/mo-ab/Desktop/IMS Brick.xlsx';
const OUT_SQL = path.join(__dirname, '../supabase/migrations/018_crm_ims_bricks_seed.sql');

const CAIRO_EAST_PATTERNS = [
  /heliopolis/i, /هليوبolis/i, /nasr city/i, /naser city/i, /مدينه نصر/i,
  /east cairo/i, /شرق القاهره/i, /el qouba/i, /el kobb/i, /القبه/i,
  /abbasia/i, /العباس/i
];

function normKey(s) {
  return String(s || '')
    .replace(/[\u0600-\u06FF]/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** Map Brick-sheet area label → share-file area key */
const AREA_TO_SHARE = [
  [/heliopolis\s*i\b/i, 'HELIOPOLIS I'],
  [/heliopolis\s*ii\b/i, 'HELIOPOLIS II'],
  [/heliopolis\s*iii\b/i, 'HELIOPOLIS III'],
  [/nas[ae]r city/i, 'NASR CITY'],
  [/east cairo\s*i\b/i, 'CAIRO EAST I'],
  [/east cairo\s*ii\b/i, 'CAIRO EAST II'],
  [/east cairo\s*iii\b/i, 'CAIRO EAST III'],
  [/el qouba|el kobb|القبه/i, 'EL KOBBAH'],
  [/abbasia|العباس/i, 'ABBASIA'],
  [/west cairo\s*i\b/i, 'CAIRO WEST I'],
  [/west cairo\s*ii\b/i, 'CAIRO WEST II'],
  [/west cairo\s*iii\b/i, 'CAIRO WEST III'],
  [/shobra/i, 'SHOBRA EL KHEMAH'],
  [/kalub.*\bii\b|qalyub.*\bii\b|قليوب.*2/i, 'KALUBIA II'],
  [/kalub|qalyub|قليوب/i, 'KALUBIA I'],
  [/center cairo|وسط القاهره/i, 'CAIRO CENTER'],
  [/south cairo\s*i\b/i, 'CAIRO SOUTH I'],
  [/south cairo\s*ii\b/i, 'CAIRO SOUTH II'],
  [/south cairo\s*iii\b/i, 'CAIRO SOUTH III'],
  [/maadi|معاد/i, 'MAADI'],
  [/helwan|حلوان/i, 'HELWAN'],
  [/giza\s*i\b|الجيزه\s*1/i, 'GUIZA I'],
  [/giza\s*ii\b|الجيزه\s*2/i, 'GUIZA II'],
  [/giza\s*iii\b|الجيزه\s*3/i, 'GUIZA III'],
  [/giza\s*iiii\b|giza\s*iv\b|الجيزه\s*4/i, 'GUIZA IV'],
  [/giza\s*iiiii\b|giza\s*v\b|الجيزه\s*5/i, 'GUIZA V'],
  [/imbaba\s*i\b/i, 'IMBABA I'],
  [/imbaba\s*ii\b/i, 'IMBABA II'],
  [/faisal/i, 'FAISAL'],
  [/haram|الهرم/i, 'EL HARAM'],
  [/fayoum|الفيوم/i, 'FAYOUM'],
  [/bani suif|beni suef|بني سو|بنى سو/i, 'BANI SUIF'],
  [/menya\s*i|menia\s*i|المنيا\s*1/i, 'EL MENYA I'],
  [/menya\s*ii|menia\s*ii|المنيا\s*2/i, 'EL MENYA II'],
  [/assiut\s*i|new valley/i, 'ASSIUT I/NEW VALLEY'],
  [/assiut\s*ii|asuit\s*2|اسيوط\s*2/i, 'ASSIUT II'],
  [/sohag\s*i/i, 'SOHAG I'],
  [/sohag\s*ii/i, 'SOHAG II'],
  [/quena\s*i|qena\s*i|red sea/i, 'QUENA I/RED SEA'],
  [/quena\s*ii|qena\s*ii/i, 'QUENA II'],
  [/^aswan|أسوان/i, 'ASWAN'],
  [/menof.*\bi\b|menofeya\s*1/i, 'MENOFIA I'],
  [/menof.*\bii\b|menofeya\s*2/i, 'MENOFIA II'],
  [/menof.*\biii\b|menofeya\s*3/i, 'MENOFIA III'],
  [/dakah.*\bi\b|dakahlia\s*1/i, 'DAKAHLIA I'],
  [/dakah.*\bii\b|dakahlia\s*2/i, 'DAKAHLIA II'],
  [/dakah.*\biii\b|dakahlia\s*3/i, 'DAKAHLIA III'],
  [/dakah.*\biv\b|dakahlia\s*4|dakahleia\s*iiii/i, 'DAKAHLIA IV'],
  [/domiat|دمياط/i, 'DOMIAT'],
  [/sharkia\s*iii|الشرقيه\s*3/i, 'SHARKIA III'],
  [/sharkia\s*ii|الشرقيه\s*2/i, 'SHARKIA II'],
  [/sharkia\s*i\b|الشرقيه\s*1/i, 'SHARKIA I'],
  [/port said|north.*sinai|بورسعيد/i, 'PORT SAID/N.SINAI'],
  [/ismailia|الاسماعيل/i, 'ISMAELIA'],
  [/suez|south.*sinai|السويس/i, 'SUEZ/S. SINAI'],
  [/gharb.*\bi\b|gharbia\s*1/i, 'GHARBIA I'],
  [/gharb.*\bii\b|gharbia\s*2/i, 'GHARBIA II'],
  [/gharb.*\biii\b|gharbia\s*3/i, 'GHARBIA III'],
  [/east alex\s*iii|شرق الاسكندريه\s*3/i, 'ALEX EAST III'],
  [/east alex\s*ii|شرق الاسكندريه\s*2/i, 'ALEX EAST II'],
  [/east alex\s*i\b|شرق الاسكندريه\s*1/i, 'ALEX EAST I'],
  [/alex center\s*ii|وسط الاسكندريه\s*2/i, 'ALEX CENTER II'],
  [/alex center\s*i\b|وسط الاسكندريه\s*1/i, 'ALEX CENTER I'],
  [/matrouh|alex west\s*ii|غرب الاسكندريه\s*2/i, 'A.WEST II/MATROUH'],
  [/alex west\s*i\b|غرب الاسكندريه\s*1/i, 'ALEX WEST I'],
  [/behera\s*iii|beheira\s*3|البحيره\s*3/i, 'BEHERA III'],
  [/behera\s*ii|beheira\s*2|البحيره\s*2/i, 'BEHERA II'],
  [/behera\s*i\b|beheira\s*1|البحيره\s*1/i, 'BEHERA I'],
  [/kafr.*\bii\b/i, 'KAFR EL SHEIKH II'],
  [/kafr.*\bi\b/i, 'KAFR EL SHEIKH I'],
];

function shareKeyForArea(name) {
  for (const [re, key] of AREA_TO_SHARE) {
    if (re.test(name)) return key;
  }
  return null;
}

function loadShareMaps() {
  const rows = XLSX.utils.sheet_to_json(
    XLSX.readFile(FILE_SHARES).Sheets['Bricks %'],
    { header: 1, defval: '' }
  );
  const offices = {};
  const areas = {};
  for (const r of rows) {
    const name = String(r[0] || '').trim();
    const val = Number(r[1]);
    if (!name || Number.isNaN(val)) continue;
    if (name.endsWith('OFFICE')) offices[name] = val / 100;
    else if (name !== 'NATIONAL' && !name.includes('GEOGRAPHY')) areas[name] = val / 100;
  }
  return { offices, areas };
}

function officeFromRegion(regionLabel, areaName) {
  const r = normKey(regionLabel);
  if (/^1/.test(r) || /CAIRO/.test(r)) {
    return CAIRO_EAST_PATTERNS.some(p => p.test(areaName)) ? 'CAIRO EAST OFFICE' : 'CAIRO WEST OFFICE';
  }
  if (/^2/.test(r) || /GIZA/.test(r)) return 'CAIRO WEST OFFICE';
  if (/^3/.test(r) || /DELTA/.test(r)) return 'DELTA OFFICE';
  if (/^4/.test(r) || /ALEX/.test(r) || /ISK/.test(r)) return 'ALEX/BEHERA OFFICE';
  if (/^5/.test(r) || /CANAL/.test(r) || /SINAI/.test(r)) return 'DELTA OFFICE';
  if (/^6/.test(r) || /UPPER/.test(r)) return 'UPPER EGYPT OFFICE';
  return 'DELTA OFFICE';
}

function parseHierarchy() {
  const wb = XLSX.readFile(FILE_BRICKS);
  const areaRows = XLSX.utils.sheet_to_json(wb.Sheets['Area'], { header: 1, defval: '' });
  const brickRows = XLSX.utils.sheet_to_json(wb.Sheets['Brick'], { header: 1, defval: '' });

  const brickDetails = {};
  for (let i = 1; i < brickRows.length; i++) {
    const r = brickRows[i];
    const code = String(r[4] || '').trim().replace(/\s+/g, ' ');
    if (!code) continue;
    const key = code.toUpperCase().replace(/\s+/g, '');
    brickDetails[key] = {
      code: code.trim(),
      displayName: String(r[5] || code).trim(),
      description: String(r[7] || '').trim(),
      marketShare: r[6] !== '' && r[6] != null ? Number(r[6]) : null
    };
  }

  let region = '';
  let currentArea = null;
  const areas = [];

  for (const r of areaRows) {
    const c0 = r[0];
    const c1 = String(r[1] || '').trim();
    if (/^\d+\s*-/.test(c1)) { region = c1; continue; }
    if (/^Area I/i.test(c1)) continue;

    if (/^B\s*\d+/i.test(c1)) {
      if (!currentArea) continue;
      const key = c1.toUpperCase().replace(/\s+/g, '');
      const det = brickDetails[key] || {};
      currentArea.bricks.push({
        code: det.code || c1.replace(/\s+/g, ''),
        name: det.displayName || c1,
        description: det.description || '',
        marketShare: det.marketShare
      });
      continue;
    }

    if (typeof c0 === 'number' || (c0 !== '' && !isNaN(Number(c0)))) {
      const areaName = c1 || String(r[2] || '').trim();
      if (!areaName) continue;
      currentArea = {
        imsNo: Number(c0),
        name: areaName,
        region,
        office: officeFromRegion(region, areaName),
        bricks: []
      };
      areas.push(currentArea);
    }
  }
  let globalSeq = 0;
  for (const a of areas) {
    a.globalImsNo = ++globalSeq;
  }
  return areas;
}

function sqlEscape(s) {
  return String(s || '').replace(/'/g, "''");
}

function main() {
  const { areas: areaShares } = loadShareMaps();
  const areas = parseHierarchy();

  const unmatched = [];
  for (const a of areas) {
    const key = shareKeyForArea(a.name);
    a.shareKey = key;
    a.marketShare = key ? areaShares[key] : null;
    if (a.marketShare == null) unmatched.push({ name: a.name, key });
  }

  const totalBricks = areas.reduce((s, a) => s + a.bricks.length, 0);
  const officeNames = [...new Set(areas.map(a => a.office))].sort();

  console.log('Offices:', officeNames.length);
  console.log('Areas:', areas.length, 'Bricks:', totalBricks);
  console.log('Unmatched shares:', unmatched.length);
  if (unmatched.length) unmatched.forEach(u => console.log('  -', u.name, '→', u.key));

  const lines = [];
  lines.push('-- IMS geography seed: تقسيم بريكات الجمهورية + IMS Brick.xlsx');
  lines.push('-- Idempotent: re-seeds offices / areas / bricks (detaches doctors first)');
  lines.push('');
  lines.push('update crm_doctors set brick_id = null where brick_id is not null;');
  lines.push('delete from crm_rep_bricks;');
  lines.push('delete from crm_bricks;');
  lines.push('delete from crm_areas;');
  lines.push('delete from crm_offices;');
  lines.push('');

  for (const name of officeNames) {
    lines.push(`insert into crm_offices (name) values ('${sqlEscape(name)}');`);
  }
  lines.push('');

  for (const a of areas) {
    const ms = a.marketShare != null ? a.marketShare.toFixed(8) : 'null';
    lines.push(
      `insert into crm_areas (office_id, name, ims_area_no, market_share) select o.id, '${sqlEscape(a.name)}', ${a.globalImsNo}, ${ms} from crm_offices o where o.name = '${sqlEscape(a.office)}';`
    );
  }
  lines.push('');

  for (const a of areas) {
    for (const b of a.bricks) {
      const label = `${b.code} — ${b.name}`;
      const ms = b.marketShare != null && !Number.isNaN(b.marketShare)
        ? Number(b.marketShare).toFixed(8) : 'null';
      lines.push(
        `insert into crm_bricks (area_id, name, description, market_share) select a.id, '${sqlEscape(label)}', '${sqlEscape(b.description)}', ${ms} from crm_areas a where a.ims_area_no = ${a.globalImsNo};`
      );
    }
  }

  lines.push('');
  lines.push(`-- ${officeNames.length} offices · ${areas.length} areas · ${totalBricks} bricks`);

  fs.writeFileSync(OUT_SQL, lines.join('\n'), 'utf8');
  console.log('Wrote', OUT_SQL);
}

main();
