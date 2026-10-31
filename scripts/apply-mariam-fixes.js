// Apply Mariam Halim conversation fixes to lib/chatEngine.js
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'lib', 'chatEngine.js');
let code = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF for reliable string matching, then we can preserve or write
const isCRLF = code.includes('\r\n');
if (isCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// ----------------------------------------------------
// 1. isWhiteningEffectAsk: reject duration/time queries
// ----------------------------------------------------
const target1 = `function isWhiteningEffectAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 90) return false;
  // Avoid stealing real price asks ("بكام بيفتح؟" rare — still answer effect if بيفتح present)`;

const replace1 = `function isWhiteningEffectAsk(message) {
  const t = softNormalizeAr(expandFrancoAndTypos(String(message || '').trim()));
  if (!t || t.length > 90) return false;
  // Never steal duration / time questions ("بياخد وقت قد ايه عشان يفتح")
  if (/(وقت|مدة|مده|كام\\s*يوم|قد\\s*ايه|اد\\s*ايه|بياخد|ياخد|فترة|فتره|امتى)/i.test(t)) return false;
  // Avoid stealing real price asks ("بكام بيفتح؟" rare — still answer effect if بيفتح present)`;

if (!code.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
code = code.replace(target1, replace1);

// ----------------------------------------------------
// 2. formatRoutineUsageReply: support single product usage when a single product is selected
// ----------------------------------------------------
const target2 = `function formatRoutineUsageReply(sid, chatHistory, message = '') {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const bundle =
    resolveBundleFromCustomerText(message)
    || (cartBundle ? getBundleByKey(cartBundle.bundleKey) : null)
    || resolveSinglePitchedBundle(lastBot)
    || (hasRecentBrighteningContext(chatHistory) ? getBundleByKey('brightening') : null)
    || getBundleByKey('brightening');`;

const replace2 = `function formatRoutineUsageReply(sid, chatHistory, message = '') {
  const cart = sessionCarts[sid] || [];
  const cartBundle = cart.find((i) => i?.isBundle || String(i?.id || '').startsWith('bundle:'));
  const lastBot = lastModelMessage(chatHistory);
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  const activeSlug = selectedProductSlug || (cart.length === 1 && !cart[0].isBundle ? cart[0].slug : null);

  // If a single product is specifically active and no bundle is in cart/intent:
  if (!cartBundle && !resolveBundleFromCustomerText(message) && !/(روتين|عرض|مجموعة|كورس)/.test(t)) {
    if (activeSlug === 'whitening-cream' || /كريم\\s*التفتيح/.test(t) || (/كريم/.test(t) && !/ليزر/.test(t))) {
      return {
        reply:
          'طريقة استخدام **كريم التفتيح** يا فندم 💜:\\n\\n' +
          'على بشرة نظيفة وجافة، طبّقي طبقة خفيفة على الأماكن الداكنة (اندر آرم / بيكيني / جسم أو وش) **مرتين يوميًا** صباحًا ومساءً، ودلّكي بلطف لحد ما يتشرب تمامًا.\\n\\n' +
          'مع الانتظام، النتيجة بتبان ملحوظة عادةً خلال **14 يوم** 🌿\\n\\n' +
          'تحبي نسجل الأوردر دلوقتي؟',
        sessionId: sid,
        selectedProduct: 'whitening-cream',
        keepCta: true,
      };
    }
    if (activeSlug === 'whitening-cleanser' || /غسول\\s*التفتيح/.test(t)) {
      return {
        reply:
          'طريقة استخدام **غسول التفتيح** يا فندم 💜:\\n\\n' +
          'اغسلي البشرة بلطف مرتين يوميًا بالماء الفاتر مع تدليك بحركات دائرية لمدة دقيقة، واشطفي كويس.\\n\\n' +
          'تحبي نسجل الأوردر؟',
        sessionId: sid,
        selectedProduct: 'whitening-cleanser',
        keepCta: true,
      };
    }
    if (activeSlug === 'post-laser-cream' || /ليزر/.test(t)) {
      return {
        reply:
          'طريقة استخدام **كريم ما بعد الليزر** يا فندم 💜:\\n\\n' +
          'طبّقي طبقة رقيقة على المنطقة المعالجة مرتين إلى 3 مرات يوميًا لتهدئة البشرة وتقليل التهيّج.\\n\\n' +
          'تحبي تسجلي الأوردر؟',
        sessionId: sid,
        selectedProduct: 'post-laser-cream',
        keepCta: true,
      };
    }
  }

  const bundle =
    resolveBundleFromCustomerText(message)
    || (cartBundle ? getBundleByKey(cartBundle.bundleKey) : null)
    || resolveSinglePitchedBundle(lastBot)
    || (hasRecentBrighteningContext(chatHistory) ? getBundleByKey('brightening') : null)
    || getBundleByKey('brightening');`;

if (!code.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
code = code.replace(target2, replace2);

// ----------------------------------------------------
// 3. isResultsTimelineQuestion: match all duration/timeline questions
// ----------------------------------------------------
const target3 = `function isResultsTimelineQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  if (/(امتى|إمتى|متى|وقت|كام\\s*يوم|كام\\s*اسبوع|قد\\s*ايه).{0,40}(نتيج|نتائج|يفرق|يبان|يظهر|يطلع)/i.test(t)) {
    return true;
  }
  if (/(نتيج|نتائج|يفرق|يبان|يظهر|يطلع).{0,40}(امتى|إمتى|متى|وقت|كام\\s*يوم|كام\\s*اسبوع|قد\\s*ايه)/i.test(t)) {
    return true;
  }
  if (/^(امتى|إمتى|متى)\\s*(يطلع|تطلع|يبان|تبان|تظهر|يظهر)?\\s*(ال)?(نتيج|نتائج)/i.test(t)) return true;
  if (/نتيج|نتائج/.test(t) && /(امتى|إمتى|متى|سريع|بسرعه|بسرعة)/i.test(t)) return true;
  return false;
}`;

const replace3 = `function isResultsTimelineQuestion(message) {
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 140) return false;
  if (/(امتى|إمتى|متى|وقت|كام\\s*يوم|كام\\s*اسبوع|قد\\s*ايه|اد\\s*ايه).{0,40}(نتيج|نتائج|يفرق|يبان|يظهر|يطلع|يفتح|تفتيح|فرق)/i.test(t)) {
    return true;
  }
  if (/(نتيج|نتائج|يفرق|يبان|يظهر|يطلع|يفتح|تفتيح|فرق).{0,40}(امتى|إمتى|متى|وقت|كام\\s*يوم|كام\\s*اسبوع|قد\\s*ايه|اد\\s*ايه)/i.test(t)) {
    return true;
  }
  if (/(بياخد|ياخد|تاخد|بتاخد)\\s*(وقت|قد\\s*ايه|اد\\s*ايه|كام\\s*يوم|كام\\s*اسبوع|فترة|فتره)/i.test(t)) return true;
  if (/وقت\\s*(قد\\s*ايه|اد\\s*ايه|كام)/i.test(t)) return true;
  if (/^(امتى|إمتى|متى)\\s*(يطلع|تطلع|يبان|تبان|تظهر|يظهر)?\\s*(ال)?(نتيج|نتائج)/i.test(t)) return true;
  if (/نتيج|نتائج/.test(t) && /(امتى|إمتى|متى|سريع|بسرعه|بسرعة)/i.test(t)) return true;
  return false;
}`;

if (!code.includes(target3)) {
  console.error('Target 3 not found!');
  process.exit(1);
}
code = code.replace(target3, replace3);

// ----------------------------------------------------
// 4. productAdFollowUpReply: check active promo discount & price confirmation
// ----------------------------------------------------
const target4 = `  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (isWhiteningEffectAsk(message)) {
    return replyWhiteningEffectAsk(message, sid, [], slug);
  }
  const wantsSize = /حجم|مل\\b|ml|قد\\s*ايه|وزنه|العلبة|احجام|أحجام/i.test(t);
  const wantsPrice = /سعر|بكام|بكم|كام/.test(t) || !wantsSize;
  const price = Math.round(Number(p.price) || 0);
  const size = String(p.size || '').trim();
  const lines = [\`**\${p.name}**\`];
  if (wantsPrice) lines.push(\`السعر **\${price}** جنيه.\`);`;

const replace4 = `  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (isWhiteningEffectAsk(message)) {
    return replyWhiteningEffectAsk(message, sid, [], slug);
  }
  const promo = await getPromo();
  const price = Math.round(Number(p.price) || 0);
  const discounted = (promo?.percent > 0 && promo.percent < 100)
    ? price - Math.round((price * promo.percent) / 100)
    : price;

  // Confirmation of discounted price ("هو كدا سعرو 200؟" / "يعني بـ 200؟")
  if (/(هو\\s*)?(كدا|كده|يعني)\\s*(سعره|سعرو|ب|بـ)?\\s*\\d{2,4}/.test(t)) {
    return {
      reply:
        \`أيوه بالظبط يا فندم 💜 بعد خصم الـ \${promo.percent}% بيبقى **\${discounted}** جنيه على الأوردر.\\n\\n\` +
        \`تحبي نسجل الأوردر دلوقتي؟\`,
      sessionId: sid,
      selectedProduct: p.slug,
      keepCta: true,
    };
  }

  const wantsSize = /حجم|مل\\b|ml|قد\\s*ايه|وزنه|العلبة|احجام|أحجام/i.test(t);
  const wantsPrice = /سعر|بكام|بكم|كام/.test(t) || !wantsSize;
  const size = String(p.size || '').trim();
  const lines = [\`**\${p.name}**\`];
  if (wantsPrice) {
    const offer = p.old_price && p.old_price > p.price
      ? \`سعره حاليًا \${price} جنيه بدلًا من \${Math.round(p.old_price)} جنيه\`
      : \`سعره \${price} جنيه\`;
    const after = (promo?.percent > 0 && promo.percent < 100)
      ? \`\\n• وبعد خصم الـ **\${promo.percent}%** بيبقى **\${discounted}** جنيه على الأوردر\`
      : '';
    lines.push(\`• \${offer}\${after}\`);
  }`;

if (!code.includes(target4)) {
  console.error('Target 4 not found!');
  process.exit(1);
}
code = code.replace(target4, replace4);

// ----------------------------------------------------
// 5. isPriceHaggleAsk: do NOT swallow clarification questions like "اومال اي الخصم اللي فوق دا"
// ----------------------------------------------------
const target5 = `function isPriceHaggleAsk(message) {
  // softNormalizeAr maps أ/إ/آ → ا so patterns must use اقل not أقل
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 100) return false;
  return /(اقل|ارخص|غالي|غاليه|غالى|ما\\s*في\\s*اقل|مفيش\\s*(اقل|ارخص)|في\\s*اقل|خصم|تنزيل)/i.test(t)
    && !/(محافظ|شحن|توصيل)/.test(t);
}`;

const replace5 = `function isPriceHaggleAsk(message) {
  // softNormalizeAr maps أ/إ/آ → ا so patterns must use اقل not أقل
  const t = prepareCustomerText(expandFrancoAndTypos(message));
  if (!t || t.length > 100) return false;
  // Clarification questions about discount are NOT haggling ("اومال ايه الخصم", "ايه الخصم ده", "فين الخصم")
  if (/(اي|ايه|إيه|فين|مش\\s*في|قصدك\\s*ايه|معنى|معناه)\\s*.*خصم/i.test(t)) return false;
  if (/خصم\\s*(ايه|إيه|فين)/i.test(t)) return false;
  return /(اقل|ارخص|غالي|غاليه|غالى|ما\\s*في\\s*اقل|مفيش\\s*(اقل|ارخص)|في\\s*اقل|خصم|تنزيل)/i.test(t)
    && !/(محافظ|شحن|توصيل)/.test(t);
}`;

if (!code.includes(target5)) {
  console.error('Target 5 not found!');
  process.exit(1);
}
code = code.replace(target5, replace5);

// ----------------------------------------------------
// 6. tryPriceQuestion: return selectedProduct when named.length === 1
// ----------------------------------------------------
const target6 = `    if (named.length >= 1 && named.length <= 2) {
      return {
        reply: withUnitPricesAndShipTip(named),
        sessionId: sid,
        keepCta: true,
      };
    }`;

const replace6 = `    if (named.length >= 1 && named.length <= 2) {
      return {
        reply: withUnitPricesAndShipTip(named),
        sessionId: sid,
        selectedProduct: named.length === 1 ? named[0].slug : undefined,
        keepCta: true,
      };
    }`;

if (!code.includes(target6)) {
  console.error('Target 6 not found!');
  process.exit(1);
}
code = code.replace(target6, replace6);

// ----------------------------------------------------
// 7. looksLikePersonName: reject product/conversational keywords
// ----------------------------------------------------
const target7 = `  if (/(صباح|مساء|الخير|السلام|منتج|بكام|عايز|عاوز|ممكن|فين|ازاي|إزاي|إيه|ايه|تحبي|قولي|حاج[هة]|عادي|براحتك)/i.test(name)) {
    return false;
  }`;

const replace7 = `  if (/(صباح|مساء|الخير|السلام|منتج|بكام|عايز|عاوز|ممكن|فين|ازاي|إزاي|إيه|ايه|تحبي|قولي|حاج[هة]|عادي|براحتك)/i.test(name)) {
    return false;
  }
  if (/(استاذن|استأذن|تبعت|ابعت|طريق[ةه]|استخدام|استعمال|روتين|كريم|غسول|لوشن|خصم|شحن|توصيل|تفتيح|سعر|طلب|اوردر|شكرا|تسلم)/i.test(name)) {
    return false;
  }`;

if (!code.includes(target7)) {
  console.error('Target 7 not found!');
  process.exit(1);
}
code = code.replace(target7, replace7);

// ----------------------------------------------------
// 8. harvestSeedFromHistory: parse volunteered delivery details first
// ----------------------------------------------------
const target8 = `function harvestSeedFromHistory(hist) {
  const turns = Array.isArray(hist) ? hist : [];
  const seed = {};
  for (let i = turns.length - 1; i >= 0 && i >= turns.length - 12; i--) {
    const turn = turns[i];
    if (turn?.role !== 'user') continue;
    const text = String(turn.text || turn.parts?.[0]?.text || '').trim();
    if (!text) continue;
    if (!seed.phone) {
      const p = extractPhoneFromText(text) || normalizePhone(text);
      if (p) seed.phone = p;
    }
    if (!seed.name && looksLikePersonName(text)) {
      seed.name = text.replace(/\\s+/g, ' ');
    }
    if (!seed.address && looksLikeAddressOnly(text)) {
      seed.address = text.replace(/\\s+/g, ' ');
    }
  }
  return seed;
}`;

const replace8 = `function harvestSeedFromHistory(hist) {
  const turns = Array.isArray(hist) ? hist : [];
  const seed = {};
  for (let i = turns.length - 1; i >= 0 && i >= turns.length - 12; i--) {
    const turn = turns[i];
    if (turn?.role !== 'user') continue;
    const text = String(turn.text || turn.parts?.[0]?.text || '').trim();
    if (!text) continue;
    if (looksLikeVolunteeredDeliveryDetails(text)) {
      const v = parseVolunteeredDeliveryDetails(text);
      if (v?.name && !seed.name) seed.name = v.name;
      if (v?.phone && !seed.phone) seed.phone = v.phone;
      if (v?.address && !seed.address) seed.address = v.address;
    }
    if (!seed.phone) {
      const p = extractPhoneFromText(text) || normalizePhone(text);
      if (p) seed.phone = p;
    }
    if (!seed.name && looksLikePersonName(text)) {
      seed.name = text.replace(/\\s+/g, ' ');
    }
    if (!seed.address && looksLikeAddressOnly(text)) {
      seed.address = text.replace(/\\s+/g, ' ');
    }
  }
  return seed;
}`;

if (!code.includes(target8)) {
  console.error('Target 8 not found!');
  process.exit(1);
}
code = code.replace(target8, replace8);

// ----------------------------------------------------
// 9. seedCartFromPromisedProduct: match "تحبي تسجلي" etc.
// ----------------------------------------------------
const target9 = `      // Only a line that actually promises to register something — otherwise
      // any reply that merely mentions a product would fill the cart.
      if (!/(هسجل|أسجل|اسجل|هضيف|أضيف|اضيف|أوردر جديد|اوردر جديد)/.test(text)) continue;`;

const replace9 = `      // Only a line that actually offers or promises to register something
      if (!/(تسجل|نسجل|هسجل|أسجل|اسجل|هضيف|نضيف|أضيف|اضيف|أوردر|اوردر)/.test(text)) continue;`;

if (!code.includes(target9)) {
  console.error('Target 9 not found!');
  process.exit(1);
}
code = code.replace(target9, replace9);

// ----------------------------------------------------
// 10. Line 6765: Unclear Checkout Intent -> check message & history before dumping routines
// ----------------------------------------------------
const target10 = `  // "عايزة أطلب" with nothing chosen yet → put the three routines in front of
  // her so she can pick. Asking "تحبي أساعدك تختاري؟" first burns a turn and
  // loses people. Outside the scripted maze so it holds with LLM-first on.
  if (
    message
    && !(sessionCarts[sid] || []).length
    && !checkoutWizards[sid]
    && !selectedBundleKey
    && !selectedProductSlug
    && isExplicitCheckoutIntent(message)
  ) {
    return finish({
      reply: offersWhenUnclearReply('تحت أمرك يا فندم 💜'),
      sessionId: sid,
      keepCta: true,
    }, message);
  }`;

const replace10 = `  // "عايزة أطلب" with nothing chosen yet → put the three routines in front of
  // her so she can pick. Asking "تحبي أساعدك تختاري؟" first burns a turn and
  // loses people. Outside the scripted maze so it holds with LLM-first on.
  if (
    message
    && !(sessionCarts[sid] || []).length
    && !checkoutWizards[sid]
    && isExplicitCheckoutIntent(message)
  ) {
    const { data: dbProducts } = await sb.from('products')
      .select('id, name, price, old_price, slug, stock, image_url')
      .eq('is_active', true);

    const mentionedProds = dbProducts ? resolveProductMentions(message, dbProducts) : [];
    const mentionedBundle = resolveBundleFromCustomerText(message);

    let targetProduct = null;
    let targetBundle = null;

    if (mentionedProds.length === 1) {
      targetProduct = mentionedProds[0];
    } else if (mentionedBundle) {
      targetBundle = mentionedBundle;
    } else if (selectedProductSlug && dbProducts) {
      targetProduct = dbProducts.find((p) => p.slug === selectedProductSlug) || null;
    } else if (selectedBundleKey) {
      targetBundle = getBundleByKey(selectedBundleKey);
    } else if (dbProducts) {
      const recentHistoryText = (chatHistory || []).slice(-6).map((h) => h.text || '').join('\\n');
      const histMentions = resolveProductMentions(recentHistoryText, dbProducts);
      if (histMentions.length === 1) {
        targetProduct = histMentions[0];
      }
    }

    if (targetProduct) {
      selectedProductSlug = targetProduct.slug;
      await persist({ selectedProduct: targetProduct.slug });
      sessionCarts[sid] = [{
        id: targetProduct.id,
        name: targetProduct.name,
        image: targetProduct.image_url,
        price: targetProduct.price,
        qty: 1,
      }];
      await persist({ cart: sessionCarts[sid] });

      const seed = harvestSeedFromHistory(chatHistory);
      const parsedNow = looksLikeVolunteeredDeliveryDetails(message) ? parseVolunteeredDeliveryDetails(message) : null;
      const name = parsedNow?.name || seed?.name || customerName || null;
      const phone = parsedNow?.phone || seed?.phone || customerPhone || null;
      const address = parsedNow?.address || seed?.address || null;

      const promo = await getPromo();
      const unitPrice = Math.round(Number(targetProduct.price) || 0);
      const finalPrice = (promo?.percent > 0 && promo.percent < 100)
        ? unitPrice - Math.round((unitPrice * promo.percent) / 100)
        : unitPrice;
      const promoNote = (promo?.percent > 0 && promo.percent < 100)
        ? \` (\${finalPrice} ج بعد خصم الـ \${promo.percent}%)\`
        : \` (\${finalPrice} ج)\`;

      if (name && phone && address) {
        checkoutWizards[sid] = {
          step: 'confirm_saved',
          data: { name, phone, address },
        };
        await persist({ checkoutWizard: checkoutWizards[sid], customerPhone: phone, customerName: name });
        return finish({
          reply:
            \`تمام يا \${name.split(' ')[0]} 💜 هسجلك **\${targetProduct.name}**\${promoNote}.\\n\\n\` +
            \`بيانات التوصيل:\\n\` +
            \`• الاسم: \${name}\\n\` +
            \`• الموبايل: \${phone}\\n\` +
            \`• العنوان: \${address}\\n\\n\` +
            \`تحبي نأكد الأوردر على البيانات دي؟ 🌿\`,
          sessionId: sid,
          keepCta: true,
        }, message);
      }

      checkoutWizards[sid] = {
        step: 'details',
        data: { name, phone, address },
      };
      await persist({ checkoutWizard: checkoutWizards[sid] });
      return finish({
        reply:
          \`تحت أمرك يا فندم 💜 هسجلك **\${targetProduct.name}**\${promoNote}.\\n\\n\` +
          \`من فضلك ابعتيلي:\\n\` +
          \`\${name ? \`• الاسم: \${name} ✅\\n\` : '• اسمك الثلاثي\\n'}\` +
          \`\${phone ? \`• رقم الموبايل: \${phone} ✅\\n\` : '• رقم الموبايل\\n'}\` +
          \`\${address ? \`• العنوان: \${address} ✅\\n\` : '• العنوان بالتفصيل والمحافظة\\n'}\` +
          \`عشان نأكد الأوردر ونشحنلك 🎁\`,
        sessionId: sid,
        keepCta: true,
      }, message);
    }

    if (targetBundle) {
      selectedBundleKey = targetBundle.key;
      await persist({ selectedBundle: targetBundle.key });
      const seed = harvestSeedFromHistory(chatHistory);
      const parsedNow = looksLikeVolunteeredDeliveryDetails(message) ? parseVolunteeredDeliveryDetails(message) : null;
      const name = parsedNow?.name || seed?.name || customerName || null;
      const phone = parsedNow?.phone || seed?.phone || customerPhone || null;
      const address = parsedNow?.address || seed?.address || null;

      if (name && phone && address) {
        checkoutWizards[sid] = {
          step: 'confirm_saved',
          data: { name, phone, address },
        };
        await persist({ checkoutWizard: checkoutWizards[sid], customerPhone: phone, customerName: name });
        return finish({
          reply:
            \`تمام يا \${name.split(' ')[0]} 💜 هسجلك **\${targetBundle.name}** (\${targetBundle.bundlePrice} ج — شحن مجاني 🎁).\\n\\n\` +
            \`بيانات التوصيل:\\n\` +
            \`• الاسم: \${name}\\n\` +
            \`• الموبايل: \${phone}\\n\` +
            \`• العنوان: \${address}\\n\\n\` +
            \`تحبي نأكد الأوردر على البيانات دي؟ 🌿\`,
          sessionId: sid,
          keepCta: true,
        }, message);
      }
    }

    // Nothing was selected or discussed anywhere → dump the three routine offers
    return finish({
      reply: offersWhenUnclearReply('تحت أمرك يا فندم 💜'),
      sessionId: sid,
      keepCta: true,
    }, message);
  }`;

if (!code.includes(target10)) {
  console.error('Target 10 not found!');
  process.exit(1);
}
code = code.replace(target10, replace10);

// ----------------------------------------------------
// 11. Move isResultsTimelineQuestion above isWhiteningEffectAsk at line 7165
// ----------------------------------------------------
const target11 = `    // FAQ hard facts (don't leave whitening/guarantee/results to Gemini guess)
    if (isWhiteningEffectAsk(message)) {
      const whitening = await replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug);
      if (whitening?.selectedProduct) {
        selectedProductSlug = whitening.selectedProduct;
        await persist({ selectedProduct: whitening.selectedProduct });
      }
      return finish(whitening, message);
    }
    if (isGuaranteeOrSafetyQuestion(message)) {
      return finish({ reply: guaranteeMinistryReply(), sessionId: sid }, message);
    }
    if (isStockistPharmacyAsk(message)) {
      return finish(await replyStockistPharmacies(message, sid), message);
    }
    if (isResultsTimelineQuestion(message)) {
      return finish({ reply: resultsTimelineReply(), sessionId: sid }, message);
    }`;

const replace11 = `    // FAQ hard facts (don't leave whitening/guarantee/results to Gemini guess)
    if (isResultsTimelineQuestion(message)) {
      return finish({ reply: resultsTimelineReply(), sessionId: sid }, message);
    }
    if (isWhiteningEffectAsk(message)) {
      const whitening = await replyWhiteningEffectAsk(message, sid, chatHistory, selectedProductSlug);
      if (whitening?.selectedProduct) {
        selectedProductSlug = whitening.selectedProduct;
        await persist({ selectedProduct: whitening.selectedProduct });
      }
      return finish(whitening, message);
    }
    if (isGuaranteeOrSafetyQuestion(message)) {
      return finish({ reply: guaranteeMinistryReply(), sessionId: sid }, message);
    }
    if (isStockistPharmacyAsk(message)) {
      return finish(await replyStockistPharmacies(message, sid), message);
    }`;

if (!code.includes(target11)) {
  console.error('Target 11 not found!');
  process.exit(1);
}
code = code.replace(target11, replace11);

// ----------------------------------------------------
// 12. Persist priced.selectedProduct at line 7043
// ----------------------------------------------------
const target12 = `    if (
      wantsSingleSkuOnly(message)
      || isFewNamedProductsPriceAsk(message)
      || (isPriceQuestion(message) && /(غسول|كريم|لوشن|ليزر)/.test(prepareCustomerText(expandFrancoAndTypos(message))))
    ) {
      const priced = await tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug);
      if (priced?.reply) return finish(priced, message);
    }`;

const replace12 = `    if (
      wantsSingleSkuOnly(message)
      || isFewNamedProductsPriceAsk(message)
      || (isPriceQuestion(message) && /(غسول|كريم|لوشن|ليزر)/.test(prepareCustomerText(expandFrancoAndTypos(message))))
    ) {
      const priced = await tryPriceQuestion(message, sid, chatHistory, selectedBundleKey, selectedProductSlug);
      if (priced?.reply) {
        if (priced.selectedProduct) {
          selectedProductSlug = priced.selectedProduct;
          await persist({ selectedProduct: priced.selectedProduct });
        }
        return finish(priced, message);
      }
    }`;

if (!code.includes(target12)) {
  console.error('Target 12 not found!');
  process.exit(1);
}
code = code.replace(target12, replace12);

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('All 12 patches applied successfully to lib/chatEngine.js!');
