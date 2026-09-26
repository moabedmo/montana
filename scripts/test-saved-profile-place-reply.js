// Naming a place at the saved-profile confirmation is an answer, not silence.
//
// A real customer, Amany, was greeted with her details from a previous order
// and asked to reply نعم or تغيير. She replied "محافظة المنيا مركز سمالوط" —
// she was correcting the address, which is exactly what تغيير means — and got
// the identical prompt back. Twice.
//
// The governorate in that sentence is one matchGovernorateName() already
// resolves; the confirmation step simply never tried to read it.
const assert = require('assert');
const { namesAPlace } = require('../lib/chatEngine');

// 1 — the message from the live conversation
assert.strictEqual(namesAPlace('محافظة المنيا مركز سمالوط'), true,
  'the message that was answered twice with the same prompt must be caught');

// 2 — the other shapes an address correction arrives in
for (const m of [
  'المنيا مركز سمالوط',
  'مركز ملوي',
  'مدينة نصر',
  'قرية كفر الشيخ',
  'شارع الجمهورية',
  'حي الزهور',
  'منطقة المعادي',
  'عمارة 12 الدور الثالث',
  'الكورنيش',
  'طريق النصر',
  'محافظة اسوان',
]) {
  assert.strictEqual(namesAPlace(m), true, `should catch: ${m}`);
}

// 3 — نعم and تغيير own their own step and must not be pulled into this path
for (const m of ['نعم', 'ايوه', 'تمام', 'لا', 'تغيير', 'غير', 'بيانات جديدة']) {
  assert.strictEqual(namesAPlace(m), false, `must not catch: ${m}`);
}

// 4 — nor must a name, a phone, or an ordinary question
for (const m of [
  'امانى محمد على',
  '01008460109',
  'الأوردر هيوصل امتى؟',
  'بكام؟',
  'تمام يا فندم',
  '',
]) {
  assert.strictEqual(namesAPlace(m), false, `must not catch: ${m}`);
}

// 5 — a whole paragraph is not this: the volunteered-details parser owns those,
// and hijacking them here would lose the name and phone inside them
assert.strictEqual(
  namesAPlace('اسمي امانى محمد على ورقمي 01008460109 والعنوان محافظة المنيا مركز سمالوط شارع الفيلا'),
  false,
  'a full details paragraph belongs to the volunteered-details path',
);

console.log('PASS saved-profile place reply — live case, shapes, exclusions');
