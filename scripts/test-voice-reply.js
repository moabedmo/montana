// Voice replies.
//
// A customer wrote "ماشي كلميني بصوتك عشان ما بعرفش اقرا قوي" and got four more
// written prompts. She can now be answered out loud. Two things have to hold:
// what she hears is the words and not the markdown around them, and the audio
// is wrapped in a container a phone will actually play.
const assert = require('assert');
const { speakable, wavFromPcm } = require('../lib/voiceReply');

// 1 — markdown is written for the eye and must not reach the ear
assert.strictEqual(speakable('ابعتي **العنوان بالتفصيل**'), 'ابعتي العنوان بالتفصيل');
assert.strictEqual(speakable('المنطقة · الشارع · علامة مميزة'), 'المنطقة، الشارع، علامة مميزة');
assert.strictEqual(speakable('سطر\nتاني'), 'سطر. تاني');
assert.strictEqual(speakable('عنوان # و `كود` و _مائل_'), 'عنوان و كود و مائل');
assert.strictEqual(speakable('  مسافات    كتير  '), 'مسافات كتير');

// 2 — a long reply is trimmed; a voice note that runs minutes is not one
assert.ok(speakable('ا'.repeat(2000)).length <= 600);

// 3 — nothing worth saying produces nothing to say
assert.strictEqual(speakable(''), '');
assert.strictEqual(speakable(null), '');
assert.strictEqual(speakable('**'), '');

// 4 — the WAV header, which is the whole reason raw PCM is not shipped as-is
const pcm = Buffer.alloc(480);                 // 10ms of 24kHz 16-bit mono
const wav = wavFromPcm(pcm, 24000, 1, 16);
assert.strictEqual(wav.length, 44 + pcm.length, 'header is 44 bytes');
assert.strictEqual(wav.slice(0, 4).toString(), 'RIFF');
assert.strictEqual(wav.slice(8, 12).toString(), 'WAVE');
assert.strictEqual(wav.slice(12, 16).toString(), 'fmt ');
assert.strictEqual(wav.slice(36, 40).toString(), 'data');
assert.strictEqual(wav.readUInt32LE(4), 36 + pcm.length, 'RIFF size counts everything after it');
assert.strictEqual(wav.readUInt16LE(20), 1, 'format 1 = PCM');
assert.strictEqual(wav.readUInt16LE(22), 1, 'mono');
assert.strictEqual(wav.readUInt32LE(24), 24000, 'sample rate');
assert.strictEqual(wav.readUInt32LE(28), 48000, 'byte rate = rate * channels * bits/8');
assert.strictEqual(wav.readUInt16LE(32), 2, 'block align');
assert.strictEqual(wav.readUInt32LE(40), pcm.length, 'data size');

// 5 — the rate is read from the response, not assumed, so a model that returns
// a different one is still wrapped correctly
const wav16 = wavFromPcm(pcm, 16000, 1, 16);
assert.strictEqual(wav16.readUInt32LE(24), 16000);
assert.strictEqual(wav16.readUInt32LE(28), 32000);

console.log('PASS voice reply — 5 groups');
