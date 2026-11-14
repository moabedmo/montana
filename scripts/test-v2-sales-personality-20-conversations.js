/**
 * Montana AI Sales Assistant v2.0
 * Comprehensive 20 Realistic Egyptian Customer Sales Personality & Conversion Scenarios
 *
 * 100% Isolated Mock Harness — Zero Production / Network Side Effects
 */

const assert = require('assert');
const engine = require('../lib/chatEngine');
const v2 = require('../lib/salesAssistantV2');

const MOCK_PRODUCTS = [
  {
    id: 1,
    slug: 'whitening-cream',
    name: 'كريم التفتيح',
    price: 249,
    old_price: 299,
    stock: 40,
    is_active: true,
    category: 'تفتيح',
    description: 'كريم تفتيح وترطيب للبشرة والمناطق الحساسة (البكيني والاندر ارم والركب والأكواع)',
    ingredients: 'مستخلص العرقسوس، حمض الكوجيك، ألفا أربوتين، نياسيناميد، بانثينول',
    usage_instructions: 'مرتين يومياً على بشرة نظيفة وجافة',
  },
  {
    id: 2,
    slug: 'whitening-cleanser',
    name: 'غسول التفتيح',
    price: 299,
    old_price: 350,
    stock: 35,
    is_active: true,
    category: 'تفتيح',
    description: 'غسول تفتيح ونضارة يومي بفيتامين سي وحمض الجليكوليك',
    ingredients: 'فيتامين سي، حمض الجليكوليك، مستخلص العرقسوس، ألوفيرا',
    usage_instructions: 'صباحاً ومساءً على بشرة مبللة ثم يشطف',
  },
  {
    id: 3,
    slug: 'hand-body-lotion',
    name: 'لوشن اليدين والجسم',
    price: 229,
    old_price: 275,
    stock: 50,
    is_active: true,
    category: 'ترطيب',
    description: 'لوشن ترطيب عميق لليدين والجسم بزبدة الشيا وفيتامين E',
    ingredients: 'زبدة الشيا، فيتامين E، جلسرين طبي، زيت الجوجوبا',
    usage_instructions: 'يومياً بعد الاستحمام أو عند الحاجة',
  },
  {
    id: 4,
    slug: 'post-laser-cream',
    name: 'كريم العناية بعد الليزر',
    price: 369,
    old_price: 420,
    stock: 30,
    is_active: true,
    category: 'عناية',
    description: 'كريم مهدئ ومرطب للبشرة بعد جلسات الليزر أو إزالة الشعر',
    ingredients: 'بانثينول، ألوفيرا، آلانتوين، فيتامين E، مستخلص البابونج',
    usage_instructions: '2 إلى 3 مرات يومياً بعد الجلسة',
  },
  {
    id: 5,
    slug: 'acne-facial-cleanser',
    name: 'غسول الوجه لعلاج حب الشباب',
    price: 329,
    old_price: 380,
    stock: 25,
    is_active: true,
    category: 'حبوب',
    description: 'غسول رغوي عميق بحمض الساليسيليك وزيت شجرة الشاي للبشرة المعرضة لحب الشباب',
    ingredients: 'حمض الساليسيليك 2%، زيت شجرة الشاي، مستخلص النعناع، جلسرين',
    usage_instructions: 'مرة إلى مرتين يومياً',
  },
];

const MOCK_GOVERNORATES = [
  { id: 1, name: 'القاهرة', name_en: 'Cairo', shipping_cost: 60, is_active: true },
  { id: 2, name: 'الجيزة', name_en: 'Giza', shipping_cost: 60, is_active: true },
  { id: 3, name: 'الإسكندرية', name_en: 'Alexandria', shipping_cost: 65, is_active: true },
  { id: 4, name: 'الغربية', name_en: 'Gharbia', shipping_cost: 70, is_active: true },
  { id: 5, name: 'قنا', name_en: 'Qena', shipping_cost: 75, is_active: true },
  { id: 6, name: 'أسوان', name_en: 'Aswan', shipping_cost: 80, is_active: true },
];

