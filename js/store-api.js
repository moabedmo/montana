// Montana storefront — client API layer.
// Same conventions as crm/js/crm-api.js: direct CDN ESM import (no
// bundler), anon key hardcoded (RLS-enforced — see
// supabase/migrations/005_storefront_hardening.sql /
// 006_storefront_hardening_fix.sql for the policies this relies on).
//
// Security model: anon can SELECT products/categories (public catalog
// browsing) and INSERT customers/orders/order_items (guest checkout),
// but can never SELECT customers/orders/order_items — orders.create()
// therefore returns the just-inserted rows directly (Postgres
// `return=representation`, wired in automatically by supabase-js's
// .select() after .insert()) instead of a follow-up query, so there is
// no order-enumeration/IDOR surface at all.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const products = {
  list: async () => {
    const { data, error } = await sb.from('products')
      .select('*, categories(name, slug)')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  },
  get: async (slug) => {
    const { data, error } = await sb.from('products')
      .select('*, categories(name, slug)')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (error) throw error;
    return data;
  }
};

export const categories = {
  list: async () => {
    const { data, error } = await sb.from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

export const shipping = {
  list: async () => {
    const { data, error } = await sb.from('shipping_rates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

export const settings = {
  get: async (key) => {
    const { data, error } = await sb.from('site_settings').select('value').eq('key', key).single();
    if (error) throw error;
    return data.value;
  },
  getMany: async (keys) => {
    const { data, error } = await sb.from('site_settings').select('key, value').in('key', keys);
    if (error) throw error;
    return Object.fromEntries((data || []).map(r => [r.key, r.value]));
  }
};

export const banners = {
  list: async (platform) => {
    const { data, error } = await sb.from('banners')
      .select('*')
      .eq('is_active', true)
      .eq('platform', platform)
      .order('sort_order');
    if (error) throw error;
    return data;
  }
};

export const reviews = {
  listForProduct: async (productId) => {
    const { data, error } = await sb.rpc('list_product_reviews', { p_product_id: productId });
    if (error) throw error;
    return data || [];
  },
  submit: async ({ product_id, customer_name, rating, comment }) => {
    const { data, error } = await sb.rpc('submit_product_review', {
      p_product_id: product_id,
      p_customer_name: customer_name,
      p_rating: rating,
      p_comment: comment || null
    });
    if (error) throw error;
    return data;
  }
};

export const contact = {
  submit: async ({ name, email, subject, message, order_number }) => {
    const { data, error } = await sb.rpc('submit_contact_message', {
      p_name: name,
      p_email: email,
      p_subject: subject,
      p_message: message,
      p_order_number: order_number || null
    });
    if (error) throw error;
    return data;
  }
};

export const newsletter = {
  subscribe: async (email) => {
    const { data, error } = await sb.rpc('subscribe_newsletter', { p_email: email });
    if (error) throw error;
    return data;
  }
};

export const auth = {
  upsertProfile: async (name, phone) => {
    const { data, error } = await sb.rpc('upsert_customer_from_auth', {
      p_name: name,
      p_phone: phone || null
    });
    if (error) throw error;
    return data;
  },
  updateProfile: async (name, phone) => {
    const { data, error } = await sb.rpc('update_customer_profile', {
      p_name: name,
      p_phone: phone || null
    });
    if (error) throw error;
    return data;
  },
  rewardsBalance: async () => {
    const { data, error } = await sb.rpc('get_my_rewards_balance');
    if (error) throw error;
    return data;
  }
};

export const returns = {
  submit: async ({ order_number, customer_name, customer_phone, customer_email, reason, details }) => {
    const { data, error } = await sb.rpc('submit_return_request', {
      p_order_number: order_number,
      p_customer_name: customer_name,
      p_customer_phone: customer_phone,
      p_customer_email: customer_email || null,
      p_reason: reason,
      p_details: details || null
    });
    if (error) throw error;
    return data;
  }
};

// Payment-proof screenshots (bucket "montana", same one crm-api.js
// uses) — public insert-only path, see 010_shipping_and_deposit.sql.
export async function uploadPaymentProof(file, orderHint) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const hint = String(orderHint || 'order').replace(/[^\d]/g, '') || 'order';
  const key = `payment-proofs/${Date.now()}_${hint}.${ext}`;
  const contentType = file.type || (ext === 'png' ? 'image/png' : 'image/jpeg');
  const { error } = await sb.storage.from('montana').upload(key, file, { contentType, upsert: false });
  if (error) throw error;
  const { data } = sb.storage.from('montana').getPublicUrl(key);
  return data.publicUrl;
}

export const ingredients = {
  list: async () => {
    const { data, error } = await sb.from('ingredients').select('*').order('sort_order');
    if (error) throw error;
    return data;
  },
  get: async (slug) => {
    const { data, error } = await sb.from('ingredients').select('*').eq('slug', slug).single();
    if (error) throw error;
    return data;
  },
  // Ingredient names aren't foreign-keyed to products — matched by
  // substring against products.ingredients (comma-separated text),
  // same normalization used on the product page (see product.html).
  usedInProducts: (ingredientName, allProducts) => {
    return allProducts.filter(p => (p.ingredients || '').includes(ingredientName));
  }
};

export const coupons = {
  // Never selects the raw table — validate_coupon() runs server-side
  // with SECURITY DEFINER and only returns pass/fail + discount info.
  validate: async (code, subtotal) => {
    const { data, error } = await sb.rpc('validate_coupon', { p_code: code, p_subtotal: subtotal });
    if (error) throw error;
    return data; // { valid, message? } or { valid: true, code, discount_type, discount_value }
  }
};

export const orders = {
  // items: [{ id, name, image, price, qty }]
  // Runs entirely inside create_guest_order() (SECURITY DEFINER) —
  // a direct client insert().select() would fail under RLS, because
  // Postgres checks a table's SELECT policy against the RETURNING
  // clause of an INSERT, and anon deliberately has no SELECT policy
  // on customers/orders/order_items (see 007_guest_checkout_rpc.sql).
  create: async ({ customer, items, payment_method = 'cod', delivery_method = 'standard', coupon_code = null, notes = null, subtotal, shipping_cost = 0, discount = 0, total, governorate = null, payment_proof_url = null, deposit_amount = 0, points_redeemed = 0 }) => {
    const { data, error } = await sb.rpc('create_guest_order', {
      p_customer: customer,
      p_items: items,
      p_payment_method: payment_method,
      p_delivery_method: delivery_method,
      p_coupon_code: coupon_code,
      p_notes: notes,
      p_subtotal: subtotal,
      p_shipping_cost: shipping_cost,
      p_discount: discount,
      p_total: total,
      p_governorate: governorate,
      p_payment_proof_url: payment_proof_url,
      p_deposit_amount: deposit_amount,
      p_points_redeemed: points_redeemed || 0
    });
    if (error) throw error;
    return data; // { order, items }
  },

  // order_number + phone act as a lightweight lookup token — no
  // account/bearer-token system needed for a guest to check status.
  // abortSignal bounds this — tracking.html calls it both on manual lookup
  // and on a 10s poll loop, and an unbounded stall here used to leave the
  // page just sitting there with no error and no result.
  getStatus: async (orderNumber, phone) => {
    const { data, error } = await sb.rpc('get_order_status', { p_order_number: orderNumber, p_phone: phone })
      .abortSignal(AbortSignal.timeout(10000));
    if (error) throw error;
    return data; // { found: false } or { found: true, status, payment_status, ... }
  },

  // Attaches a payment-proof screenshot to an order created earlier
  // (the chat-bot flow: order first, deposit/proof afterwards) —
  // same order_number+phone token as getStatus().
  attachPaymentProof: async (orderNumber, phone, proofUrl, depositAmount = 200) => {
    const { data, error } = await sb.rpc('attach_payment_proof', {
      p_order_number: orderNumber,
      p_phone: phone,
      p_payment_proof_url: proofUrl,
      p_deposit_amount: depositAmount
    });
    if (error) throw error;
    return data;
  },

  listMine: async () => {
    const { data, error } = await sb.rpc('get_my_orders');
    if (error) throw error;
    return data || [];
  }
};
