const { handleInboundMessage } = require('../lib/chatEngine');

async function testAll() {
  console.log('=== 1. Test "ينفع في ركاب" ===');
  const r1 = await handleInboundMessage({
    sid: 'test_knee_' + Date.now(),
    message: 'ينفع في ركاب',
    channel: 'messenger',
  });
  console.log('Reply:\n' + r1.reply);
  if (!r1.reply.includes('كريم التفتيح') || r1.reply.includes('منتجاتنا المتاحة')) {
    throw new Error('Knee test failed!');
  }
  console.log('✅ Knee test passed!\n');

  console.log('=== 2. Test Audio / Voice Note ===');
  const r2 = await handleInboundMessage({
    sid: 'test_audio_' + Date.now(),
    message: 'https://cdn.fbsbx.com/v/t59.3654-21/audioclip-1794431777000-5758.mp4?sdl=1',
    channel: 'messenger',
  });
  console.log('Reply:\n' + r2.reply);
  if (!r2.reply.includes('كتابية فقط') || r2.reply.includes('منتجاتنا المتاحة')) {
    throw new Error('Audio test failed!');
  }
  console.log('✅ Audio test passed!\n');

  console.log('=== 3. Test Audio while in Checkout Details ===');
  const sid3 = 'test_audio_checkout_' + Date.now();
  const r3 = await handleInboundMessage({
    sid: sid3,
    message: 'عايزة أطلب روتين التفتيح',
    channel: 'messenger',
  });
  const r3_audio = await handleInboundMessage({
    sid: sid3,
    message: 'https://cdn.fbsbx.com/v/t59.3654-21/audioclip-1794431791000-7175.mp4?sdl=1',
    channel: 'messenger',
  });
  console.log('Reply during checkout:\n' + r3_audio.reply);
  if (!r3_audio.reply.includes('كتابية فقط') || !r3_audio.reply.includes('الاسم')) {
    throw new Error('Audio during checkout test failed!');
  }
  console.log('✅ Audio during checkout passed!\n');

  console.log('=== 4. Test Scar Gel Mention Sanitize ===');
  const r4 = await handleInboundMessage({
    sid: 'test_scar_' + Date.now(),
    message: 'عايزة جل لعلاج اثار الندبات',
    channel: 'messenger',
  });
  console.log('Reply:\n' + r4.reply);
  if (r4.reply.includes('340') || r4.reply.includes('سيليكون') || r4.reply.includes('ندبات')) {
    throw new Error('Scar gel leak test failed!');
  }
  console.log('✅ Scar gel leak test passed!\n');

  console.log('ALL IMPROVEMENT TESTS PASSED! 🎉');
}

testAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
