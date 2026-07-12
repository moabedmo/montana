// Order cancel / modify wizard — verified by customer phone number.
const { createClient } = require('@supabase/supabase-js');
const { normalizePhone, toWesternDigits } = require('./chatSessionStore');
const { resolveProductMentions } = require('./orderContext');

const sb = createClient(
  process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
);

function wantsOrderManagement(message) {
  const t = String(message || '').trim();
  if (!t) return false;
  if (/(طلبت\s*إ?يه|إ?يه\s*(اللي\s*)?طلبت|طلبي\s*فيه\s*إ?يه|حبيبتي\s*انا\s*كدا\s*طلبت)/i.test(t)) return false;

  // Whole-message short commands only (not a substring match) — catches a
  // bare "الغاء"/"عدل" reply without needing "طلب" nearby, but crucially
  // does NOT match e.g. "الغسول" (a product name containing "الغ" as a
  // substring), which the old bare-substring regex used to misfire on.
  if (/^(الغاء|إلغاء|الغي|ألغي|cancel|عدل|تعديل|عدّل|modify)[\s!.،؟?]*$/i.test(t)) return true;

  return /(الغاء|إلغاء|الغي|ألغي|cancel).{0,15}(طلب|أوردر|اوردر|order)/i.test(t)
    || /(طلب|أوردر|اوردر|order).{0,15}(الغاء|إلغاء|الغي|ألغي|cancel)/i.test(t)
    || /(عدل|تعديل|عدّل|modify|غير).{0,15}(طلب|أوردر|اوردر|order|عنوان|محافظة)/i.test(t)
    || /(طلب|أوردر|اوردر|order).{0,15}(عدل|تعديل|عدّل|modify)/i.test(t)
    || /(اضيف|أضيف|هضيف|إضافة|اضافة).{0,15}(طلب|أوردر|اوردر|order)/i.test(t)
    || /(طلب|أوردر|اوردر|order).{0,15}(اضيف|أضيف|هضيف|إضافة|اضافة)/i.test(t)
    || (/^(طلبي|الطلب|اوردر|أوردر|order)$/i.test(t));
}

function statusAr(s) {
  const m = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    preparing: 'جاري التجهيز',
    shipped: 'تم الشحن',
    delivered: 'تم التوصيل',
    cancelled: 'ملغي',
  };
  return m[s] || s;
}

async function listOrders(phone) {
  const { data, error } = await sb.rpc('list_orders_by_phone', { p_phone: phone, p_limit: 5 });
  if (error) return { error: error.message };
  return data;
}

async function cancelOrder(orderNumber, phone) {
  const { data, error } = await sb.rpc('cancel_order_by_phone', {
    p_order_number: orderNumber,
    p_phone: phone,
  });
  if (error) return { error: error.message };
  return data;
}

async function updateDelivery(orderNumber, phone, fields) {
  const { data, error } = await sb.rpc('update_order_delivery_by_phone', {
    p_order_number: orderNumber,
    p_phone: phone,
    p_address: fields.address || null,
    p_governorate: fields.governorate || null,
    p_customer_name: fields.customer_name || null,
  });
  if (error) return { error: error.message };
  return data;
}

async function addItemToOrder(orderNumber, phone, productId, qty) {
  const { data, error } = await sb.rpc('add_item_to_order', {
    p_order_number: orderNumber,
    p_phone: phone,
    p_product_id: productId,
    p_quantity: qty,
  });
  if (error) return { ok: false, error: 'rpc_failed' };
  return data;
}

// Simple substring match — good enough here since the customer is
// directly answering "what do you want to add", not casually mentioning
// a product mid-conversation (that fuzzier case is chatEngine's job).
// Returns every match (not just the first) so the caller can ask the
// customer to pick when a short name like "كريم" matches more than one
// real product, instead of silently guessing.
async function matchProducts(text) {
  const { data: products, error } = await sb.from('products').select('id, name, price, image_url').eq('is_active', true);
  if (error || !products) return [];
  const t = String(text || '').trim();
  if (!t) return [];
  const exact = products.filter(p => t.includes(p.name) || p.name.includes(t));
  if (exact.length) return exact;
  // Customer typed a colloquial name ("كريم الليزر") instead of the exact
  // catalog name ("كريم العناية بعد الليزر") — same alias resolution the
  // chat price-question fast path uses, so this step doesn't wrongly tell
  // her the product doesn't exist.
  return resolveProductMentions(t, products);
}

function formatOrdersList(orders) {
  return orders.map((o, i) =>
    `${i + 1}. \`${o.order_number}\` — ${statusAr(o.status)} — ${Math.round(o.total)} ج.م`
  ).join('\n');
}

function pickOrderFromMessage(message, orders) {
  const t = String(message || '').trim();
  const mon = t.match(/MON-\d{5}/i);
  if (mon) return mon[0].toUpperCase();
  const num = parseInt(toWesternDigits(t), 10);
  if (num >= 1 && num <= orders.length) return orders[num - 1].order_number;
  return null;
}

