/**
 * Real multi-persona live chat tests (Egyptian customer voice).
 * Order customer name always starts with "تيست" so admin can spot them.
 *
 * Run: node scripts/live-persona-tests.js
 */
const BASE = process.env.CHAT_URL || 'https://www.montana.com.eg/api/chat';
const DELAY_MS = Number(process.env.SMOKE_DELAY_MS || 700);

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
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    reply: String(data.reply || data.message || ''),
    order: data.order || null,
    raw: data,
  };
}

function newSid(tag) {
  return `messenger:persona-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function uniqPhone(i) {
  // Valid EG mobile shape; unique per run
  const tail = String(Date.now()).slice(-7) + String(i);
  return `015${tail.slice(0, 8)}`;
}

function logStep(label, msg, reply) {
  console.log(`\n  👩 ${msg}`);
  console.log(`  🤖 ${reply.replace(/\n/g, ' | ').slice(0, 280)}`);
  if (/MON-/i.test(reply)) console.log(`  ✅ ORDER CONFIRM in reply`);
}

async function runPersona(name, tag, steps, { expectOrder = false, selectedBundle = null } = {}) {
  const sid = newSid(tag);
  console.log(`\n${'═'.repeat(60)}\n🧪 ${name}\n   sid=${sid}`);
  let last = null;
  let placed = null;
  for (const step of steps) {
    const msg = typeof step === 'string' ? step : step.msg;
    const extra = typeof step === 'object' ? { ...step } : {};
    delete extra.msg;
    if (selectedBundle && !extra.selectedBundle) {
      // only attach on first turn if provided at persona level
    }
    const r = await turn(sid, msg, {
      ...(selectedBundle && !last ? { selectedBundle } : {}),
      ...extra,
    });
    last = r;
    logStep(name, msg, r.reply);
    if (r.order?.order_number) placed = r.order;
    if (/تم تسجيل أوردرك|رقم الطلب\s*:?\s*\*?MON-/i.test(r.reply)) {
      const m = r.reply.match(/MON-[A-Z0-9]+/i);
      placed = placed || { order_number: m?.[0], fromReply: true };
    }
  }
  const ok = expectOrder ? !!placed : true;
  console.log(ok ? `  → PASS${placed ? ` (${placed.order_number || 'order'})` : ''}` : '  → FAIL (expected order)');
  return { name, ok, placed, lastReply: last?.reply || '' };
}

async function main() {
  const stamp = new Date().toISOString().slice(5, 16).replace(/[:T]/g, '');
  const results = [];

  // 1) Hnaa style — underarm / typos / course
  {
    const phone = uniqPhone(1);
    results.push(await runPersona(
      'هناء — اندر ارم + كورس',
      'hnaa',
      [
        'تفتيح الاندر ارم',
        'اسود جدا جدا',
        'ياعنى الكورس الكريم والغسول ومصاريف الشحن بكام',
        'ايوه عاوزا اوردر',
        'نكمل',
        'هنا',
        `تيست هناء ${stamp}\n${phone}\nفيصل شارع ترعة الزمر عمارة 12 دور 3 جنب صيدلية العزبي كمعلم`,
        'الجيزة',
      ],
      { expectOrder: true }
    ));
  }

  // 2) Sara style — cleanser alone then shipping then upgrade
  {
    const phone = uniqPhone(2);
    results.push(await runPersona(
      'سارة — غسول لوحده بعدين روتين',
      'sara',
      [
        'بكام الغسول لوحده',
        'غسول التفتيح',
        'والشحن لمحافظة بنى سويف بكام',
        'طب الروتين الكامل بكام',
        'تمام عايزه الروتين',
        'ايوه اسجلي',
        'نكمل',
        'هنا',
        `تيست سارة ${stamp} ${phone} المعادي شارع 9 عمارة 5 دور 2 علامة مترو المعادي`,
        'القاهرة',
      ],
      { expectOrder: true }
    ));
  }

  // 3) Alaa style — browse then pick, no nag
  {
    const phone = uniqPhone(3);
    results.push(await runPersona(
      'علاء أسلوب — بكام / اشوف / اختيار',
      'alaa',
      [
        'بكام',
        'ممكن اشوفهم',
        'ورهملي',
        'روتين التفتيح',
        'ايوه عاوزا اوردر',
        'نكمل',
        'هنا',
        `تيست علاء ${stamp}\n${phone}\nمدينة نصر شارع عباس العقاد عمارة 20 الدور الرابع جنب فودافون`,
        'القاهرة',
      ],
      { expectOrder: true }
    ));
  }

  // 4) Franco + cancel mid-way then reorder
  {
    const phone = uniqPhone(4);
    results.push(await runPersona(
      'ندى فرانكو — تلغي بعدين تطلب',
      'nada',
      [
        'el salamo 3aleekom',
        '3ayza tfteh',
        'bkam el routine',
        'aywa 3awza order',
        'nkamel',
        'hena',
        'لو سمحت عايزه الغي الاوردر',
        'روتين التفتيح',
        'ايوه عاوزا اوردر',
        'نكمل',
        'هنا',
        `تيست ندى ${stamp}\n${phone}\nالهرم شارع فيصل الرئيسي عمارة 8 دور 1 أمام محطة مترو فيصل`,
        'الجيزة',
      ],
      { expectOrder: true }
    ));
  }

  // 5) Post-laser ad context
  {
    const phone = uniqPhone(5);
    results.push(await runPersona(
      'مها — إعلان ليزر',
      'maha',
      [
        { msg: 'بكام', selectedBundle: 'post-laser' },
        'ايوه عاوزا نفس العرض',
        'نكمل',
        'هنا',
        `تيست مها ${stamp}\n${phone}\n6 أكتوبر الحي المتميز شارع 12 عمارة ب2 شقة 5 جنب مول العرب`,
        'الجيزة',
      ],
      { expectOrder: true, selectedBundle: 'post-laser' }
    ));
  }

  // 6) Face-body via ordinal after welcome
  {
    const phone = uniqPhone(6);
    results.push(await runPersona(
      'ياسمين — ترحيب ثم العرض التالت',
      'yasmin',
      [
        'مرحبا',
        'العرض التالت',
        'عايزاه',
        'ايوه اوردر',
        'نكمل',
        'هنا',
        `تيست ياسمين ${stamp}\n${phone}\nشبرا مصر شارع الترعة عمارة 15 دور 2 علامة مسجد النور`,
        'القاهرة',
      ],
      { expectOrder: true }
    ));
  }

  // 7) Two products only + free ship tip (no full order) — behavior check
  {
    results.push(await runPersona(
      'إيمان — غسول+كريم بس (من غير أوردر)',
      'eman-pair',
      [
        'طب الغسول والكريم التفتيح عامل كام',
        'طب لو اخدت الاتنين الشحن بكام',
      ],
      { expectOrder: false }
    ));
  }

  // 8) One-shot details blob after face-body
  {
    const phone = uniqPhone(8);
    results.push(await runPersona(
      'دينا — رسالة بيانات واحدة',
      'dina',
      [
        'عناية الوش والجسم',
        'ايوه عاوزا اوردر',
        'نكمل',
        'هنا',
        `الاسم تيست دينا ${stamp}\nالموبايل ${phone}\nالعنوان: بولاق الدكرور شارع السودان عمارة 3 الدور الارضي جنب مخبز السلام`,
        'الجيزة',
      ],
      { expectOrder: true }
    ));
  }

  console.log(`\n${'═'.repeat(60)}\n📊 SUMMARY`);
  let pass = 0;
  for (const r of results) {
    const mark = r.ok ? 'PASS' : 'FAIL';
    if (r.ok) pass += 1;
    const ord = r.placed?.order_number || (r.expectOrder === false ? '—' : 'NO ORDER');
    console.log(`  [${mark}] ${r.name}  ${ord}`);
  }
  console.log(`\n${pass}/${results.length} personas OK`);
  console.log('Orders named تيست* should appear in admin.');
  if (pass < results.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
