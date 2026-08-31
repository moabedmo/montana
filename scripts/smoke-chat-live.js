/**
 * Comprehensive live chat smoke — many wordings for sales + checkout.
 * Run: node scripts/smoke-chat-live.js
 *
 * Uses messenger: session ids so in-chat checkout wizard runs (not web form).
 */
const BASE = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS || 400);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function turn(sid, message, extra = {}) {
  await sleep(DELAY_MS);
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      message,
      sessionId: sid,
      channel: 'messenger',
      ...extra,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, raw: text.slice(0, 400), reply: '' };
  }
  return {
    ok: res.ok,
    status: res.status,
    reply: data.reply || '',
    sessionId: data.sessionId || sid,
  };
}

function newSid(tag) {
  return `messenger:smoke-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function hasAllThreeOffers(reply) {
  return /549/.test(reply) && /699/.test(reply) && /499/.test(reply);
}
function hasPostLaser(reply) {
  return /549/.test(reply) && /(ما بعد الليزر|كريم ما بعد الليزر)/.test(reply);
}
function hasBrightening(reply) {
  return /699/.test(reply) && /(تفتيح|غسول التفتيح)/.test(reply);
}
function hasFaceBody(reply) {
  return /499/.test(reply) && /(الوش والجسم|حب الشباب)/.test(reply);
}
function fakeOffers(reply) {
  return /999|749|سيرم تفتيح|واقي شمس|للبشرة ولا للشعر|منتجات شعر/.test(reply);
}
function singleSkuTrap(reply) {
  // Cart showed only one retail product as checkout, not the 549 bundle
  return /كريم التفتيح\s*×\s*1/.test(reply) && /249/.test(reply) && !/549/.test(reply);
}
function asksChatOrSite(reply) {
  return /(هنا|الموقع|برنامج النقاط)/.test(reply);
}
function asksName(reply) {
  return /اسمك|الاسم|ثلاثي/.test(reply);
}
function asksPhone(reply) {
  return /موبايل|رقم|01x/.test(reply);
}
function explainsPoints(reply) {
  return /نقط|10 جنيه|كل 10/.test(reply);
}
function deliveryEta(reply) {
  return /2\s*[-–]?\s*3|يومين|أيام عمل/.test(reply);
}

async function scenario(name, steps, check) {
  const sid = newSid(name.replace(/\s+/g, '-').slice(0, 24));
  const log = [];
  let last = null;
  for (const step of steps) {
    const msg = typeof step === 'string' ? step : step.message;
    const extra = typeof step === 'object' ? (step.extra || {}) : {};
    last = await turn(sid, msg, extra);
    log.push({ user: msg, reply: last.reply || '', ok: last.ok, status: last.status });
    if (!last.ok) break;
  }
  let result;
  try {
    result = check(log, last) || { pass: false, detail: 'no result' };
  } catch (e) {
    result = { pass: false, detail: String(e.message || e) };
  }
  return { name, pass: !!result.pass, detail: result.detail || '', log };
}

function lastReply(log) {
  return log[log.length - 1]?.reply || '';
}

async function main() {
  const scenarios = [];

  // ══ Regression: real customer failures (Shahenda & co) — must never regress ══
  scenarios.push(
    scenario('REG: ممكن اعرف الروتين → التلاتة مش تفتيح بس', ['ممكن اعرف الروتين'], (log) => {
      const r = lastReply(log);
      if (!hasAllThreeOffers(r)) return { pass: false, detail: 'عرض روتين واحد بس أو ناقص: ' + r.slice(0, 120) };
      return { pass: true, detail: 'العروض الثلاثة' };
    })
  );
  scenarios.push(
    scenario('REG: روتين → وسعره كام → يسأل أنهي (مش يكرّر)', ['ممكن اعرف الروتين', 'وسعره كام'], (log) => {
      const r = lastReply(log);
      if (fakeOffers(r)) return { pass: false, detail: 'وهمي' };
      // Must NOT re-dump the full "أنهي عرض تحبيه" block as the only answer
      const redump = /أنهي عرض تحبيه/.test(r) && hasAllThreeOffers(r) && /قولي اسم العرض/.test(r);
      if (redump) return { pass: false, detail: 'كرّر قائمة العروض كاملة' };
      if (!/أنهي عرض|تقصدي|549|699|499/.test(r)) return { pass: false, detail: r.slice(0, 140) };
      return { pass: true, detail: 'سأل أنهي عرض' };
    })
  );
  for (const q of [
    'فى تفتيح البكينى',
    'في تفتيح البكيني',
    'عايزة تفتيح البكيني',
    'عندكم حاجة لتفتيح تحت الإبط',
  ]) {
    scenarios.push(
      scenario(`REG: ${q} → روتين تفتيح مش كريم فردي`, [q], (log) => {
        const r = lastReply(log);
        if (/مناسب ليكي:\s*\*?ر?كريم التفتيح/.test(r) && /249/.test(r) && !/699/.test(r)) {
          return { pass: false, detail: 'كريم فردي 249 بدل الروتين' };
        }
        if (!hasBrightening(r) || !/699/.test(r)) return { pass: false, detail: r.slice(0, 160) };
        if (!/غسول التفتيح/.test(r) || !/لوشن/.test(r)) {
          return { pass: false, detail: 'الروتين مش مكتمل: ' + r.slice(0, 120) };
        }
        return { pass: true, detail: 'روتين 699' };
      })
    );
  }

  // ── Offers list (many wordings) ──
  for (const q of [
    'ايه العروض',
    'في عروض؟',
    'فيه عروض',
    'عندكم عروض',
    'عندكم عروض ولا ايه',
    'عروضكم ايه',
    'ايه العروض الموجوده',
    'في حاجة أوفر؟',
  ]) {
    scenarios.push(
      scenario(`عروض: ${q}`, [q], (log) => {
        const r = log[0]?.reply || '';
        if (fakeOffers(r)) return { pass: false, detail: 'اخترع عروض' };
        if (!hasAllThreeOffers(r)) return { pass: false, detail: 'ناقص أسعار العروض' };
        return { pass: true, detail: 'العروض الثلاثة' };
      })
    );
  }

  // ── Price / set ──
  for (const q of ['بكم', 'بكام', 'الاسعار', 'كام الأسعار', 'مجموعه كلها', 'السيت كله', 'عايزة الروتين']) {
    scenarios.push(
      scenario(`سعر/سيت: ${q}`, [q], (log) => {
        const r = log[0]?.reply || '';
        if (fakeOffers(r) || /شعر|هير/.test(r)) return { pass: false, detail: 'شعر/عروض وهمية' };
        if (!hasAllThreeOffers(r) && !/\d{3}/.test(r)) return { pass: false, detail: 'مفيش أسعار' };
        return { pass: true, detail: 'ok' };
      })
    );
  }

  // ── Pick offer by ordinal / slang ──
  const picks = [
    { pick: 'العرض الاول', expect: hasPostLaser, label: 'post-laser' },
    { pick: 'الأول', expect: hasPostLaser, label: 'post-laser' },
    { pick: 'الاولاني', expect: hasPostLaser, label: 'post-laser' },
    { pick: 'التاني', expect: hasBrightening, label: 'brightening' },
    { pick: 'العرض التالت', expect: hasFaceBody, label: 'face-body' },
    { pick: 'بتاع الليزر', expect: hasPostLaser, label: 'post-laser' },
    { pick: 'روتين التفتيح', expect: hasBrightening, label: 'brightening' },
  ];
  for (const p of picks) {
    scenarios.push(
      scenario(`اختيار: ايه العروض → ${p.pick}`, ['ايه العروض', p.pick], (log) => {
        const r = log[1]?.reply || '';
        if (fakeOffers(r)) return { pass: false, detail: 'وهمي' };
        if (!p.expect(r)) return { pass: false, detail: `مش ${p.label}: ${r.slice(0, 100)}` };
        return { pass: true, detail: p.label };
      })
    );
  }

  // ── Full order after pick (the bug that bit you) ──
  const orderPhrases = [
    'اوك اعمل اوردر',
    'يلا سجلي الأوردر',
    'تمام عايزة أطلب',
    'سجّلي العرض',
    'اه خديه',
  ];
  for (const phrase of orderPhrases) {
    scenarios.push(
      scenario(`أوردر باقة: … → ${phrase}`, ['ايه العروض', 'العرض الاول', phrase], (log) => {
        const r = lastReply(log);
        if (singleSkuTrap(r)) return { pass: false, detail: 'منتج فردي بدل الباقة' };
        if (!hasPostLaser(r) && !/549/.test(r)) return { pass: false, detail: r.slice(0, 140) };
        if (!/كريم ما بعد الليزر/.test(r) || !/كريم التفتيح/.test(r)) {
          // still ok if summary names the bundle
          if (!/ما بعد الليزر/.test(r)) return { pass: false, detail: 'الباقة مش مكتملة: ' + r.slice(0, 120) };
        }
        return { pass: true, detail: 'باقة 549' };
      })
    );
  }

  // ── Brightening pick + order ──
  scenarios.push(
    scenario('تفتيح → اعمل اوردر', ['ايه العروض', 'التاني', 'اعمل اوردر'], (log) => {
      const r = lastReply(log);
      if (singleSkuTrap(r)) return { pass: false, detail: 'SKU فردي' };
      return { pass: /699/.test(r) && /تفتيح/.test(r), detail: r.slice(0, 120) };
    })
  );

  // ── Checkout choice + points + how to register ──
  scenarios.push(
    scenario('باقة → نكمل → البرنامج اي', ['ايه العروض', 'العرض الاول', 'اوك اعمل اوردر', 'نكمل', 'ماشي البرنامج اي'], (log) => {
      const points = lastReply(log);
      if (!explainsPoints(points)) return { pass: false, detail: 'مشرحش النقاط: ' + points.slice(0, 120) };
      // should NOT re-dump full cart spam only
      return { pass: true, detail: 'شرح نقاط' };
    })
  );

  scenarios.push(
    scenario('باقة → نكمل → اسجل ازاي', ['ايه العروض', 'العرض الاول', 'اوك اعمل اوردر', 'نكمل', 'اسجل ازاي'], (log) => {
      const r = lastReply(log);
      // should continue registration (name ask or chat collection), not loop cart only
      if (asksName(r) || /هكمّل|هكمل|معاكي هنا|اسمك/.test(r)) return { pass: true, detail: 'كمّل تسجيل' };
      if (asksChatOrSite(r) && !/أنهي عرض/.test(r)) return { pass: true, detail: 'اختيار طريقة' };
      return { pass: false, detail: r.slice(0, 160) };
    })
  );

  scenarios.push(
    scenario('باقة → نكمل → هنا → اسم', ['ايه العروض', 'العرض الاول', 'اوك اعمل اوردر', 'نكمل', 'هنا', 'ندي محمود علي'], (log) => {
      const afterContinue = log[3]?.reply || '';
      const afterHere = log[4]?.reply || '';
      const afterName = lastReply(log);
      if (!asksChatOrSite(afterContinue) && !asksName(afterContinue)) {
        return { pass: false, detail: 'بعد نكمل: ' + afterContinue.slice(0, 140) };
      }
      if (asksChatOrSite(afterHere) && !asksName(afterHere) && !asksPhone(afterHere)) {
        return { pass: false, detail: 'هنا مكررش الاختيار: ' + afterHere.slice(0, 120) };
      }
      if (!asksPhone(afterName) && !/عنوان|المحافظة/.test(afterName)) {
        return { pass: false, detail: 'بعد الاسم: ' + afterName.slice(0, 120) };
      }
      return { pass: true, detail: 'نكمل → هنا → بيانات' };
    })
  );

  scenarios.push(
    scenario('باقة → نكمل → الموقع', ['ايه العروض', 'العرض الاول', 'اوك اعمل اوردر', 'نكمل', 'الموقع'], (log) => {
      const r = lastReply(log);
      return { pass: /montana\.com\.eg|complete-order|لينك|الرابط/.test(r), detail: r.slice(0, 120) };
    })
  );

  scenarios.push(
    scenario('باقة → نكمل → هسلمو امتى', ['ايه العروض', 'العرض الاول', 'اوك اعمل اوردر', 'نكمل', 'هسلتمو امتى'], (log) => {
      const r = lastReply(log);
      return { pass: deliveryEta(r), detail: r.slice(0, 120) };
    })
  );

  // ── Empty cart checkout should offer routines not «اطلبي إيه» only ──
  scenarios.push(
    scenario('سلة فاضية: عايزة أطلب', ['عايزة أطلب دلوقتي'], (log) => {
      const r = lastReply(log);
      if (/قوليلي تحبي تطلبي إيه/.test(r) && !hasAllThreeOffers(r)) {
        return { pass: false, detail: 'طلب فاضي من غير عروض' };
      }
      return { pass: hasAllThreeOffers(r) || /عرض|روتين/.test(r), detail: r.slice(0, 100) };
    })
  );

  // ── Franco / typos ──
  for (const q of ['bkam', '3ayza el 3ard', 'el 3ard el awel']) {
    scenarios.push(
      scenario(`franco: ${q}`, q === 'el 3ard el awel' ? ['ايه العروض', q] : [q], (log) => {
        const r = lastReply(log);
        if (fakeOffers(r)) return { pass: false, detail: 'وهمي' };
        // franco may fall to Gemini — still must not invent hair/fake
        if (/شعر|999|سيرم تفتيح/.test(r)) return { pass: false, detail: r.slice(0, 100) };
        return { pass: true, detail: 'مفيش اختراع خطر' };
      })
    );
  }

  console.log(`Running ${scenarios.length} scenarios against ${BASE} ...\n`);

  const results = [];
  for (const p of scenarios) {
    // sequential — rate limit friendly
    // eslint-disable-next-line no-await-in-loop
    results.push(await p);
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.name} — ${r.detail}`);
    if (!r.pass) {
      for (const step of r.log) {
        console.log(`   U: ${step.user}`);
        console.log(`   B: ${(step.reply || '').replace(/\n/g, ' | ').slice(0, 200)}`);
      }
    }
  }

  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===`);
  if (failed.length) {
    console.log('Failed:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