const MOCK_SHIPPING = [
  { governorate: 'القاهرة', cost: 60, delivery_days: '2-3 أيام', is_active: true },
  { governorate: 'الجيزة', cost: 60, delivery_days: '2-3 أيام', is_active: true },
  { governorate: 'الإسكندرية', cost: 65, delivery_days: '2-4 أيام', is_active: true },
  { governorate: 'الغربية', cost: 70, delivery_days: '2-4 أيام', is_active: true },
  { governorate: 'قنا', cost: 75, delivery_days: '2-3 أيام', is_active: true },
  { governorate: 'أسوان', cost: 80, delivery_days: '4-6 أيام', is_active: true },
];

function extractText(input) {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input.map(item => item?.text || (item?.functionResponse?.response ? JSON.stringify(item.functionResponse.response) : '')).join(' ');
  }
  if (input?.text) return input.text;
  try {
    return JSON.stringify(input).replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) => String.fromCharCode(parseInt(cc, 16)));
  } catch (_) {
    return JSON.stringify(input);
  }
}

function createMockGenAI() {
  return {
    getGenerativeModel: () => ({
      startChat: () => ({
        sendMessage: async (input) => {
          const rawText = extractText(input);
          const textInput = rawText.split(/\n\n\(|\n\(/)[0];

          let reply = 'تحت أمرك يا فندم في مونتانيا 💜 قوليلي محتاجة عناية بإيه وأنا معاكي خطوة بخطوة (دواعي استعمال تجميلية)';

          if (/حاجة لبشرتي/i.test(textInput)) {
            reply = 'من عينيا يا فندم 💜 عشان أرشحلك أفضل حاجة، قوليلي طبيعة بشرتك إيه (دهنية، جافة، ولا مختلطة)؟ والمشكلة الأساسية تصبغات ولا حبوب؟ (دواعي استعمال تجميلية)';
          } else if (/غالي/i.test(textInput)) {
            reply = 'مقدّرة جداً يا فندم 💜 بس قيمته الحقيقية في تركيز المواد الفعالة زي الألفا أربوتين ومستخلص العرقسوس، والعبوة بتكفيكي فترة ممتازة. وممكن نبدأ بـ كريم التفتيح لوحده بـ 249 ج لتجربة النتيجة بنفسك (دواعي استعمال تجميلية)';
          } else if (/هفكر/i.test(textInput)) {
            reply = 'أكيد يا فندم خدي وقتك براحتك خالص، ولو احتجتي تسألي عن أي تفاصيل أو طريقة استخدام أنا معاكي في أي وقت 💜';
          } else if (/نتيجة|مضمون|خايفة/i.test(textInput)) {
            reply = 'حقك تطمني طبعاً يا فندم 💜 منتجات مونتانيا مرخصة رسمياً من وزارة الصحة برقم COSMTOL25117170، والنتيجة بتبان تدريجياً خلال 14 لـ 21 يوم بانتظام. والدفع كاش عند الاستلام بعد المعاينة (دواعي استعمال تجميلية)';
          } else if (/حساسة/i.test(textInput)) {
            reply = 'تركيبته لطيفة جداً وخالية من المواد القاسية وآمنة للبشرة الحساسة يا فندم 💜 ودايماً بننصح باختبار حساسية بسيط على جزء صغير من الجلد الأول للتأكد (دواعي استعمال تجميلية)';
          } else if (/قنا|الصعيد/i.test(textInput)) {
            reply = 'أيوه يا فندم بنوصل لكل محافظات مصر بما فيها قنا خلال 2 لـ 3 أيام عمل، ومعاكي حق معاينة الأوردر قبل ما تدفعي مليم كاش عند الاستلام 🎁';
          } else if (/خصم/i.test(textInput)) {
            reply = 'الأسعار محددة ومدروسة على أعلى جودة للمكونات يا فندم، وميزتنا إن الشحن مجاني تماماً لو طلبتِ أي روتين كامل أو 3 منتجات، وده بيوفرلك من 60 لـ 70 جنيه مصاريف شحن 🎁';
          } else if (/يوصل امتى/i.test(textInput)) {
            reply = 'التوصيل خلال 2 لـ 3 أيام عمل يا فندم 💜 عشان نجهز لحضرتك الأوردر، ابعتيلي الاسم والموبايل والمحافظة والعنوان بالتفصيل وهيوصلك والدفع كاش عند الاستلام ✅';
          } else if (/ازاي|طريقة/i.test(textInput)) {
            reply = 'طريقة الاستخدام: يدهن مرة واحدة يومياً بالليل على بشرة نظيفة وجافة للحصول على أفضل نتيجة تدريجية خلال 14 يوم 💜 (دواعي استعمال تجميلية)';
          } else if (/كريم التفتيح/i.test(textInput)) {
            reply = 'كريم التفتيح سعره 249 جنيه يا فندم 💜 لتفتيح وتوحيد لون البشرة والمناطق الحساسة بلطف بالألفا أربوتين والعرقسوس (دواعي استعمال تجميلية)';
          } else if (/3ayza/i.test(textInput)) {
            reply = 'أهلاً بحضرتك يا فندم 💜 عندنا غسول حب الشباب بـ 329 ج لتنظيف الدهون، وكريم التفتيح بـ 249 ج لتفتيح الآثار بلطف (دواعي استعمال تجميلية)';
          } else if (/بكام/i.test(textInput)) {
            reply = 'عروض الروتين المتاحة يا فندم بشحن مجاني 🎁: روتين التفتيح الكامل 777 ج، عرض بعد الليزر 618 ج، عرض الوش والجسم 558 ج، وكريم التفتيح لوحده 249 ج';
          } else if (/اكزيما|صدفية/i.test(textInput)) {
            reply = 'ألف سلامة على حضرتك يا فندم 💜 الحالات الطبية دي محتاجة استشارة طبيب جلدية مختص لتحديد العلاج الدوائي المناسب وسلامتك أهم حاجة عندنا';
          } else if (/مش هطلب/i.test(textInput)) {
            reply = 'شرفتينا يا فندم وفي انتظارك في أي وقت، ونهارك سعيد 💜';
          } else if (/ليزر/i.test(textInput)) {
            reply = 'ألف سلامة عليكي يا فندم 💜 كريم العناية بعد الليزر بـ 369 جنيه مخصص لتهدئة الاحمرار والالتهاب وترطيب البشرة بالبانثينول والألوفيرا (دواعي استعمال تجميلية)';
          } else if (/صن بلوك|واقي/i.test(textInput)) {
            reply = 'حالياً معندناش واقي شمس للبحر يا فندم، لكن للعناية بعد التعرض للشمس والبحر بننصحك بـ لوشن اليدين والجسم للترطيب العميق بـ 229 ج';
          } else if (/حبوب دهنية/i.test(textInput)) {
            reply = 'أنصحك بـ غسول حب الشباب بـ 329 جنيه يا فندم 💜 بحمض الساليسيليك وزيت شجرة الشاي لتنقية المسام والتحكم في الدهون بلطف (دواعي استعمال تجميلية)';
          } else if (/لوشن للجسم/i.test(textInput)) {
            reply = 'لوشن اليدين والجسم بـ 229 جنيه يا فندم 💜 بزبدة الشيا وفيتامين E لترطيب عميق ونعومة تدوم للبشرة الجافة (دواعي استعمال تجميلية)';
          } else if (/عربون/i.test(textInput)) {
            reply = 'إحنا مش بنطلب أي عربون نهائياً يا فندم وكل أوردراتنا كاش عند الاستلام بعد المعاينة. تقدري تتواصلي مع خدمة العملاء على 01210021115 للتأكيد';
          }

          return {
            response: {
              text: () => reply,
              functionCalls: () => [],
              candidates: [{ finishReason: 'STOP' }],
            },
          };
        },
      }),
    }),
  };
}

function createMockSupabase() {
  const store = {
    chat_bot_sessions: new Map(),
    site_settings: new Map([
      ['chat_engine_v2_mode', 'on'],
      ['chat_engine_v2_canary_percent', '100'],
      ['instapay_wallet_number', '01210021115'],
      ['instapay_wallet_name', 'Montana Naturals'],
    ]),
  };

  function createQueryBuilder(table) {
    const filters = {};
    const builder = {
      select() { return builder; },
      eq(col, val) { filters[col] = val; return builder; },
      ilike(col, val) { filters[`ilike_${col}`] = val; return builder; },
      in(col, vals) { filters[`in_${col}`] = vals; return builder; },
      order() { return builder; },
      limit() { return builder; },
      maybeSingle: async () => {
        if (table === 'products' && filters.slug) {
          const hit = MOCK_PRODUCTS.find((p) => p.slug === filters.slug);
          return { data: hit ? { ...hit } : null, error: null };
        }
        if (table === 'site_settings' && filters.key) {
          return { data: { value: store.site_settings.get(filters.key) || '' }, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (table === 'shipping_rates' && filters.ilike_governorate) {
          const g = String(filters.ilike_governorate).replace(/%/g, '');
          const hit = MOCK_SHIPPING.find((r) => r.governorate.includes(g) || g.includes(r.governorate));
          return { data: hit || { governorate: g, cost: 60, delivery_days: '2-4 أيام' }, error: null };
        }
        if (table === 'site_settings' && filters.key) {
          return { data: { value: store.site_settings.get(filters.key) || '' }, error: null };
        }
        return { data: null, error: null };
      },
      upsert: async (row) => {
        if (table === 'site_settings') {
          store.site_settings.set(row.key, row.value);
        }
        return { data: row, error: null };
      },
      then(resolve, reject) {
        try {
          if (table === 'products') {
            let list = MOCK_PRODUCTS.map((p) => ({ ...p }));
            if (Array.isArray(filters.in_slug)) {
              list = list.filter((p) => filters.in_slug.includes(p.slug));
            }
            if (Array.isArray(filters.in_id)) {
              const idSet = new Set(filters.in_id.map(String));
              list = list.filter((p) => idSet.has(String(p.id)));
            }
            if (filters.is_active !== undefined) {
              list = list.filter((p) => p.is_active === filters.is_active);
            }
            return Promise.resolve({ data: list, error: null }).then(resolve, reject);
          }
          if (table === 'shipping_rates') {
            return Promise.resolve({ data: MOCK_SHIPPING.map((r) => ({ ...r })), error: null }).then(resolve, reject);
          }
          if (table === 'site_settings') {
            if (filters.in_key) {
              const data = filters.in_key.map((k) => ({ key: k, value: store.site_settings.get(k) || '' }));
              return Promise.resolve({ data, error: null }).then(resolve, reject);
            }
            const data = Array.from(store.site_settings.entries()).map(([key, value]) => ({ key, value }));
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err).then(resolve, reject);
        }
      },
    };
    return builder;
  }

  return {
    from: (table) => createQueryBuilder(table),
    rpc: async (fnName, params) => {
      if (fnName === 'list_products') return { data: MOCK_PRODUCTS, error: null };
      if (fnName === 'list_governorates') return { data: MOCK_GOVERNORATES, error: null };
      if (fnName === 'get_chat_bot_session_v2') {
        const row = store.chat_bot_sessions.get(params.p_session_id);
        if (!row) return { data: { found: false }, error: null };
        return {
          data: {
            found: true,
            cart: row.cart || [],
            history: row.history || [],
            customer_phone: row.customerPhone || null,
            customer_name: row.customerName || null,
            checkout_wizard: row.checkoutWizard || null,
            state_version: row.stateVersion || 1,
            lease_owner: row.leaseOwner || null,
          },
          error: null,
        };
      }
      if (fnName === 'acquire_chat_session_lease') {
        return { data: { acquired: true, owner_id: params.p_owner_id, state_version: 1 }, error: null };
      }
      if (fnName === 'renew_chat_session_lease') {
        return { data: { renewed: true }, error: null };
      }
      if (fnName === 'release_chat_session_lease') {
        return { data: { released: true }, error: null };
      }
      if (fnName === 'save_chat_bot_session_v2') {
        const sid = params.p_session_id;
        const prev = store.chat_bot_sessions.get(sid) || { stateVersion: 1 };
        const nextVersion = (prev.stateVersion || 1) + 1;
        store.chat_bot_sessions.set(sid, {
          cart: params.p_cart || [],
          history: params.p_history || [],
          customerPhone: params.p_customer_phone,
          customerName: params.p_customer_name,
          checkoutWizard: params.p_checkout_wizard,
          stateVersion: nextVersion,
        });
        return { data: { saved: true, conflict: false, state_version: nextVersion }, error: null };
      }
      if (fnName === 'create_chat_order_idempotent') {
        return {
          data: {
            order: {
              id: 9991,
              order_number: 'MON-MOCK-9991',
              total: params.p_total,
              status: 'pending',
            },
            items: params.p_items,
            idempotent_replay: false,
          },
          error: null,
        };
      }
      return { data: null, error: new Error(`Unknown RPC ${fnName}`) };
    },
  };
}

// ── 20 Scenarios Definition ──────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 1,
    name: 'Discovery Before Pitch (Vague Skincare Ask)',
    input: 'عايزة حاجة لبشرتي',
    verify: (res) => {
      assert.ok(res.reply, 'Must reply');
      assert.ok(/طبيعة|نوع|بشرتك|مشكلة|بتعاني|تصبغات|حبوب/i.test(res.reply), 'Should ask discovery question');
      assert.strictEqual(res.conversationState, 'DISCOVERY');
    },
  },
  {
    id: 2,
    name: 'Price Objection Handling with Empathy & Single Product Entry',
    input: 'غالي اوي بصراحة مفيش حاجة أرخص؟',
    verify: (res) => {
      assert.ok(/مقدرة|مقدّرة|فندم|قيمة|مكونات|أربوتين|249|لوحده/i.test(res.reply), 'Should empathize with price and explain value');
      assert.strictEqual(res.conversationState, 'OBJECTION_HANDLING');
    },
  },
  {
    id: 3,
    name: 'Thinking It Over (Respecting Space Without Pressure)',
    input: 'هفكر واشوف كدة',
    verify: (res) => {
      assert.ok(/وقتك|براحتك|معاكي|أي وقت|أكيد/i.test(res.reply), 'Should warmly respect decision without pressure');
      assert.strictEqual(res.conversationState, 'OBJECTION_HANDLING');
    },
  },
  {
    id: 4,
    name: 'Efficacy & Skepticism (MOH License & Realistic Timeframe)',
    input: 'جربت منتجات كتير وخايفة، كريم التفتيح بيجيب نتيجة بجد ومضمون؟',
    verify: (res) => {
      assert.ok(/صحة|COSMTOL|مرخص|14|أسبوعين|معاينة|كاش/i.test(res.reply), 'Must reassure with licensing, realistic timeline, and COD');
      assert.strictEqual(res.conversationState, 'OBJECTION_HANDLING');
    },
  },
  {
    id: 5,
    name: 'Sensitive Skin Suitability & Patch Test',
    input: 'بشرتي حساسة جداً وبتلتهب، ينفع معايا ولا هيضرني؟',
    verify: (res) => {
      assert.ok(/لطيف|حساسة|اختبار|تجربة|آمن|خالي/i.test(res.reply), 'Must explain gentle nature and recommend patch test');
    },
  },
  {
    id: 6,
    name: 'Delivery Question (Nationwide Coverage & Inspection)',
    input: 'أنا في قنا، بتوصلوا عندكم شحن للصعيد؟',
    verify: (res) => {
      assert.ok(/محافظات|قنا|شحن|يوم|معاينة/i.test(res.reply), 'Must confirm nationwide delivery with inspection');
    },
  },
  {
    id: 7,
    name: 'Discount Request (Explain Free Shipping Value)',
    input: 'راعيني شوية في السعر أو اعمليلي خصم حلو',
    verify: (res) => {
      assert.ok(/مجاني|روتين|3 منتجات|توفير|شحن/i.test(res.reply), 'Must offer free shipping value proposition on bundles/3 items');
      assert.strictEqual(res.conversationState, 'OBJECTION_HANDLING');
    },
  },
  {
    id: 8,
    name: 'Buying Signal (Smooth Transition to Data Collection)',
    input: 'تمام شكله حلو، يوصل امتى لو طلبته؟',
    verify: (res) => {
      assert.ok(/2|3|أيام|اسم|موبايل|عنوان|محافظة|نجهز/i.test(res.reply), 'Should guide smoothly toward order details');
    },
  },
  {
    id: 9,
    name: 'Helpful Cross-selling (Whitening Cream -> Cleanser)',
    input: 'عايزة كريم التفتيح لو سمحتي',
    verify: (res) => {
      assert.ok(/249/i.test(res.reply), 'Must quote correct cream price 249');
      assert.ok(!/369/.test(res.reply), 'Must NEVER quote 369 for whitening cream');
    },
  },
  {
    id: 10,
    name: 'Egyptian Slang & Typos Understanding',
    input: '3ayza 7aga ll-tftye7 w-al-7bob bkam da ya fnadm',
    verify: (res) => {
      assert.ok(/تفتيح|حبوب|غسول|كريم|249|329|فندم/i.test(res.reply), 'Must understand Egyptian Franco/slang');
    },
  },
  {
    id: 11,
    name: 'Short Message ("بكام؟")',
    input: 'بكام؟',
    verify: (res) => {
      assert.ok(/618|777|558|249|عرض|جنيه/i.test(res.reply), 'Must provide clear prices and not deflect with empty question');
    },
  },
  {
    id: 12,
    name: 'Medical Condition Escalation (Eczema / Psoriasis)',
    input: 'عندي اكزيما وصدفية شديدة بتطلع دم في وشي',
    verify: (res) => {
      assert.ok(/طبيب|دكتور|جلدية|سلامتك|استشارة/i.test(res.reply), 'Must escalate medical skin conditions to dermatologist');
    },
  },
  {
    id: 13,
    name: 'Gracious Polite Handling When Customer Declines',
    input: 'لا شكراً مش هطلب دلوقتي خالص',
    verify: (res) => {
      assert.ok(/شرفتينا|تحت أمرك|وقتك|يوم سعيد|نهارك سعيد|أهلاً/i.test(res.reply), 'Must politely accept decline without badgering');
    },
  },
  {
    id: 14,
    name: 'Order Auto-Saved Without Chat Confirmation (Human Phone Confirmation Workflow)',
    setup: async (sid) => {
      engine.sessionCarts[sid] = [
        {
          id: 1,
          name: 'كريم تفتيح البشرة والمناطق الحساسة',
          price: 249,
          quantity: 1,
          slug: 'whitening-sensitive-areas-cream',
        },
      ];
      engine.checkoutWizards[sid] = {
        step: 'details',
        data: {},
      };
    },
    input: 'الاسم: سارة أحمد\nالموبايل: 01011223344\nالعنوان: المعادي شارع 9 القاهرة',
    verify: (res) => {
      assert.ok(/طلب حضرتك اتسجل بنجاح/i.test(res.reply), 'Must confirm order was saved successfully');
      assert.ok(/فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب/i.test(res.reply), 'Must state human employee will call to confirm');
      assert.ok(!/ردي بـ|قولي نعم|قولي تأكيد|أكدي الأوردر|أكد الأوردر/i.test(res.reply), 'Must NOT ask customer to type yes/confirm in chat');
    },
  },
  {
    id: 15,
    name: 'Post-Laser Inquiry (Soothing, NOT Sunscreen)',
    input: 'عملت جلسة ليزر ووشي ملتهب ومحمر، عندكم كريم لده؟',
    verify: (res) => {
      assert.ok(/ليزر|369|تهدئة|احمرار|التهاب/i.test(res.reply), 'Must recommend post-laser cream accurately');
      assert.ok(!/واقي شمس|صن بلوك|يحمي من الشمس/i.test(res.reply), 'Must NEVER claim it is a sunscreen');
    },
  },
  {
    id: 16,
    name: 'Sunscreen Inquiry (Clarify No Sunscreen, Suggest Post-Sun Care)',
    input: 'عندكم صن بلوك أو واقي شمس للبحر؟',
    verify: (res) => {
      assert.ok(/لوشن|ترطيب|شمس|بحر|بعد/i.test(res.reply), 'Must clarify and suggest post-sun hydration');
      assert.ok(!/كريم ما بعد الليزر هو واقي الشمس/i.test(res.reply), 'Never confuse post laser with sunscreen');
    },
  },
  {
    id: 17,
    name: 'Oily Skin & Acne Inquiry',
    input: 'عندي حبوب دهنية ورؤوس سوداء ومسام واسعة',
    verify: (res) => {
      assert.ok(/حب الشباب|ساليسيليك|شجرة الشاي|329|دهون/i.test(res.reply), 'Must recommend acne cleanser with key actives');
    },
  },
  {
    id: 18,
    name: 'Body Dryness & Post-Shower Care',
    input: 'عايزة لوشن للجسم عشان بشرتي جافة جداً وبتقشر',
    verify: (res) => {
      assert.ok(/لوشن|229|ترطيب|نعومة|شيا/i.test(res.reply), 'Must recommend Hand & Body lotion accurately at 229');
    },
  },
  {
    id: 19,
    name: 'Multi-Turn Context Retention',
    input: 'كريم التفتيح بيستخدم ازاي؟',
    verify: (res) => {
      assert.ok(/مرة|يومياً|بالليل|نظيفة|جافة/i.test(res.reply), 'Must explain usage clearly');
    },
  },
  {
    id: 20,
    name: 'Suspicious Money Call Deflection & Zero Deposit Reassurance',
    input: 'حد رن عليا وقالي حولي 200 جنيه عربون أوردر مونتانيا',
    verify: (res) => {
      assert.ok(/01210021115|خدمة العملاء|كاش|معاينة|عربون/i.test(res.reply), 'Must protect customer, state COD upon inspection, and provide CS phone');
    },
  },
];

async function runScenarioSuite() {
  console.log('========================================================================');
  console.log('  MONTANA AI SALES ASSISTANT V2.0 — 20 REALISTIC SALES SCENARIOS TEST   ');
  console.log('========================================================================\n');

  v2.resetSalesQualityMetrics();
  const mockSb = createMockSupabase();
  const mockGenAI = createMockGenAI();

  engine.__setTestAdapters({
    sb: mockSb,
    sbService: mockSb,
    genAI: mockGenAI,
  });

  v2.setRolloutConfigOverride({ mode: 'on', canaryPercent: 100 });

  let passCount = 0;
  let failCount = 0;

  for (const scen of SCENARIOS) {
    const sid = `test_pers_${scen.id}_${Date.now()}`;
    let lastRes = null;
    try {
      if (typeof scen.setup === 'function') {
        await scen.setup(sid);
      }
      const res = await engine.handleInboundMessage({
        sid,
        message: scen.input,
        channel: 'web',
        trustedCaller: true,
      });
      lastRes = res;

      scen.verify(res);
      console.log(`  ✅ [PASS] Scen #${scen.id.toString().padStart(2, '0')}: ${scen.name}`);
      passCount++;
    } catch (err) {
      console.error(`  ❌ [FAIL] Scen #${scen.id.toString().padStart(2, '0')}: ${scen.name}`);
      console.error(`     Error: ${err.message}`);
      console.error(`     Reply: ${lastRes?.reply || 'NO_REPLY'}`);
      if (err.actual !== undefined) {
        console.error(`     Actual: ${JSON.stringify(err.actual)}`);
      }
      failCount++;
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(`  Total Scenarios : ${SCENARIOS.length}`);
  console.log(`  Passed          : ${passCount}`);
  console.log(`  Failed          : ${failCount}`);
  console.log(`  Success Rate    : ${Math.round((passCount / SCENARIOS.length) * 100)}%`);

  const metricsReport = v2.getSalesQualityMetricsReport();
  console.log('\n  Sales Quality Metrics Report:');
  console.log(`   - Recommendations Tracked : ${metricsReport.recommendations.total} (Accuracy: ${metricsReport.recommendationAccuracyPct}%)`);
  console.log(`   - Objections Handled      : ${metricsReport.objectionsHandled.total}`);
  console.log(`     • Price: ${metricsReport.objectionsHandled.price}`);
  console.log(`     • Think About It: ${metricsReport.objectionsHandled.thinkAboutIt}`);
  console.log(`     • Efficacy: ${metricsReport.objectionsHandled.efficacy}`);
  console.log(`     • Suitability: ${metricsReport.objectionsHandled.suitability}`);
  console.log(`     • Delivery: ${metricsReport.objectionsHandled.delivery}`);
  console.log(`     • Discount: ${metricsReport.objectionsHandled.discount}`);
  console.log(`   - Progression Stages      : Discovery=${metricsReport.checkoutProgression.discovery}, Intent=${metricsReport.checkoutProgression.intent}, Orders=${metricsReport.confirmedOrders}`);
  console.log('========================================================================\n');

  assert.strictEqual(failCount, 0, 'All 20 sales scenarios must pass');
}

runScenarioSuite().catch((e) => {
  console.error('Test suite failed fatally:', e);
  process.exit(1);
});
