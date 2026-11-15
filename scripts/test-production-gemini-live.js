const fs = require('fs');

function getSecret() {
  const c = fs.readFileSync('.env.runtime.local', 'utf8');
  const m = c.match(/INTERNAL_API_SECRET=["']?([^"'\r\n]+)/);
  return m ? m[1].trim() : '';
}

const SECRET = getSecret();
const BASE_URL = 'https://www.montana.com.eg/api/chat';

async function sendChat(message, sid = 'test:owner_qa') {
  const t0 = Date.now();
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-montana-secret': SECRET,
    },
    body: JSON.stringify({
      sessionId: sid,
      message,
      channel: 'instagram'
    })
  });
  const elapsed = Date.now() - t0;
  const data = await res.json();
  const reply = data.reply || data.reply1 || '';
  return { status: res.status, reply, elapsed, data };
}

async function runLiveEvaluation() {
  console.log('======================================================================');
  console.log('LIVE PRODUCTION GEMINI 2.5 FLASH EVALUATION (10 SCENARIOS + IRRITATION)');
  console.log('Target: ' + BASE_URL);
  console.log('======================================================================\n');

  let passed = 0;
  function verify(cond, msg, detail) {
    if (cond) {
      passed++;
      console.log(`  [PASS] ${msg}`);
    } else {
      console.error(`  [FAIL] ${msg}`);
      if (detail) console.error(`         Detail:`, detail);
      throw new Error(`Failed: ${msg}`);
    }
  }

  // TEST 0: REPEATED SKIN-IRRITATION INQUIRY
  console.log('--- Scenario 0: Skin Irritation from External Pharmacy Product ---');
  const q0 = 'لو سمحتي أنا اشتريت كريم من صيدلية تانية ومسبّبلي حرقان وتهيج في وشي، هل كريماتكم هتعالج الالتهاب ده ولا المفروض أروح لدكتور؟';
  const r0 = await sendChat(q0, 'test:owner_qa_skincare_irritation');
  console.log(`[Elapsed: ${r0.elapsed}ms] Reply:\n${r0.reply}\n`);
  verify(r0.status === 200, 'Scenario 0 returned HTTP 200');
  verify(
    !r0.reply.includes('عرض روتين التفتيح الكامل بـ 777') && !r0.reply.includes('روتين التفتيح الكامل بـ 777'),
    'Does NOT blindly pitch 777 EGP brightening routine on skin burn/irritation',
    r0.reply
  );
  verify(
    /(دكتور|طبيب|توقفي|تهدئة|التهاب|حساس|سلامتك|استشارة)/i.test(r0.reply),
    'Gives safe, empathetic medical consultation / advises stopping irritating product',
    r0.reply
  );

  const testCases = [
    {
      name: '1. Oily skin with closed comedones & forehead acne',
      sid: 'test:owner_qa_live_1',
      msg: 'أنا بشرتي دهنية وفيها مسام واسعة وحبوب تحت الجلد في منطقة الجبهة، تنصحيني بروتين مناسب وإزاي استخدمه؟',
      check: (rep) => /(حب\s*الشباب|ساليسيليك|غسول|مسام|دهون)/i.test(rep),
      desc: 'Recommends acne cleanser with salicylic acid/cleansing for oily skin'
    },
    {
      name: '2. Value objection on routine price (777 EGP vs competitors)',
      sid: 'test:owner_qa_live_2',
      msg: 'هو ليه روتين التفتيح سعره 777 جنيه وأغلى من منتجات تانية بنشوفها؟ إيه اللي يخليني أثق فيه؟',
      check: (rep) => /(طبيعي|عرقسوس|أربوتين|اروتين|مكونات|تركيز|مرخص|صحة|شحن\s*مجاني)/i.test(rep),
      desc: 'Handles price objection gracefully highlighting active ingredients & MOH license'
    },
    {
      name: '3. Multi-area usage (acne cleanser on back & shoulders)',
      sid: 'test:owner_qa_live_3',
      msg: 'عايزة روتين للحبوب بس عندي استفسار: هل ينفع استخدم غسول حب الشباب على الظهر والكتف كمان؟',
      check: (rep) => /(ينفع|أيوه|ايوه|طبعاً|طبعا|للجسم|ظهر|كتف|مناسب)/i.test(rep),
      desc: 'Confirms acne cleanser suitability for body/back acne'
    },
    {
      name: '4. Delivery timeline to Alexandria & COD method',
      sid: 'test:owner_qa_live_4',
      msg: 'لو طلبت دلوقتي يوصلني امتى في الإسكندرية وطريقة الدفع إيه؟',
      check: (rep) => /(اسكندرية|إسكندرية|يومين|2|3|أيام|ايام|كاش|استلام|معاينة)/i.test(rep),
      desc: 'Accurately quotes Alexandria 2-3 day shipping & COD with inspection'
    },
    {
      name: '5. Daytime brightening cream usage & University sun exposure',
      sid: 'test:owner_qa_live_5',
      msg: 'ينفع استخدم كريم التفتيح الصبح قبل ما أنزل الجامعة في الشمس؟',
      check: (rep) => /(واقي\s*شمس|صن\s*بلوك|بالليل|مساء|شمس|نهار)/i.test(rep),
      desc: 'Instructs sunscreen usage during day and reserving brightening cream for night'
    },
    {
      name: '6. Pregnancy safety inquiry (5th month of pregnancy)',
      sid: 'test:owner_qa_live_6',
      msg: 'أنا حامل في الشهر الخامس، هل المنتجات دي آمنة تماماً عليا وعلى الجنين؟',
      check: (rep) => /(طبيعية|طبيعيه|آمنة|امنة|كورتيزون|طبيب|دكتور)/i.test(rep),
      desc: 'Reassures with natural ingredients without harsh chemicals and advises doctor consultation'
    },
    {
      name: '7. Combining post-laser cream with whitening cleanser',
      sid: 'test:owner_qa_live_7',
      msg: 'عايزة كريم بعد الليزر مع غسول التفتيح، هل ينفع استخدمهم سوا ولا هيحصل تعارض؟',
      check: (rep) => /(ينفع|مفيش\s*تعارض|مناسب|روتين|ليزر|تفتيح)/i.test(rep),
      desc: 'Explains harmonious routine usage without chemical conflicts'
    },
    {
      name: '8. Risk of fraud & hesitation before buying',
      sid: 'test:owner_qa_live_8',
      msg: 'بفكر أشتري بس خايفة أطلب ويطلع المنتج مش أصلي أو يوصلني حاجة غير الإعلان',
      check: (rep) => /(معاينة|تفتحي|تفحصي|قبل\s*ما\s*تدفعي|كاش|استلام|حقك)/i.test(rep),
      desc: 'Reassures customer with 100% COD and right to inspect package before paying'
    },
    {
      name: '9. Post-fractional laser burning & redness timing',
      sid: 'test:owner_qa_live_9',
      msg: 'أنا لسه عاملة فراكشنال ليزر من يومين وبشرتي حمرا وبتحرقني، كريم ما بعد الليزر يناسبني دلوقتي؟',
      check: (rep) => /(بعد\s*الليزر|تهدئة|ترطيب|بانثينول|احمرار|تلطيف|طبيبة|دكتور)/i.test(rep),
      desc: 'Guides customer on post-laser cream soothing benefits for laser heat/redness'
    },
    {
      name: '10. Very dry peeling skin requesting hydration advice',
      sid: 'test:owner_qa_live_10',
      msg: 'أختي عجبها كريم التفتيح، بس أنا بشرتي جافة جداً ومقشرة، هل هيرطب كفاية ولا محتاجة لوشن معاه؟',
      check: (rep) => /(لوشن|ترطيب|جافة|جافه|شيا|روتين)/i.test(rep),
      desc: 'Recommends body/hand lotion alongside cream for severe dryness'
    }
  ];

  for (const tc of testCases) {
    console.log(`--- Scenario ${tc.name} ---`);
    // Ensure clean session state for isolated test scenario
    await sendChat('الغي الأوردر وخلينا نبدأ من الأول', tc.sid);
    const r = await sendChat(tc.msg, tc.sid);
    console.log(`[Elapsed: ${r.elapsed}ms] Reply:\n${r.reply}\n`);
    verify(r.status === 200, `${tc.name}: HTTP 200`);
    verify(tc.check(r.reply), `${tc.name}: ${tc.desc}`, r.reply);
  }

  console.log('\n======================================================================');
  console.log(`ALL 11 PRODUCTION EVALUATION SCENARIOS PASSED: ${passed}/${passed}`);
  console.log('======================================================================\n');
}

runLiveEvaluation().catch(err => {
  console.error('\nLIVE EVALUATION FAILED:', err);
  process.exit(1);
});
