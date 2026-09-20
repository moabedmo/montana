// The checkout details step used to repeat itself without limit.
//
// A real customer mid-checkout received the identical address prompt four
// times. Two of those replies answered messages that were not an address at
// all — one was "اي", and one was "ماشي كلميني بصوتك عشان ما بعرفش اقرا قوي",
// a customer telling us she could not read what we kept sending her.
//
// Two rules come out of that: a prompt that produces nothing must not go out
// unchanged for ever, and someone asking to be spoken to belongs with a person.
const assert = require('assert');
const { wantsVoiceOrCall } = require('../lib/chatEngine');

// 1 — the message from the live conversation
assert.strictEqual(
  wantsVoiceOrCall('ماشي كلميني بصوتك عشان ما بعرفش اقرا قوي'),
  true,
  'the message that was answered four times must be caught',
);

// 2 — the ways the same request actually arrives
for (const m of [
  'كلميني',
  'كلمينى بصوتك',
  'ابعتيلي فويس',
  'اتصلي بيا',
  'رنيلي',
  'مش عارفة اقرا',
  'ما بعرفش اقرا',
  'نظري ضعيف',
  'voice please',
  'call me',
]) {
  assert.strictEqual(wantsVoiceOrCall(m), true, `should catch: ${m}`);
}

// 3 — an address must never be mistaken for a request to be called, or the
// customer who complied gets handed to a human instead of an order
for (const m of [
  'المعادي شارع 9 جنب صيدلية العزبي',
  'اسمي سارة محمد احمد',
  '01012345678',
  'الجيزة الهرم شارع الملك فيصل برج النور',
  'اي',
  'تمام',
  'ايوه',
]) {
  assert.strictEqual(wantsVoiceOrCall(m), false, `should not catch: ${m}`);
}

// 4 — empty and oversized input is not a request for anything
assert.strictEqual(wantsVoiceOrCall(''), false);
assert.strictEqual(wantsVoiceOrCall(null), false);
assert.strictEqual(wantsVoiceOrCall(undefined), false);
assert.strictEqual(wantsVoiceOrCall('كلميني ' + 'ا'.repeat(300)), false,
  'a long message is a message, not a one-line request');

console.log('PASS checkout repeat loop — 4 groups');
