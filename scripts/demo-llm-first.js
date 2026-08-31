/**
 * Show LLM-first path is active + simulate Maryam-style context note.
 * Live Gemini turn only if GEMINI_API_KEY is set:
 *   node scripts/demo-llm-first.js
 */
process.env.CHAT_LLM_FIRST = process.env.CHAT_LLM_FIRST || '1';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const {
  isWhiteningEffectAsk,
  resolveWhiteningAskProductKey,
  formatWhiteningEffectReply,
  looksLikeVolunteeredDeliveryDetails,
} = require('../lib/chatEngine');

// Mirror buildLlmTurnContextNote (same contract as chatEngine)
function buildNote(ctx) {
  const items = ctx.cart || [];
  const lines = ['(سياق السيستم — مش من العميل: افهمي المتابعة من هنا)'];
  if (ctx.selectedProductSlug) lines.push(`- المنتج النشط: ${ctx.selectedProductSlug}`);
  if (ctx.selectedBundleKey) lines.push(`- العرض النشط: ${ctx.selectedBundleKey}`);
  lines.push(items.length
    ? `- الأوردر الحالي: ${items.map((i) => `${i.name}×${i.qty}`).join('، ')}`
    : '- الأوردر الحالي: فاضي');
  if (ctx.lastBot) lines.push(`- آخر رد ليكي: ${String(ctx.lastBot).replace(/\s+/g, ' ').slice(0, 220)}`);
  lines.push('- لو قالت بيفتح/والشحن/تفاصيل من غير اسم: جاوبِي على المنتج/العرض النشط أو آخر رد.');
  return lines.join('\n');
}

console.log('CHAT_LLM_FIRST =', process.env.CHAT_LLM_FIRST, '(0 = old maze)');
console.log('Gemini key set:', !!process.env.GEMINI_API_KEY);

const pitch = 'أهلاً بيكِ 🌿 كريم العناية بعد الليزر سعره 369 جنيه. للتهيّج والاحمرار بعد جلسات الليزر.';
const history = [{ role: 'model', text: pitch }];
const key = resolveWhiteningAskProductKey('بيفتح ؟', history, 'post-laser-cream');
console.log('\n--- Maryam case ---');
console.log('ask: بيفتح ؟');
console.log('resolved product:', key);
console.log('deterministic guard reply:\n' + formatWhiteningEffectReply(key));
console.log('\n--- Context injected to Gemini ---');
console.log(buildNote({
  selectedProductSlug: 'post-laser-cream',
  lastBot: pitch,
  cart: [],
}));

console.log('\n--- Yara dump still detected ---');
console.log(looksLikeVolunteeredDeliveryDetails(
  'يارا احمد المرسي\n01064239555\nقريه كفر حسان أمام محطه القطر'
));

console.log('\nPath: pause/form/wizard glue → Gemini+tools (list_products, list_governorates, add_to_cart, add_routine_offer, start_checkout). Scripted FAQ maze SKIPPED.');

if (!process.env.GEMINI_API_KEY) {
  console.log('\n(No GEMINI_API_KEY in this shell — deploy/restart with the key to see live replies.)');
  process.exit(0);
}
