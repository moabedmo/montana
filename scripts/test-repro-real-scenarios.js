const { handleInboundMessage } = require('../lib/chatEngine');

async function run() {
  console.log('--- 1. Testing Catalog Query ("ممكن تقولولي المنتجات المتاحه") ---');
  const catRes = await handleInboundMessage({
    sid: 'test_cat_' + Date.now(),
    message: 'طب ممكن تقولولي المنتجات المتاحه',
    channel: 'instagram'
  });
  console.log('Bot Reply:\n' + catRes.reply);
  if (!catRes.reply.includes('غسول حب الشباب') || !catRes.reply.includes('كريم التفتيح')) {
    throw new Error('Catalog reply missing products!');
  }
  console.log('✅ Catalog Query Passed!\n');

  console.log('--- 2. Testing Underarm Query ("عايزه افتح الاندرارم") ---');
  const underarmRes = await handleInboundMessage({
    sid: 'test_underarm_' + Date.now(),
    message: 'عايزه افتح الاندرارم',
    channel: 'instagram'
  });
  console.log('Bot Reply:\n' + underarmRes.reply);
  if (!underarmRes.reply.includes('كريم التفتيح') || !underarmRes.reply.includes('199')) {
    throw new Error('Underarm query did not pitch cream at 199!');
  }
  console.log('✅ Underarm Query Passed!\n');

  console.log('--- 3. Testing Price Confirmation with Arabic digits ("هو كدا سعرو ٢٠٠ ؟؟") ---');
  const sidPrice = 'test_price_conf_' + Date.now();
  await handleInboundMessage({
    sid: sidPrice,
    message: 'كريم التفتيح لوحدو بكام',
    channel: 'instagram'
  });
  const confRes = await handleInboundMessage({
    sid: sidPrice,
    message: 'هو كدا سعرو ٢٠٠ ؟؟',
    channel: 'instagram'
  });
  console.log('Bot Reply:\n' + confRes.reply);
  if (!confRes.reply.includes('أيوه بالظبط') || !confRes.reply.includes('199')) {
    throw new Error('Price confirmation failed!');
  }
  console.log('✅ Price Confirmation Passed!\n');

  console.log('--- 4. Testing Haggling Downsell ("ينفع بـ 600") ---');
  const sidHaggle = 'test_haggle_' + Date.now();
  await handleInboundMessage({
    sid: sidHaggle,
    message: 'روتين التفتيح بكام',
    channel: 'instagram'
  });
  const haggleRes = await handleInboundMessage({
    sid: sidHaggle,
    message: 'ينفع بـ 600؟',
    channel: 'instagram'
  });
  console.log('Bot Reply:\n' + haggleRes.reply);
  if (!haggleRes.reply.includes('دويتو التفتيح') && !haggleRes.reply.includes('199')) {
    throw new Error('Haggle downsell missing!');
  }
  console.log('✅ Haggling Downsell Passed!\n');

  console.log('--- 5. Testing Volunteered Details After Product ("مريم حليم...") ---');
  const sidMariam = 'test_mariam_' + Date.now();
  await handleInboundMessage({
    sid: sidMariam,
    message: 'كريم التفتيح لوحدو بكام',
    channel: 'instagram'
  });
  const mariamRes = await handleInboundMessage({
    sid: sidMariam,
    message: 'مريم حليم \n01282728488\nالنزهه 2 شارع ال 27 برج الجزيره 25 الدور التاسع بجوار سوبر ماركت بيم',
    channel: 'instagram'
  });
  console.log('Bot Reply:\n' + mariamRes.reply);
  if (mariamRes.reply.includes('أنهي منتج') || mariamRes.reply.includes('BackToSchool')) {
    throw new Error('Mariam details were not captured properly!');
  }
  console.log('✅ Volunteered Details Passed!\n');

  console.log('🎉 ALL 5 REAL CUSTOMER SCENARIOS PASSED WITH FLYING COLORS!');
}

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