/**
 * @returns {object|null} response payload or null to continue normal chat
 */
async function tryOrderManageWizard(message, sid, wizard, persist) {
  let w = wizard;

  if (!w && wantsOrderManagement(message)) {
    w = { step: 'phone', phone: null, orderNumber: null, orders: null };
    await persist({ orderWizard: w });
    return {
      reply: 'تمام يا فندم 💜 عشان ألغي أو أعدّل الطلب، ابعتيلي **رقم الموبايل** اللي سجّلتيه في الطلب (11 رقم).',
      sessionId: sid,
    };
  }

  if (!w) return null;

  const text = String(message || '').trim();

  if (w.step === 'phone') {
    const phone = normalizePhone(text);
    if (!phone) {
      // Real bug (live customer transcript): a customer accidentally in
      // this wizard kept asking an unrelated question ("موجودين في صيدليات
      // ايه؟") and got the same "invalid phone number" error on every single
      // reply, forever — the step never let a message through unless it
      // happened to parse as a phone number. If her text has no digits at
      // all, she's clearly not attempting one — drop the wizard and let the
      // real message reach normal handling instead of trapping her here.
      const hasDigits = /[\d٠-٩۰-۹]/.test(text);
      if (!hasDigits) {
        await persist({ orderWizard: null });
        return null;
      }
      return { reply: 'رقم الموبايل مش صحيح — لازم يبدأ بـ 01 ويكون 11 رقم 📱', sessionId: sid };
    }
    const listed = await listOrders(phone);
    if (listed.error) {
      await persist({ orderWizard: null });
      return { reply: 'حصلت مشكلة، حاولي تاني 🙏', sessionId: sid };
    }
    if (!listed.found) {
      await persist({ orderWizard: null });
      return { reply: 'مفيش طلبات نشطة على الرقم ده. تأكدي من الرقم أو ابعتيلي رقم الطلب MON-xxxxx 📋', sessionId: sid };
    }
    const orders = listed.orders;
    w = { step: orders.length === 1 ? 'action' : 'pick_order', phone, orders, orderNumber: orders.length === 1 ? orders[0].order_number : null };
    await persist({ orderWizard: w, customerPhone: phone });

    if (orders.length === 1) {
      const o = orders[0];
      return {
        reply: `لقيت طلبك \`${o.order_number}\` — ${statusAr(o.status)} — ${Math.round(o.total)} ج.م\n\nاختاري:\n• **الغاء** — إلغاء الطلب\n• **تعديل عنوان** — تغيير العنوان/المحافظة\n• **إضافة منتج** — تضيفي منتج على نفس الطلب\n• **خروج** — إلغاء العملية`,
        sessionId: sid,
      };
    }
    return {
      reply: `لقيت ${orders.length} طلبات على الرقم ده:\n\n${formatOrdersList(orders)}\n\nابعتيلي **رقم الطلب** (MON-xxxxx) أو رقم من القائمة (1، 2…).`,
      sessionId: sid,
    };
  }

  if (w.step === 'pick_order') {
    const picked = pickOrderFromMessage(text, w.orders || []);
    if (!picked) {
      return { reply: 'معلش، مش فاهمة. ابعتيلي رقم الطلب MON-xxxxx أو رقم من القائمة.', sessionId: sid };
    }
    w.step = 'action';
    w.orderNumber = picked;
    await persist({ orderWizard: w });
    return {
      reply: `تمام — الطلب \`${picked}\`\n\nاختاري:\n• **الغاء** — إلغاء الطلب\n• **تعديل عنوان** — تغيير العنوان/المحافظة\n• **إضافة منتج** — تضيفي منتج على نفس الطلب\n• **خروج** — إلغاء العملية`,
      sessionId: sid,
    };
  }

  if (w.step === 'action') {
    if (/^(خروج|الغ|cancel|لا)$/i.test(text)) {
      await persist({ orderWizard: null });
      return { reply: 'تمام، اتلغت العملية 😊 تحبي حاجة تانية؟', sessionId: sid };
    }
    if (/^(الغاء|إلغاء|الغ|ألغ|cancel)/i.test(text)) {
      const res = await cancelOrder(w.orderNumber, w.phone);
      await persist({ orderWizard: null });
      if (res.error === 'not_found') return { reply: 'الطلب مش موجود على الرقم ده.', sessionId: sid };
      if (res.error === 'cannot_cancel') return { reply: `مش ممكن نلغي الطلب — حالته: ${statusAr(res.status)} 📦`, sessionId: sid };
      if (!res.ok) return { reply: 'تعذّر الإلغاء، حاولي تاني أو تواصلي معانا.', sessionId: sid };
      if (res.already) return { reply: `الطلب \`${w.orderNumber}\` ملغي بالفعل ✅`, sessionId: sid };
      return { reply: `تم إلغاء الطلب \`${w.orderNumber}\` بنجاح ✅`, sessionId: sid };
    }
    if (/^(تعديل|تعديل عنوان|عدل|عدل العنوان|modify)/i.test(text)) {
      w.step = 'new_address';
      await persist({ orderWizard: w });
      return { reply: 'ابعتيلي **العنوان الجديد** بالتفصيل (المنطقة + الشارع) 📍', sessionId: sid };
    }
    if (/^(اضيف|أضيف|إضافة|اضافة)/i.test(text)) {
      w.step = 'add_product';
      await persist({ orderWizard: w });
      return { reply: 'تمام، عايزة تضيفي إيه؟ اكتبي اسم المنتج 🛍️', sessionId: sid };
    }
    return { reply: 'اختاري: **الغاء** أو **تعديل عنوان** أو **إضافة منتج** أو **خروج**', sessionId: sid };
  }

  if (w.step === 'add_product') {
    const matches = await matchProducts(text);
    if (!matches.length) {
      return { reply: 'معلش، مش لاقياه. اكتبي اسم المنتج زي ما هو في المتجر 🙏', sessionId: sid };
    }
    if (matches.length > 1) {
      const names = matches.map((p) => `• ${p.name}`).join('\n');
      return {
        reply: `في أكتر من منتج قريب من كده، أي واحد بالظبط؟\n${names}`,
        sessionId: sid,
      };
    }
    const product = matches[0];
    w.pendingProduct = product;
    w.step = 'add_quantity';
    await persist({ orderWizard: w });
    return { reply: `تمام، ${product.name} — كام قطعة عايزة؟`, sessionId: sid };
  }

  if (w.step === 'add_quantity') {
    const digits = toWesternDigits(text).replace(/[^\d]/g, '');
    let qty = parseInt(digits, 10);
    if (!qty || qty < 1) {
      if (/واحد|واحدة|قطعة|علبة/i.test(text)) qty = 1;
      else return { reply: 'اكتبي رقم صحيح للكمية 🙏', sessionId: sid };
    }
    const result = await addItemToOrder(w.orderNumber, w.phone, w.pendingProduct.id, qty);
    await persist({ orderWizard: null });
    if (result.error === 'window_expired') {
      return { reply: 'معلش، عدّى أكتر من 6 ساعات على الطلب فمش ينفع نضيف عليه — لازم تعملي طلب جديد منفصل.', sessionId: sid };
    }
    if (result.error === 'cannot_modify') {
      return { reply: `مش ممكن نضيف على الطلب ده — حالته: ${statusAr(result.status)} 📦`, sessionId: sid };
    }
    if (result.error === 'out_of_stock') {
      return { reply: 'معلش، الكمية دي مش متاحة دلوقتي 🙏', sessionId: sid };
    }
    if (result.error === 'not_found') {
      return { reply: 'الطلب مش موجود على الرقم ده.', sessionId: sid };
    }
    if (!result.ok) {
      return { reply: 'تعذّر الإضافة، حاولي تاني أو تواصلي معانا.', sessionId: sid };
    }
    return {
      reply: `تمام! ✅ اتضاف ${result.added_qty} × ${result.added_product} لطلبك \`${result.order_number}\`. الإجمالي بقى ${Math.round(result.new_total)} ج.م`,
      sessionId: sid,
    };
  }

  if (w.step === 'new_address') {
    if (text.length < 5) return { reply: 'العنوان قصير — اكتبيه بالتفصيل أكتر 🙏', sessionId: sid };
    w.newAddress = text;
    w.step = 'new_governorate';
    await persist({ orderWizard: w });
    return { reply: 'تمام — **المحافظة** الجديدة؟', sessionId: sid };
  }

  if (w.step === 'new_governorate') {
    const res = await updateDelivery(w.orderNumber, w.phone, {
      address: w.newAddress,
      governorate: text,
    });
    await persist({ orderWizard: null });
    if (res.error === 'not_found') return { reply: 'الطلب مش موجود.', sessionId: sid };
    if (res.error === 'cannot_modify') return { reply: `مش ممكن نعدّل — الحالة: ${statusAr(res.status)}`, sessionId: sid };
    if (res.error === 'invalid_governorate') return { reply: 'المحافظة مش متاحة — اكتبي اسم محافظة من اللي عندنا.', sessionId: sid };
    if (!res.ok) return { reply: 'تعذّر التعديل، حاولي تاني.', sessionId: sid };
    return {
      reply: `تم تحديث الطلب \`${res.order_number}\` ✅\n📍 ${res.address}\n🏙 ${res.governorate}\n💰 الإجمالي: ${Math.round(res.total)} ج.م`,
      sessionId: sid,
    };
  }

  return null;
}

module.exports = {
  wantsOrderManagement,
  tryOrderManageWizard,
  normalizePhone,
};
