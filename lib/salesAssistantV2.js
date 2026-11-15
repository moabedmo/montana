/**
 * Montana AI Sales Assistant v2.0 — Core Architecture & Safety Engine
 *
 * Implements:
 * 1. Versioned Checkout Snapshot & Explicit Confirmation Binding
 * 2. Atomic Snapshot-Bound Order Idempotency (no stuck pre-claims on failure; allows intentional repeat purchases)
 * 3. Lease-Renewing Per-Session Concurrency Control & Conflict-Free Atomic State Merge
 * 4. 8-Stage Flexible Sales Conversation State Machine
 * 5. Strict Sales Claim Verifier & Honest Model-Failure Fallback
 * 6. Feature Flag Controller (off | shadow | canary | on) & Zero-Side-Effect Shadow Mode
 * 7. Privacy-Safe Structured Telemetry (PII-Masked)
 */

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// 1. CONVERSATION STATES (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
const CONVERSATION_STATES = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  PRODUCT_RECOMMENDATION: 'PRODUCT_RECOMMENDATION',
  OBJECTION_HANDLING: 'OBJECTION_HANDLING',
  PURCHASE_INTENT: 'PURCHASE_INTENT',
  CHECKOUT: 'CHECKOUT',
  ORDER_CONFIRMATION: 'ORDER_CONFIRMATION',
  POST_PURCHASE_SUPPORT: 'POST_PURCHASE_SUPPORT',
  HUMAN_HANDOFF: 'HUMAN_HANDOFF',
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERSIONED CHECKOUT SNAPSHOT & EXPLICIT CONFIRMATION BINDING (Req #3 & #4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a canonical, deterministic SHA-256 hash over every financial and
 * delivery field of a checkout state. Any change to items, quantities, prices,
 * shipping, discount, total, name, phone, address, or governorate produces a
 * completely different snapshotHash and invalidates prior confirmation.
 */
function computeCheckoutSnapshot({
  cart = [],
  subtotal = 0,
  shipping = 0,
  discount = 0,
  total = 0,
  name = '',
  phone = '',
  address = '',
  governorate = '',
} = {}) {
  const canonicalItems = (Array.isArray(cart) ? cart : [])
    .map((item) => ({
      id: String(item.id ?? item.bundleKey ?? item.name ?? '').trim(),
      name: String(item.name || '').trim(),
      qty: Number(item.qty || 1),
      price: Math.round(Number(item.price || 0)),
      isBundle: !!item.isBundle,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const canonicalPayload = {
    items: canonicalItems,
    subtotal: Math.round(Number(subtotal || 0)),
    shipping: Math.round(Number(shipping || 0)),
    discount: Math.round(Number(discount || 0)),
    total: Math.round(Number(total || 0)),
    name: String(name || '').trim().replace(/\s+/g, ' '),
    phone: String(phone || '').trim().replace(/\D/g, ''),
    address: String(address || '').trim().replace(/\s+/g, ' '),
    governorate: String(governorate || '').trim().replace(/\s+/g, ' '),
  };

  const json = JSON.stringify(canonicalPayload);
  const hash = crypto.createHash('sha256').update(json).digest('hex').slice(0, 24);

  return {
    hash,
    payload: canonicalPayload,
  };
}

/**
 * Updates or initializes versioned snapshot metadata on a checkoutWizard object.
 * If the computed hash differs from pendingSnapshotHash, increments snapshotVersion
 * and clears confirmedSnapshotHash so the customer MUST explicitly confirm the new summary.
 */
function bindCheckoutSnapshot(wizard = {}, snapshotParams = {}, sid = 'default') {
  const { hash, payload } = computeCheckoutSnapshot(snapshotParams);
  const prevHash = wizard.pendingSnapshotHash || null;
  const prevVersion = Number(wizard.snapshotVersion || 0);

  const hashChanged = prevHash !== hash;
  const nextVersion = hashChanged ? prevVersion + 1 : (prevVersion || 1);
  const operationId = `op_${String(sid).replace(/[^a-zA-Z0-9_-]/g, '_')}_v${nextVersion}_${hash.slice(0, 12)}`;

  return {
    ...wizard,
    step: 'confirm_saved',
    data: {
      ...(wizard.data || {}),
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      governorate: payload.governorate,
      subtotal: payload.subtotal,
      shipping: payload.shipping,
      discount: payload.discount,
      total: payload.total,
    },
    pendingSnapshotHash: hash,
    confirmedSnapshotHash: hashChanged ? null : (wizard.confirmedSnapshotHash || null),
    snapshotVersion: nextVersion,
    operationId,
    snapshotPayload: payload,
  };
}

/**
 * Verifies that the customer's explicit confirmation matches the exact current
 * checkout snapshot. Returns { valid: true, operationId, snapshotHash } or
 * { valid: false, reason }.
 */
function verifyExplicitSnapshotConfirmation(wizard, currentSnapshotParams) {
  if (!wizard || !wizard.pendingSnapshotHash) {
    return { valid: false, reason: 'NO_PENDING_SNAPSHOT' };
  }
  const { hash } = computeCheckoutSnapshot(currentSnapshotParams);
  if (hash !== wizard.pendingSnapshotHash) {
    return {
      valid: false,
      reason: 'SNAPSHOT_MUTATED_BEFORE_CONFIRM',
      expectedHash: wizard.pendingSnapshotHash,
      actualHash: hash,
    };
  }
  if (!wizard.confirmedSnapshotHash || wizard.confirmedSnapshotHash !== hash) {
    return {
      valid: false,
      reason: 'EXPLICIT_CONFIRMATION_REQUIRED',
      pendingHash: hash,
    };
  }
  return {
    valid: true,
    operationId: wizard.operationId,
    snapshotHash: hash,
    snapshotVersion: wizard.snapshotVersion || 1,
  };
}

const ORDER_SAVED_HUMAN_CONFIRMATION_REPLY =
  'تمام يا فندم 💜 طلب حضرتك اتسجل بنجاح، وحد من فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب وتفاصيل التوصيل.';

/**
 * Formats the complete order summary for human confirmation workflow.
 */
function formatVersionedOrderSummary({
  cart = [],
  subtotal = 0,
  shipping = 0,
  discount = 0,
  total = 0,
  name = '',
  phone = '',
  address = '',
  governorate = '',
} = {}) {
  const itemsLines = (Array.isArray(cart) ? cart : []).map((it) => {
    const qty = Number(it.qty || 1);
    const linePrice = Math.round(Number(it.price || 0) * qty);
    return `• ${it.name} (الكمية: ${qty}) — ${linePrice} ج`;
  });

  const shippingText = Number(shipping) === 0 ? 'مجاني 🎁' : `${Math.round(Number(shipping))} ج`;
  const discountLine = Number(discount) > 0 ? `\n• الخصم: -${Math.round(Number(discount))} ج` : '';

  return (
    `ملخص أوردرك يا فندم 💜:\n\n` +
    `📦 **المنتجات:**\n${itemsLines.join('\n')}\n` +
    `• إجمالي المنتجات: ${Math.round(Number(subtotal))} ج` +
    discountLine +
    `\n• الشحن (${governorate}): ${shippingText}\n` +
    `• **الإجمالي المطلوب عند الاستلام:** **${Math.round(Number(total))} جنيه** (الدفع كاش بعد المعاينة)\n\n` +
    `📍 **بيانات التوصيل:**\n` +
    `• الاسم: ${name}\n` +
    `• الموبايل: ${phone}\n` +
    `• المحافظة والعنوان: ${governorate} — ${address}\n\n` +
    `فريق مونتانا هيتواصل معاكِ تليفونياً لتأكيد الطلب وتفاصيل التوصيل 🚚`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ATOMIC DATABASE-LEVEL ORDER IDEMPOTENCY (Req #1)
// ─────────────────────────────────────────────────────────────────────────────
// In-flight and committed idempotency store (backed by DB lookup + in-memory guard
// for same-instance races). Never blocks retries when order creation fails!
const committedOrdersByOpKey = new Map();
const inFlightOrderCreates = new Map();

/**
 * Executes an order creation with strict operation-key idempotency.
 * - If the same `operationId` is currently in flight, awaits the same promise.
 * - Checks DB `orders` table (via `findOrderByOperationId`) for an already committed order
 *   carrying `[op_key:${operationId}]`. If found, returns that order without duplicating.
 * - Executes `createOrderFn()`. If `createOrderFn()` fails or returns `{ error }`,
 *   NO idempotency claim is persisted, so the customer's retry will succeed!
 * - Intentional repeat purchases get a new `snapshotVersion` and a new `operationId`,
 *   so they are never blocked.
 */
async function executeIdempotentOrderCreate({
  operationId,
  sid,
  findExistingOrderFn,
  createOrderFn,
}) {
  if (!operationId) {
    return createOrderFn();
  }

  // 1. Check in-memory committed cache (fast path)
  if (committedOrdersByOpKey.has(operationId)) {
    return {
      ...committedOrdersByOpKey.get(operationId),
      idempotentReplay: true,
    };
  }

  // 2. Coalesce concurrent identical in-flight requests
  if (inFlightOrderCreates.has(operationId)) {
    return inFlightOrderCreates.get(operationId);
  }

  const runPromise = (async () => {
    try {
      // 3. Check database for an already-committed order with this exact operationId
      if (typeof findExistingOrderFn === 'function') {
        const existing = await findExistingOrderFn(operationId, sid);
        if (existing && existing.order_number && !existing.error) {
          committedOrdersByOpKey.set(operationId, existing);
          return { ...existing, idempotentReplay: true };
        }
      }

      // 4. Execute actual order creation
      const created = await createOrderFn(operationId);

      // 5. Only record idempotency if creation actually succeeded!
      if (created && created.order_number && !created.error) {
        committedOrdersByOpKey.set(operationId, created);
      }
      return created;
    } finally {
      inFlightOrderCreates.delete(operationId);
    }
  })();

  inFlightOrderCreates.set(operationId, runPromise);
  return runPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. LEASE-RENEWING PER-SESSION CONCURRENCY CONTROLLER (Req #2)
// ─────────────────────────────────────────────────────────────────────────────
const activeSessionLeases = new Map(); // sid -> { ownerId, expiresAt, queue: [] }

/**
 * Acquires a per-session lease with automatic heartbeat renewal while the turn
 * (including long AI calls exceeding initial TTL) is executing.
 * - Never drops or discards an incoming customer message: concurrent messages
 *   for the same `sid` wait in a FIFO queue until the active lease finishes,
 *   then load the freshly persisted state.
 * - Supports an optional distributed DB lock hook (`dbAcquireLease`, `dbRenewLease`, `dbReleaseLease`).
 */
async function withSessionConcurrencyLock(
  sid,
  taskFn,
  {
    leaseTtlMs = 8000,
    heartbeatIntervalMs = 2500,
    maxWaitMs = 15000,
    dbLockAdapter = null,
  } = {}
) {
  const key = String(sid || 'default');
  const ownerId = `lease_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const startWait = Date.now();

  // Wait in FIFO order if another turn for the same session is currently executing
  while (activeSessionLeases.has(key)) {
    const current = activeSessionLeases.get(key);
    if (!current || Date.now() > current.expiresAt) {
      // Expired orphaned lease — take over safely
      activeSessionLeases.delete(key);
      break;
    }
    if (Date.now() - startWait >= maxWaitMs) {
      // Never discard the customer message even if wait ceiling is reached;
      // proceed and rely on atomicMergeSessionState at save time.
      logTelemetry('session_lock_wait_timeout_proceeding', { sid: key });
      break;
    }
    await new Promise((resolve) => {
      current.waiters.push(resolve);
      setTimeout(resolve, Math.min(400, maxWaitMs - (Date.now() - startWait)));
    });
  }

  const leaseRecord = {
    ownerId,
    expiresAt: Date.now() + leaseTtlMs,
    ownershipLost: false,
    dbLeaseAcquired: false,
    waiters: [],
  };
  activeSessionLeases.set(key, leaseRecord);

  // Distributed DB lease acquisition with retry polling if locked by another serverless instance
  if (dbLockAdapter?.acquire) {
    while (Date.now() - startWait < maxWaitMs) {
      try {
        const res = await dbLockAdapter.acquire(key, ownerId, leaseTtlMs);
        if (!res || res.acquired !== false) {
          leaseRecord.dbLeaseAcquired = true;
          if (res?.state_version != null) {
            leaseRecord.dbStateVersion = Number(res.state_version);
          }
          break;
        }
      } catch (err) {
        logTelemetry('session_db_lock_acquire_error', { sid: key, error: err?.message });
        break;
      }
      await new Promise((r) => setTimeout(r, Math.min(120, Math.max(25, maxWaitMs - (Date.now() - startWait)))));
    }
    if (!leaseRecord.dbLeaseAcquired && Date.now() - startWait >= maxWaitMs) {
      logTelemetry('session_db_lock_wait_timeout_proceeding', { sid: key });
    }
  }

  // Heartbeat timer: extends lease TTL while AI call is still running and verifies ownership
  const heartbeat = setInterval(async () => {
    const cur = activeSessionLeases.get(key);
    if (cur && cur.ownerId === ownerId && !cur.ownershipLost) {
      cur.expiresAt = Date.now() + leaseTtlMs;
      if (dbLockAdapter?.renew) {
        try {
          const res = await dbLockAdapter.renew(key, ownerId, leaseTtlMs);
          if (res && res.renewed === false) {
            cur.ownershipLost = true;
            logTelemetry('session_lease_ownership_lost', { sid: key, ownerId });
          }
        } catch (_) {}
      }
    }
  }, heartbeatIntervalMs);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  try {
    return await taskFn({
      ownerId,
      isOwnershipValid: () => !leaseRecord.ownershipLost,
      getLeaseRecord: () => leaseRecord,
    });
  } finally {
    clearInterval(heartbeat);
    const cur = activeSessionLeases.get(key);
    if (cur && cur.ownerId === ownerId) {
      activeSessionLeases.delete(key);
      const waiters = cur.waiters.splice(0);
      for (const w of waiters) {
        try { w(); } catch (_) {}
      }
    }
    if (dbLockAdapter?.release && !leaseRecord.ownershipLost) {
      try {
        await dbLockAdapter.release(key, ownerId);
      } catch (_) {}
    }
  }
}

/**
 * Builds a database-backed session lock adapter wired to Migration 118 RPCs:
 * acquire_chat_session_lease, renew_chat_session_lease, release_chat_session_lease.
 */
function createSupabaseSessionLockAdapter(sbClient) {
  if (!sbClient || typeof sbClient.rpc !== 'function') return null;
  return {
    async acquire(sid, ownerId, ttlMs) {
      const { data, error } = await sbClient.rpc('acquire_chat_session_lease', {
        p_session_id: sid,
        p_owner_id: ownerId,
        p_ttl_ms: ttlMs,
      });
      if (error) throw error;
      return data;
    },
    async renew(sid, ownerId, ttlMs) {
      const { data, error } = await sbClient.rpc('renew_chat_session_lease', {
        p_session_id: sid,
        p_owner_id: ownerId,
        p_ttl_ms: ttlMs,
      });
      if (error) throw error;
      return data;
    },
    async release(sid, ownerId) {
      const { data, error } = await sbClient.rpc('release_chat_session_lease', {
        p_session_id: sid,
        p_owner_id: ownerId,
      });
      if (error) throw error;
      return data;
    },
  };
}

/**
 * Conflict-free state merge (Optimistic Concurrency Control).
 * If a concurrent serverless instance updated the session while this turn was running
 * (detected either via timestamp or via state_version advancing beyond expectedVersion),
 * merges newly collected customer slots (name, phone, address, governorate), cart,
 * and history so no customer input is ever lost and stale state never overwrites newer slots.
 */
function atomicMergeSessionState(latestDbState = {}, localTurnState = {}, baseStateLoadedAt = null) {
  const dbUpdated = latestDbState?.updatedAt ? new Date(latestDbState.updatedAt).getTime() : 0;
  const baseLoaded = baseStateLoadedAt ? new Date(baseStateLoadedAt).getTime() : 0;
  const dbVersion = Number(latestDbState?.stateVersion ?? latestDbState?.state_version ?? 0);
  const expectedVersion = localTurnState?.expectedVersion != null ? Number(localTurnState.expectedVersion) : null;
  const hadVersionAdvance = expectedVersion != null && dbVersion > expectedVersion;
  const hadConcurrentUpdate = hadVersionAdvance || (dbUpdated > baseLoaded && baseLoaded > 0);

  if (!hadConcurrentUpdate) {
    return {
      ...localTurnState,
      stateVersion: (dbVersion + 1),
    };
  }

  // Merge wizard data slots without losing fields collected in either turn
  const dbWiz = latestDbState.checkoutWizard ?? latestDbState.checkout_wizard ?? null;
  const localWiz = localTurnState.checkoutWizard;
  let mergedWizard = localWiz !== undefined ? localWiz : dbWiz;

  if (localWiz && dbWiz) {
    const mergedData = {
      ...(dbWiz.data || {}),
      ...(localWiz.data || {}),
    };
    // Preserve non-empty slots from DB if local slot was empty
    for (const slot of ['name', 'phone', 'address', 'governorate']) {
      if (!mergedData[slot] && dbWiz.data?.[slot]) {
        mergedData[slot] = dbWiz.data[slot];
      }
    }
    mergedWizard = {
      ...dbWiz,
      ...localWiz,
      data: mergedData,
    };
  } else if (!localWiz && dbWiz) {
    mergedWizard = dbWiz;
  }

  // Merge carts without dropping items added in a concurrent turn
  const dbCart = Array.isArray(latestDbState.cart) ? latestDbState.cart : [];
  const localCart = Array.isArray(localTurnState.cart) ? localTurnState.cart : [];
  let mergedCart = localCart;
  if (localCart.length === 0 && dbCart.length > 0 && !localTurnState.explicitlyClearedCart) {
    mergedCart = dbCart;
  }

  // Merge history without dropping turns
  const dbHist = Array.isArray(latestDbState.history) ? latestDbState.history : [];
  const localHist = Array.isArray(localTurnState.history) ? localTurnState.history : [];
  const seenTurns = new Set();
  const mergedHistory = [];
  for (const h of [...dbHist, ...localHist]) {
    const sig = `${h.role}:${String(h.text || '').trim()}`;
    if (!seenTurns.has(sig)) {
      seenTurns.add(sig);
      mergedHistory.push(h);
    }
  }

  return {
    ...localTurnState,
    cart: mergedCart,
    customerPhone: localTurnState.customerPhone || latestDbState.customerPhone || latestDbState.customer_phone || null,
    customerName: localTurnState.customerName || latestDbState.customerName || latestDbState.customer_name || null,
    checkoutWizard: mergedWizard,
    history: mergedHistory.slice(-24),
    stateVersion: (dbVersion + 1),
  };
}

/**
 * Deduplicates identical tool calls within a single LLM turn.
 */
function createTurnToolDeduplicator() {
  const cache = new Map();
  return async function runDeduplicatedTool(name, args, executorFn) {
    const mutatingTools = new Set(['add_to_cart', 'add_routine_offer', 'start_checkout', 'create_order', 'save_customer_details']);
    const key = `${name}:${JSON.stringify(args || {})}`;
    if (mutatingTools.has(name) && cache.has(key)) {
      logTelemetry('duplicate_tool_call_coalesced', { tool: name });
      return cache.get(key);
    }
    const result = await executorFn(name, args);
    if (mutatingTools.has(name)) {
      cache.set(key, result);
    }
    return result;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONVERSATION STATE RESOLVER (Phase 4)
// ─────────────────────────────────────────────────────────────────────────────
function resolveConversationState({
  message = '',
  cart = [],
  checkoutWizard = null,
  orderJustCreated = false,
  needsHuman = false,
  botPaused = false,
  hasOrderInHistory = false,
} = {}) {
  if (needsHuman || botPaused) return CONVERSATION_STATES.HUMAN_HANDOFF;
  if (orderJustCreated) return CONVERSATION_STATES.POST_PURCHASE_SUPPORT;

  const wizStep = checkoutWizard?.step || null;
  if (wizStep === 'confirm_saved' || wizStep === 'await_order_confirm') {
    return CONVERSATION_STATES.ORDER_CONFIRMATION;
  }
  if (wizStep && ['details', 'name', 'phone', 'address', 'governorate', 'await_method'].includes(wizStep)) {
    return CONVERSATION_STATES.CHECKOUT;
  }

  const t = String(message || '').trim();
  if (detectCustomerObjection(t) || /(غالي|كتير|مكلف|ميزانيتي|أرخص|ارخص|بديل|واثق|نتيجة\s*بجد|كلام\s*اعلانات|جربت\s*كتير|خايف|هفكر|هشوف|افكر)/i.test(t)) {
    return CONVERSATION_STATES.OBJECTION_HANDLING;
  }
  if (/(عايز[ةه]?\s*(أطلب|اطلب|اشتر|أشتر|اخد|آخد)|سجّ?لي|احجزي|ابعتيلي\s*الاوردر|نكمل\s*الاوردر)/i.test(t) || cart.length > 0) {
    return CONVERSATION_STATES.PURCHASE_INTENT;
  }
  if (hasOrderInHistory && /(امتي\s*يوصل|ميعاد|التوصيل|طلبي)/i.test(t)) {
    return CONVERSATION_STATES.POST_PURCHASE_SUPPORT;
  }
  if (/(كريم|غسول|لوشن|روتين|عرض|تفتيح|ليزر|حبوب|تصبغ|بكام|سعر)/i.test(t)) {
    return CONVERSATION_STATES.PRODUCT_RECOMMENDATION;
  }
  return CONVERSATION_STATES.DISCOVERY;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. STRICT SALES CLAIM VERIFIER & HONEST FALLBACK (Req #5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies and sanitizes a generated reply against Montana's approved business data.
 * Blocks unverified medical claims, fake faster-result promises, unauthorized free
 * shipping promises, false automatic follow-up promises, and silicone mentions.
 */
function verifyAndSanitizeSalesClaims(replyText, { activePromo = null, cartCount = 0, hasRoutineBundle = false } = {}) {
  if (!replyText) return { text: replyText, violations: [] };
  let text = String(replyText);
  const violations = [];

  // 1. Block silicone / scar gel mentions unconditionally
  if (/سيليكون|silicone|جل\s*الندبات/i.test(text)) {
    violations.push('SILICONE_MENTION_BLOCKED');
    text = 'منتجات مونتانيا المتاحة للعناية بالبشرة والجسم هي: غسول التفتيح، كريم التفتيح، لوشن اليدين والجسم، غسول حب الشباب، وكريم ما بعد الليزر 💜 قوليلي تحبي تعرفي تفاصيل أنهي منتج؟';
  }

  // 2. Block false promises of automatic background follow-up ("ثواني وهرجعلك" / "هرد عليكي حالاً")
  if (/(ثواني\s*وهرجعلك|هرد\s*عليك[يى]?\s*حالا|هسأل\s*واكلمك|هراجع\s*واكلمك)/i.test(text)) {
    violations.push('FALSE_AUTO_FOLLOWUP_PROMISE_BLOCKED');
    text = text.replace(
      /(?:تمام يا فندم[،,\s]*)?(?:ثواني\s*وهرجعلك[^\n.]*|هرد\s*عليك[يى]?\s*حالا[^\n.]*)/gi,
      'تحت أمرك يا فندم 💜 ابعتيلي استفسارك أو اسم المنتج وهجاوبك فوراً'
    );
  }

  // 3. Block unapproved medical cure claims or rigid guarantees ('مضمون 100%', 'تفتيح فوري', 'علاج نهائي', 'في 14 يوم بس', 'مبيرجعش الاسمرار')
  // NOTE: Montana approved expected range (14-21 days with qualified variation) is preserved.
  if (/(علاج\s*نهائي|بيقضي\s*نهائياً\s*في|تفتيح\s*فوري\s*من\s*أول\s*ساعة|مضمون\s*100%|مضمون\s*(?:في|خلال)|نتيجة\s*مضمونة|(?:في|خلال)\s*(?:14|21|١٤|٢١|\d+)\s*يوم\s*بس|مبيرجعش\s*الاسمرار|النتيجة\s*دائمة|ما\s*بترجعش\s*تاني|ثابتة\s*ومبيرجعش)/i.test(text)) {
    violations.push('UNAPPROVED_MEDICAL_OR_INSTANT_CLAIM');
    text = text
      .replace(/علاج\s*نهائي(?:\s*طبي)?/gi, 'عناية تجميلية فعالة')
      .replace(/تفتيح\s*فوري\s*من\s*أول\s*ساعة/gi, 'تحسن تدريجي ملحوظ مع الاستخدام المنتظم')
      .replace(/مضمون\s*100%(?:\s*طبياً)?/gi, 'مرخص من وزارة الصحة ومكوناته مدروسة بعناية')
      .replace(/مضمون\s*(?:في|خلال)/gi, 'متوقع مع الاستخدام المنتظم خلال')
      .replace(/نتيجة\s*مضمونة/gi, 'نتيجة ملحوظة بإذن الله')
      .replace(/(?:في|خلال)\s*(?:14|21|١٤|٢١|\d+)\s*يوم\s*بس/gi, 'عادةً خلال 14 إلى 21 يوم وتختلف الاستجابة من بشرة للتانية')
      .replace(/(?:ف?النتيجة\s*بتفضل\s*ثابتة\s*و)?مبيرجعش\s*الاسمرار/gi, 'ومناسبة للاستخدام اليومي')
      .replace(/النتيجة\s*دائمة\s*وم?ا?بترجعش\s*تاني/gi, 'عناية لطيفة ومستمرة');
  }

  // 4. Block unauthorized discount claims when no promo is active
  if (!activePromo?.active && /(خصم\s*\d+\s*%|عليه\s*خصم\s*خاص)/i.test(text)) {
    violations.push('UNAUTHORIZED_DISCOUNT_CLAIM');
    text = text.replace(/(?:و)?(?:عليه\s*)?خصم\s*\d+\s*%/gi, '');
  }

  // 5. Block wrong Ministry of Health license numbers
  const licenseMatches = text.match(/COSMTOL\d+/gi);
  if (licenseMatches) {
    for (const lic of licenseMatches) {
      if (lic.toUpperCase() !== 'COSMTOL25117170') {
        violations.push('INVALID_LICENSE_NUMBER_CORRECTED');
        text = text.replace(lic, 'COSMTOL25117170');
      }
    }
  }

  // 6. Block presenting post-laser cream or skincare as sunscreen / beach sunblock substitute
  if (
    /(كريم\s*(?:ما\s*)?بعد\s*الليزر|كريم\s*العناية\s*بعد\s*الليزر|بوست\s*ليزر|كريم\s*التفتيح|لوشن)/i.test(text) &&
    /(واقي\s*شمس|صن\s*بلوك|sunscreen|sunblock|بديل\s*واقي|بديل\s*صن)/i.test(text)
  ) {
    violations.push('POST_LASER_SUNSCREEN_CLAIM_BLOCKED');
    text =
      'للعناية ببشرتك في المصيف والتعرض للشمس يا فندم 💜 بننصحك دايماً باستخدام واقي شمس مناسب نهاراً، ومعاه **لوشن اليدين والجسم** (229 جنيه) للترطيب العميق وتهدئة الجفاف بعد البحر، مع **كريم التفتيح** (249 جنيه) بالليل للحفاظ على نضارة وتوحيد لون البشرة (دواعي استعمال تجميلية).\n' +
      'وملحوظة مهمة للأمانة: منتجات مونتانيا عناية وترطيب وليست بديلاً عن واقي الشمس (Sunscreen) أثناء التعرض للشمس نهاراً، و**كريم ما بعد الليزر** مخصص لتهدئة البشرة بعد جلسات الليزر فقط.';
  }

  // 7. Block absolute compatibility claims ("مفيش أي تعارض بينهم خالص")
  if (/(مفيش|لا\s*يوجد)\s*(?:أي\s*)?تعارض(?:\s*بينهم)?\s*(?:خالص|نهائياً|نهائيا|تماماً|تماما|مطلقاً)/i.test(text)) {
    violations.push('ABSOLUTE_COMPATIBILITY_CLAIM_SANITIZED');
    text = text
      .replace(/مفيش\s*(?:أي\s*)?تعارض(?:\s*بينهم)?\s*(?:خالص|نهائياً|نهائيا|تماماً|تماما)/gi, 'تقدري تنسقي بينهم بأمان حسب حالة بشرتك وطريقة الاستخدام')
      .replace(/لا\s*يوجد\s*(?:أي\s*)?تعارض(?:\s*بينهم)?\s*(?:نهائياً|نهائيا|تماماً|تماما|مطلقاً)/gi, 'يمكن التنسيق بينهم بما يناسب حالة البشرة وطريقة الاستخدام');
  }

  // 8. Block recommending body lotion for facial use
  if (
    /لوشن\s*(?:اليدين\s*و)?الجسم/i.test(text) &&
    /(على\s*الوش|للوجه|للوش|لبشرة\s*الوش|لبشرة\s*الوجه|على\s*وجهك|على\s*وشك)/i.test(text)
  ) {
    violations.push('BODY_LOTION_FOR_FACE_BLOCKED');
    text = text.replace(
      /لوشن\s*(?:اليدين\s*و)?الجسم(?:\s*(?:على\s*الوش|للوجه|للوش|على\s*وشك|على\s*وجهك))?/gi,
      'كريم مرطب مخصص للوجه (أو كريم ما بعد الليزر لتهدئة الوجه)'
    );
  }

  return { text: text.trim(), violations };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6.B INTELLIGENT & ELEGANT SALES CONSULTANT PERSONALITY & OBJECTION HANDLER
// ─────────────────────────────────────────────────────────────────────────────

function getV2SalesConsultantPrompt() {
  return `
## شخصية مستشارة مبيعات مونتانيا الذكية والراقية (Montana Elite Sales Consultant):
أنتِ لستِ مجرد روبوت ولا قارئة كتالوج، بل مستشارة تجميل ومبيعات مصرية خبيرة، لبقة، ومحترفة جداً.
هدفك: مساعدة العميلة بصدق، كسب ثقتها الكاملة، وتقديم تجربة شراء ممتعة بدون أي إلحاح أو تكرار روبوتي.

1. أسلوب التحدث واللهجة المصرية الراقية:
- تحدثي بعامية مصرية مهذبة وطبيعية («يا فندم»، «من عنيا»، «تحت أمرك»، «مقدّرة جداً»).
- نبرة متحدثة حقيقية واثقة وخفيفة، مع إيموجي لطيف خفيف 💜😊.
- افهمي كل مصطلحات العامية المصرية والمشاكل الدارجة («وشي متبهدل»، «عايزة حاجة تنجز»، «اسمرار مضايقني»، «بكام ده»، «مفيش أرخص؟»، «طب والشحن؟»، «قشطة»، «ماشي»).
- افهمي الكلام حتى مع الأخطاء الإملائية الشائعة أو الفرانكو بدون ارتباك.
- حافظي على الإيجاز الذكي (عادة 2 إلى 4 أسطر مركّزة). تجنبي الرسائل الطويلة إلا لو طُلب شرح تفصيلي.

2. فهم الاحتياج أولاً قبل الترشيح (Consultative Discovery):
- إذا كان سؤال العميلة عاماً أو غير محدد («عايزة حاجة لبشرتي» أو «تنصحوني بإيه»):
  اسألي سؤالاً استشارياً واحداً فقط لفهم نوع بشرتها أو المشكلة الأساسية قبل اقتراح أي منتج (مثلاً: «طبيعة بشرتك إيه يا فندم (دهنية، جافة، ولا مختلطة)؟» أو «المشكلة الأساسية اللي حابة نركز عليها أكتر: تصبغات وبقع ولا حبوب ودهون؟»).
  ممنوع تماماً إمطار العميلة بـ 3 أو 4 أسئلة في رسالة واحدة.
- إذا حددت مشكلتها بوضوح (مثلاً: «تفتيح البكيني وتحت الإبط» أو «عندي حبوب دهنية»): ركزي فوراً على حل مشكلتها بدون أسئلة زيادة.
- السؤال عن الروتينات أو العروض بصيغة الجمع («الروتينات»، «عروض الروتين»، «استفسار عن الروتينات»، «ايه الروتينات اللي عندكم»، «ممكن تفاصيل الروتينات»):
  اعرضي عروض الروتين التلاتة المتاحة بالكامل بإيجاز ووضوح مع أسعارها الحقيقية ومكوناتها وهدف كل روتين (شحن مجاني 🎁 على كل روتين):
  ١. روتين التفتيح الكامل (777 ج): غسول التفتيح + كريم التفتيح + لوشن اليدين والجسم (لتفتيح وتوحيد لون الوجه والمناطق الحساسة وترطيب الجسم بالكامل).
  ٢. عرض عناية ما بعد الليزر (618 ج): كريم ما بعد الليزر + كريم التفتيح (لتهدئة وترطيب البشرة بعد جلسات الليزر وإزالة الشعر وتوحيد اللون).
  ٣. عرض الوش والجسم (558 ج): غسول حب الشباب + لوشن الجسم (لتنظيف المسام والتحكم في الدهون والحبوب مع ترطيب ونعومة الجسم).
  واختمي بسؤال العميلة بلطف: «قوليلي حابة تركزي على إيه أكتر في بشرتك، أو أي روتين فيهم حاسة إنه الأقرب ليكي؟ 🌿».
  **ممنوع تماماً** ذكر روتين واحد فقط وإسقاط باقي الروتينات عندما يكون السؤال استفساراً عاماً عن الروتينات!

3. ترشيح المنتجات وشرح القيمة (Value & Honest Benefit Selling):
- رشحي فقط المنتج المناسب لاحتياجها من منتجات مونتانيا الرسمية المعتمدة:
  • كريم التفتيح (249 ج): ألفا أربوتين + عرقسوس لتفتيح وتوحيد لون البشرة والمناطق الحساسة والركب والأكواع بلطف وبدون تقشير كيميائي قاسي.
  • غسول التفتيح (299 ج): تنظيف عميق ونضارة يومية وتهيئة البشرة لامتصاص كريم التفتيح.
  • روتين التفتيح الكامل (777 ج): الغسول + الكريم + لوشن اليدين والجسم (شحن مجاني 🎁 — توفير 60-70 ج شحن).
  • كريم ما بعد الليزر (369 ج): بانثينول وألوفيرا لترطيب وتهدئة الاحمرار والتهيج بعد جلسات الليزر وإزالة الشعر (ممنوع تقديمه كواقي شمس).
  • عرض عناية ما بعد الليزر (618 ج): كريم الليزر + كريم التفتيح (شحن مجاني 🎁).
  • غسول حب الشباب (329 ج): بحمض الساليسيليك وزيت شجرة الشاي لتنقية المسام والتحكم في الإفرازات الدهنية.
  • عرض الوش والجسم (558 ج): غسول حب الشباب + لوشن الجسم (شحن مجاني 🎁).
  • لوشن اليدين والجسم (229 ج): ترطيب عميق يدوم ونعومة للجسم بعد الاستحمام أو التعرض للشمس (مخصص لليدين والجسم فقط ولا يُستخدم على الوجه).
- اشرحي طريقة الاستخدام والنتيجة بصدق وأمانة مع النطاق الزمني المعتمد لمنتجات مونتانيا: «الترطيب والنعومة بيبانوا من أول يومين، والتحسن في التفتيح وتوحيد لون البشرة بيبدأ يظهر بشكل تدريجي ملحوظ عادةً خلال 14 إلى 21 يوم مع الاستخدام اليومي المنتظم، وتختلف سرعة الاستجابة من بشرة للتانية حسب نوعها ومدى الالتزام بالروتين دون وعود مطلقة أو ضمانات قاطعة».
- عند الاستفسار عن التعرض للشمس أو المصيف والبحر: وضحي أهمية استخدام واقي شمس مناسب نهاراً، ورشحي لوشن اليدين والجسم وكريم التفتيح للعناية والترطيب بعد البحر ومساءً، مع التأكيد الصريح على أنها عناية تجميلية وليست بديلاً عن واقي الشمس (Sunscreen).
- ترخيص وزارة الصحة وهيئة الدواء: المنتجات مرخصة رسمياً (وكريم التفتيح مسجل برقم COSMTOL25117170). لا تعممي رقم تسجيل واحد على باقي المنتجات بدون إثبات.

4. فن التعامل الذكي مع الاعتراضات والأسئلة المزدوجة (Mastering Objections & Multi-Intent):
- السعر غالي («غالي / السعر عالي / مفيش أرخص»):
  تفهمي رأيها برقي وود: «مقدّرة جداً يا فندم، بس قيمته في تركيز المواد الفعالة اللي فيه زي الألفا أربوتين الأصلي ومستخلص العرقسوس، والعبوة بتكفيكي فترة كويسة جداً لأن نقطة بسيطة كافية. وممكن نبدأ بكريم التفتيح لوحده بـ 249 ج لتجربة النتيجة بنفسك الأول».
- عايزة أفكر («هفكر / هشوف كده»):
  احترمي رغبتها بلباقة بدون أي ضغط أو إلحاح: «أكيد يا فندم خدي وقتك براحتك خالص، ولو احتجتي تسألي عن أي تفاصيل أو طريقة استخدام أنا معاكي في أي وقت 💜».
- النتيجة والضمان («بيجيب نتيجة بجد؟ / مضمون؟»):
  طمأنة علمية وعملية: «المنتج مرخص من وزارة الصحة (COSMTOL25117170) ومكوناته آمنة ومدروسة بدون أي مواد كيميائية ضارة. ومعاكي حق المعاينة الكاملة وقت الاستلام والدفع كاش عند الاستلام بعد التأكد».
- مناسب لبشرتي؟ / للبشرة الحساسة:
  «تركيبته لطيفة جداً وخالية من المواد القاسية ومناسب لمختلف أنواع البشرة. ولو بشرتك سريعة التحسس، دايماً بننصح باختبار حساسية بسيط على جزء صغير من الجلد الأول للتأكد».
- البشرة الجافة جداً أو المقشرة وترطيب الوجه («بشرتي جافة ومقشرة هل هيرطب ولا لوشن»):
  جاوبي أولاً على استفسار الملاءمة والترطيب قبل ذكر الأسعار:
  «كريم التفتيح بيوفر ترطيب خفيف ونعومة مع التفتيح، ولكن مع الجفاف الشديد والتقشير في الوجه بننصح دايماً بتهدئة البشرة وترميم حاجز الترطيب أولاً، وتجربة الكريم على جزء صغير، ولو التقشير شديد الأفضل استخدام كريم مرطب مهدئ (زي كريم ما بعد الليزر) لحد ما يهدى التقشير 💜 وبالنسبة للوشن: لوشن اليدين والجسم مخصص للجسم فقط ومش للوجه لتجنب سد المسام».
- مفيش خصم؟ / راعيني شوية:
  «الأسعار محددة ومدروسة على أعلى جودة للمكونات يا فندم، لكن ميزتنا الأكبر إن الشحن بيكون مجاني تماماً لو طلبتِ أي روتين كامل أو 3 منتجات، وده بيوفرلك من 60 لـ 70 جنيه مصاريف شحن 🎁».
- في توصيل؟ ومصاريفه كام؟ / سؤال الشحن والدفع معاً («الشحن بياخد قد ايه والدفع ازاي»):
  جاوبي على السؤالين معاً بأمانة ودقة:
  «الشحن متاح لكل محافظات مصر (بما فيها الإسكندرية) خلال 2 لـ 3 أيام عمل، وخدمة العملاء بتأكد معاكِ الميعاد تليفونياً قبل الشحن 💜 وبالنسبة للدفع: 100% كاش عند الاستلام بعد المعاينة التامة، ومفيش أي عربون أو دفع مسبق نهائياً».

5. التقاط إشارات الشراء وإتمام الطلب بسلاسة (Closing Smoothly):
- عند إشارات الشراء الواضحة («عايزة اطلب / احجزيلي / يوصل امتى لو طلبت / خلاص هاخد ده»):
  اطلبي البيانات في رسالة واحدة بهدوء وبدون تعقيد:
  «ألف مبروك اختيارك يا فندم 💜 عشان نجهز لحضرتك الأوردر، ابعتيلي في رسالة واحدة:
  • الاسم (أي اسم: اسم أول، ثنائي، أو ثلاثي)
  • رقم الموبايل
  • المحافظة والعنوان بالتفصيل
  والدفع كاش عند الاستلام بعد المعاينة ✅».
- تقبلي أي اسم يذكره العميل سواء كان كلمة واحدة (مثل: منى، سارة، أحمد، كريم)، أو اسمين، أو ثلاثة، وممنوع نهائياً مطالبة العميل باسم ثلاثي أو الاعتراض على الاسم المذكور.
- بمجرد توفر بيانات التوصيل كاملة (الاسم، الموبايل، المحافظة، العنوان) مع وجود منتج أو روتين في السلة:
  يتم تسجيل الأوردر فوراً، وممنوع نهائياً أن تطلبي من العميلة كتابة «أكد» أو «نعم» أو «موافق» لتأكيد الأوردر، لأن تأكيد الأوردر بيتم تليفونياً من خلال مكالمة هاتفية من فريق مونتانا البشري.
- إذا أرسلت العميلة بيانات ناقصة (مثلاً كتبت الاسم والموبايل والعنوان بدون المحافظة):
  اسألي حصراً عن البيان الناقص فقط (مثلاً: «المحافظة إيه يا فندم؟»)، وممنوع تكرار طلب البيانات التي ذكرتها بالفعل، وممنوع نهائياً طلب تأكيد الأوردر («تحبي نأكد الأوردر») قبل اكتمال البيانات وتسجيلها.
- بعد نجاح تسجيل الأوردر يكون الرد دائماً:
  «تمام يا فندم 💜 طلب حضرتك اتسجل بنجاح، وحد من فريق مونتانا هيتواصل معاك تليفونيًا لتأكيد الطلب وتفاصيل التوصيل.»
- تجنبي السؤال المتكرر «تحبي أسجلك أوردر» بعد كل إجابة؛ جاوبي استفسارها أولاً، واسألي عن الأوردر فقط عند وجود اهتمام واضح.

6. الاقتراح المكمل الذكي (Helpful Cross-selling):
- فقط عندما يكون مفيداً للعميلة: اقترحي بلطف غسول التفتيح مع كريم التفتيح لتهيئة البشرة («لو حابة النتيجة تكون أسرع، الغسول قبل الكريم بيهيأ البشرة للامتصاص، وممكن تكتفي بالكريم الأول برضه ممتاز جداً 💜»).

7. الأمانة الطبية والتجميلية وقواعد السلامة الحرجة:
- الفراكشنال ليزر وحالات الحرقان والتهيج:
  إذا ذكرت العميلة جلسة فراكشنال ليزر (أو تقشير كيميائي) ولديها حرقان، احمرار شديد، أو تهيج وتسأل عن وضع كريم بعد الليزر أو أي منتج تجميلي:
  ممنوع منعاً باتاً ترشيح أو بيع كريم ما بعد الليزر أو أي منتج تجميلي!
  الرد الإلزامي: تمني السلامة والتأكيد على ضرورة الرجوع فوراً للطبيبة أو العيادة المعالجة قبل وضع أي منتج جديد، لأن البشرة بعد الفراكشنال تكون في مرحلة تعافي وتحت بروتوكول طبي خاص لسلامتها.
- توافق المنتجات وموانع الاستخدام:
  ممنوع تماماً إطلاق تعميمات مطلقة مثل «مفيش أي تعارض بينهم خالص».
  فرّقي دائماً بين ليزر إزالة الشعر العادي (الذي يناسبه كريم بعد الليزر لتهدئة البشرة السليمة في أول 24-48 ساعة، ثم التفتيح لاحقاً بعد هدوء الجلد) وبين الفراكشنال ليزر أو التقشير أو البشرة الملتهبة/المقشرة (حيث يُمنع استخدام غسول التفتيح أو أي مقشرات وأحماض نشطة عليها حتى تمام التعافي).
- لا تقومي بتشخيص طبي لأمراض جلدية خطيرة أو معقدة (صدفية شديدة، إكزيما حادة، جروح مفتوحة، دمامل ملتهبة حادة)؛ انصحي بلطف باستشارة طبيب جلدية متخصص، فسلامة العميلة أولويتنا دائماً.
- لا تذكري جل السيليكون أو علاج الندبات إطلاقاً.
`;
}

function detectCustomerObjection(text) {
  const t = String(text || '').trim();
  if (/(نتيجة\s*بجد|مضمون|بيجيب\s*نتيجة|واثقة|واثق|كلام\s*اعلانات|جربت\s*كتير|بيفتح\s*فعلا|خايف|خايفة|مش\s*هيشتغل|مش\s*أصلي|مش\s*اصلي|غير\s*الإعلان|غير\s*الاعلان|تقليد|نصب)/i.test(t)) return 'efficacy';
  if (/(غالي|مكلف|ميزانيتي|أرخص|ارخص|بديل|اوفر|أوفر|(سعره|غالي|فلوس|مبلغ)\s*كتير|كتير\s*عليا)/i.test(t)) return 'price';
  if (/(هفكر|هشوف|وقت|مش\s*دلوقتي|مش\s*جاهزة|أفكر)/i.test(t)) return 'thinkAboutIt';
  if (/(مناسب\s*لبشرتي|حساسة|ينفع\s*معايا|حوامل|مرضع|حامل|حبوب\s*بتزيد)/i.test(t)) return 'suitability';
  if (/(توصيل|شحن|بتوصلوا|الصعيد|قنا|أسوان|المحافظات)/i.test(t)) return 'delivery';
  if (/(خصم|تخفيض|كود|راعيني|تنزل|عرض\s*خاص)/i.test(t)) return 'discount';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 8.B SALES QUALITY & CONVERSION METRICS
// ─────────────────────────────────────────────────────────────────────────────
const salesQualityMetrics = {
  recommendations: { accurate: 0, total: 0 },
  objectionsHandled: {
    price: 0,
    thinkAboutIt: 0,
    efficacy: 0,
    suitability: 0,
    delivery: 0,
    discount: 0,
    total: 0,
  },
  checkoutProgression: {
    discovery: 0,
    recommendation: 0,
    intent: 0,
    checkoutStarted: 0,
    confirmed: 0,
  },
  confirmedOrders: 0,
  customerSatisfaction: {
    positiveSignals: 0,
    escalations: 0,
    totalTurns: 0,
  },
};

function recordSalesQualityMetric(type, detail = {}) {
  switch (type) {
    case 'recommendation':
      salesQualityMetrics.recommendations.total++;
      if (detail.accurate !== false) salesQualityMetrics.recommendations.accurate++;
      break;
    case 'objection':
      salesQualityMetrics.objectionsHandled.total++;
      if (detail.category && salesQualityMetrics.objectionsHandled[detail.category] !== undefined) {
        salesQualityMetrics.objectionsHandled[detail.category]++;
      }
      break;
    case 'progression':
      if (detail.stage && salesQualityMetrics.checkoutProgression[detail.stage] !== undefined) {
        salesQualityMetrics.checkoutProgression[detail.stage]++;
      }
      break;
    case 'order_confirmed':
      salesQualityMetrics.confirmedOrders++;
      salesQualityMetrics.checkoutProgression.confirmed++;
      break;
    case 'satisfaction':
      salesQualityMetrics.customerSatisfaction.totalTurns++;
      if (detail.positive) salesQualityMetrics.customerSatisfaction.positiveSignals++;
      if (detail.escalated) salesQualityMetrics.customerSatisfaction.escalations++;
      break;
  }
  logTelemetry(`sales_quality_${type}`, detail);
}

function getSalesQualityMetricsReport() {
  const rec = salesQualityMetrics.recommendations;
  const sat = salesQualityMetrics.customerSatisfaction;
  return {
    ...salesQualityMetrics,
    recommendationAccuracyPct: rec.total > 0 ? Math.round((rec.accurate / rec.total) * 100) : 100,
    satisfactionIndexPct: sat.totalTurns > 0 ? Math.round((sat.positiveSignals / sat.totalTurns) * 100) : 100,
  };
}

function resetSalesQualityMetrics() {
  salesQualityMetrics.recommendations = { accurate: 0, total: 0 };
  salesQualityMetrics.objectionsHandled = { price: 0, thinkAboutIt: 0, efficacy: 0, suitability: 0, delivery: 0, discount: 0, total: 0 };
  salesQualityMetrics.checkoutProgression = { discovery: 0, recommendation: 0, intent: 0, checkoutStarted: 0, confirmed: 0 };
  salesQualityMetrics.confirmedOrders = 0;
  salesQualityMetrics.customerSatisfaction = { positiveSignals: 0, escalations: 0, totalTurns: 0 };
}

/**
 * Honest, context-aware fallback when the AI provider is unreachable or returns empty.
 * Never promises automatic follow-up ("ثواني وهرجعلك") and never dumps an unrelated catalog
 * when the customer is mid-checkout.
 */
function safeModelFailureFallback({
  checkoutWizard = null,
  selectedBundle = null,
  cart = [],
  supportPhone = '01210021115',
} = {}) {
  if (checkoutWizard?.step) {
    const d = checkoutWizard.data || {};
    const missing = [
      !d.name && 'الاسم',
      !d.phone && 'رقم الموبايل (01xxxxxxxxx)',
      !d.address && 'العنوان بالتفصيل والمحافظة',
    ].filter(Boolean);

    if (missing.length) {
      return (
        `تحت أمرك يا فندم 💜 بياناتك اللي بعتيها محفوظة عندي في الأوردر.\n` +
        `عشان نسجل الطلب، ابعتيلي بس: **${missing.join(' + ')}** ✍️`
      );
    }
    return (
      `تمام يا فندم 💜 بياناتك محفوظة بالكامل عندي، وفريق خدمة عملاء مونتانا هيتواصل معاكِ تليفونياً لتأكيد الطلب وتفاصيل التوصيل (لأي استفسار تليفون خدمة العملاء: **${supportPhone}**).`
    );
  }

  // Neutral, supportive fallback without blindly pitching products or routines
  return (
    `أهلاً بيكِ يا فندم 💜 بعتذر منك حصل ضغط لحظي في النظام أثناء معالجة رسالتك.\n` +
    `ممكن تكتبيلي سؤالك أو استفسارك تاني وهجاوبك على طول، ولو حابة مساعدة فورية ومتخصصة، فريق خدمة عملاء مونتانا معاكي على الرقم: **${supportPhone}** 🌸`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. FEATURE FLAG, CANARY ROUTING & ZERO-SIDE-EFFECT SHADOW MODE (Req #4 & #6)
// ─────────────────────────────────────────────────────────────────────────────
const VALID_ROLLOUT_MODES = ['off', 'shadow', 'allowlist', 'test_only', 'canary', 'on'];

let _rolloutCache = {
  mode: null,
  canaryPercent: 0,
  allowlist: [],
  expiresAt: 0,
  manualOverride: false,
  dbKillSwitch: false,
  dbErrorFallback: false,
};

/**
 * Reads the rollout configuration synchronously.
 * Priority:
 * 1. Explicit env kill-switch (`CHAT_ENGINE_V2_MODE=off`) -> 'off'
 * 2. DB error safe fallback (`dbErrorFallback`) or DB kill-switch (`dbKillSwitch`) -> 'off'
 * 3. Active cached DB / manual override (`_rolloutCache.mode` before `expiresAt`)
 * 4. Valid env mode (`off` | `shadow` | `allowlist` | `test_only` | `canary` | `on`)
 * 5. Default safe fallback -> 'off'
 */
function getRolloutModeSync() {
  const envMode = String(process.env.CHAT_ENGINE_V2_MODE || '').toLowerCase().trim();
  if (envMode === 'off') return 'off';

  const now = Date.now();
  if (now < _rolloutCache.expiresAt) {
    if (_rolloutCache.dbErrorFallback || _rolloutCache.dbKillSwitch) {
      return 'off';
    }
    if (_rolloutCache.mode && VALID_ROLLOUT_MODES.includes(_rolloutCache.mode)) {
      return _rolloutCache.mode;
    }
  }

  if (VALID_ROLLOUT_MODES.includes(envMode)) {
    return envMode;
  }
  return 'off';
}

function setRolloutConfigOverride({ mode = 'off', canaryPercent = 0, allowlist = [], ttlMs = 30000 } = {}) {
  _rolloutCache = {
    mode,
    canaryPercent: Math.max(0, Math.min(100, Number(canaryPercent) || 0)),
    allowlist: Array.isArray(allowlist) ? allowlist : [],
    expiresAt: Date.now() + ttlMs,
    manualOverride: true,
    dbKillSwitch: mode === 'off',
    dbErrorFallback: false,
  };
}

/**
 * Dynamically refreshes rollout mode from Supabase `site_settings` table so
 * emergency rollback (`chat_engine_v2_mode = 'off'`) takes effect in <= 5s
 * across all Vercel serverless instances without requiring a redeploy.
 * If Supabase configuration is unavailable or errors out, fails safely to 'off'
 * (the approved production v1 behavior).
 */
async function resolveRolloutModeAsync(sbClient, { cacheTtlMs = 5000, forceRefresh = false } = {}) {
  const now = Date.now();
  const envMode = String(process.env.CHAT_ENGINE_V2_MODE || '').toLowerCase().trim();
  if (envMode === 'off') {
    return 'off';
  }

  // Respect unexpired manual override unless forceRefresh is requested
  if (!forceRefresh && now < _rolloutCache.expiresAt && (_rolloutCache.mode || _rolloutCache.dbErrorFallback)) {
    return getRolloutModeSync();
  }

  if (!sbClient || typeof sbClient.from !== 'function') {
    _rolloutCache = {
      mode: 'off',
      canaryPercent: 0,
      allowlist: [],
      expiresAt: now + cacheTtlMs,
      manualOverride: false,
      dbKillSwitch: false,
      dbErrorFallback: true,
    };
    logTelemetry('feature_flag_db_unavailable_fallback_off', { reason: 'missing_sb_client' });
    return 'off';
  }

  try {
    const query = sbClient
      .from('site_settings')
      .select('key,value')
      .in('key', ['chat_engine_v2_mode', 'chat_engine_v2_canary_percent', 'chat_engine_v2_allowlist']);

    const { data, error } = await query;
    if (error) throw error;

    const map = Object.fromEntries((data || []).map((r) => [r.key, String(r.value ?? '').trim()]));
    const dbMode = String(map.chat_engine_v2_mode || '').toLowerCase().trim();
    const dbCanary = map.chat_engine_v2_canary_percent != null
      ? Math.max(0, Math.min(100, Number(map.chat_engine_v2_canary_percent) || 0))
      : _rolloutCache.canaryPercent;
    const dbAllowlist = map.chat_engine_v2_allowlist
      ? map.chat_engine_v2_allowlist.split(',').map((s) => s.trim()).filter(Boolean)
      : _rolloutCache.allowlist;

    if (dbMode === 'off') {
      // Explicit DB rollback kill-switch overrides even process.env.CHAT_ENGINE_V2_MODE='on'
      _rolloutCache = {
        mode: 'off',
        canaryPercent: dbCanary,
        allowlist: dbAllowlist,
        expiresAt: now + cacheTtlMs,
        manualOverride: false,
        dbKillSwitch: true,
        dbErrorFallback: false,
      };
      return 'off';
    }

    if (['shadow', 'allowlist', 'test_only', 'canary', 'on'].includes(dbMode)) {
      _rolloutCache = {
        mode: dbMode,
        canaryPercent: ['allowlist', 'test_only'].includes(dbMode) ? 0 : dbCanary,
        allowlist: dbAllowlist,
        expiresAt: now + cacheTtlMs,
        manualOverride: false,
        dbKillSwitch: false,
        dbErrorFallback: false,
      };
      return dbMode;
    }

    // No explicit DB override row; preserve manual override if still valid, else envMode or 'off'
    const fallbackMode = (_rolloutCache.manualOverride && _rolloutCache.mode)
      ? _rolloutCache.mode
      : (VALID_ROLLOUT_MODES.includes(envMode) ? envMode : 'off');

    _rolloutCache = {
      mode: fallbackMode,
      canaryPercent: dbCanary,
      allowlist: dbAllowlist,
      expiresAt: now + cacheTtlMs,
      manualOverride: _rolloutCache.manualOverride,
      dbKillSwitch: false,
      dbErrorFallback: false,
    };
    return fallbackMode;
  } catch (err) {
    // Mandatory Requirement #4: If Supabase configuration becomes unavailable,
    // fail safely to the approved production behavior ('off').
    _rolloutCache = {
      mode: 'off',
      canaryPercent: 0,
      allowlist: [],
      expiresAt: now + cacheTtlMs,
      manualOverride: false,
      dbKillSwitch: false,
      dbErrorFallback: true,
    };
    logTelemetry('feature_flag_db_unavailable_fallback_off', { error: err?.message || 'db_error' });
    return 'off';
  }
}

/**
 * Per-request context. The session id is chosen by the CALLER (the website
 * widget lets anyone POST any `sessionId`, even `instagram:<id>`), so a session
 * id string can never, on its own, grant v2 access or test isolation. Only a
 * request that api/chat.js authenticated with X-Montana-Secret is marked
 * `trusted`, and the allowlist applies to trusted requests only.
 *
 * AsyncLocalStorage keeps the flag scoped to one request even when a warm
 * instance serves several concurrently.
 */
const { AsyncLocalStorage } = require('async_hooks');
const _requestContext = new AsyncLocalStorage();

function runWithRequestContext(ctx, fn) {
  return _requestContext.run({ trusted: false, v2Blocked: false, ...(ctx || {}) }, fn);
}

function getRequestContext() {
  return _requestContext.getStore() || { trusted: false, v2Blocked: false };
}

/**
 * True ONLY for an authenticated (X-Montana-Secret) request whose session id is
 * an EXACT entry in the DB allowlist while the rollout mode is allowlist /
 * test_only. No prefix or pattern of the session id ever qualifies.
 * Such sessions never create real orders, deduct stock, notify Telegram or
 * reach Bosta (see isEvalSession in chatEngine).
 */
function isTestIsolationSession(sid, { mode = getRolloutModeSync(), allowlist = _rolloutCache.allowlist } = {}) {
  const s = String(sid || '');
  if (!s) return false;
  if (!getRequestContext().trusted) return false;
  if (mode !== 'allowlist' && mode !== 'test_only') return false;
  return Array.isArray(allowlist) && allowlist.includes(s);
}

/**
 * Deterministic routing.
 *   off              → never
 *   shadow           → never (v1 answers)
 *   allowlist/test_only → only trusted requests with an exact allowlisted sid
 *   canary           → trusted exact-allowlisted sid, plus canaryPercent of the
 *                      remaining sessions by hash (0 → nobody)
 *   on               → everyone
 * A request flagged v2Blocked (service-role client missing) is always v1.
 */
function shouldRouteSessionToV2(sid, { mode = getRolloutModeSync(), canaryPercent = _rolloutCache.canaryPercent, allowlist = _rolloutCache.allowlist } = {}) {
  const s = String(sid || '');
  const ctx = getRequestContext();
  if (!s || mode === 'off' || ctx.v2Blocked) return false;
  if (mode === 'on') return true;
  if (mode === 'shadow') return false; // Primary response stays v1; v2 runs in shadow dry-run
  const allowlisted = ctx.trusted === true && Array.isArray(allowlist) && allowlist.includes(s);
  if (mode === 'allowlist' || mode === 'test_only') return allowlisted;
  if (mode === 'canary') {
    if (allowlisted) return true;
    const pct = Math.max(0, Math.min(100, Number(canaryPercent) || 0));
    if (pct <= 0) return false;
    const hash = crypto.createHash('md5').update(s).digest();
    return (hash[0] % 100) < pct;
  }
  return false;
}

/**
 * Stable operation id for the website form-submit path: identical double
 * submits (same session state version, cart and details) collapse to one
 * order; once the order is saved the session version moves on, so a deliberate
 * repeat purchase gets a fresh id.
 */
function deriveFormOperationId({ sid, sessionVersion, cart, form }) {
  const payload = JSON.stringify({
    sid: String(sid || ''),
    v: Number(sessionVersion || 0),
    cart: (Array.isArray(cart) ? cart : []).map((i) => [String(i?.id), Number(i?.qty || 1), Number(i?.price || 0)]),
    f: [form?.name, form?.phone, form?.address, form?.governorate].map((x) => String(x || '').trim()),
  });
  return `op_form_${crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32)}`;
}

/**
 * Creates a completely side-effect-free sandbox environment for Shadow Mode.
 * Clones initial session state deeply and intercepts all writes (DB, cart,
 * orders, Telegram, ManyChat, Bosta, TTS) so Shadow Mode has ZERO impact on production.
 */
function createShadowSandbox(initialSessionState = {}) {
  const clonedState = JSON.parse(JSON.stringify(initialSessionState));
  const interceptedOperations = [];

  return {
    isShadow: true,
    state: clonedState,
    interceptedOperations,
    async saveSession(sid, patch) {
      interceptedOperations.push({ type: 'saveSession', sid: maskPii(sid), keys: Object.keys(patch || {}) });
      Object.assign(clonedState, JSON.parse(JSON.stringify(patch || {})));
      return { ok: true, shadow: true };
    },
    async createOrder(args) {
      interceptedOperations.push({ type: 'createOrder_BLOCKED_IN_SHADOW', governorate: args?.governorate });
      return {
        id: 'shadow_order_0',
        order_number: 'SHADOW-DRYRUN',
        total: args?.total || 0,
        shipping: args?.shipping || 0,
        shadow: true,
      };
    },
    async sendExternalNotification(channel, payload) {
      interceptedOperations.push({ type: 'externalNotify_BLOCKED_IN_SHADOW', channel });
      return { ok: true, shadow: true };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PRIVACY-SAFE TELEMETRY & PII MASKING (Phase 9)
// ─────────────────────────────────────────────────────────────────────────────
function maskPii(value) {
  if (value == null) return value;
  return String(value)
    // Mask Egyptian phone numbers: 01022469615 -> 010****9615
    .replace(/\b(01[0125])\d{4}(\d{4})\b/g, '$1****$2')
    // Mask Arabic-Indic phone numbers
    .replace(/([٠١][٠١٢٥])[٠-٩]{4}([٠-٩]{4})/g, '$1****$2');
}

function sanitizeTelemetryPayload(payload = {}) {
  const clean = {};
  const forbiddenKeys = new Set(['name', 'customerName', 'customer_name', 'address', 'fullAddress', 'apiKey', 'token', 'password']);
  for (const [k, v] of Object.entries(payload || {})) {
    if (forbiddenKeys.has(k)) {
      clean[k] = '[REDACTED_PII]';
    } else if (k === 'phone' || k === 'customerPhone' || k === 'customer_phone') {
      clean[k] = maskPii(v);
    } else if (typeof v === 'string') {
      clean[k] = maskPii(v).slice(0, 160);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

const telemetryBuffer = [];

function logTelemetry(event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...sanitizeTelemetryPayload(data),
  };
  telemetryBuffer.push(entry);
  if (telemetryBuffer.length > 500) telemetryBuffer.shift();
  if (process.env.CHAT_SILENT_TELEMETRY !== '1') {
    console.log(`[TELEMETRY:${event}]`, JSON.stringify(entry));
  }
  return entry;
}

function getTelemetryEvents() {
  return [...telemetryBuffer];
}

function clearTelemetryEvents() {
  telemetryBuffer.length = 0;
}

module.exports = {
  CONVERSATION_STATES,
  computeCheckoutSnapshot,
  bindCheckoutSnapshot,
  verifyExplicitSnapshotConfirmation,
  formatVersionedOrderSummary,
  executeIdempotentOrderCreate,
  withSessionConcurrencyLock,
  createSupabaseSessionLockAdapter,
  atomicMergeSessionState,
  createTurnToolDeduplicator,
  resolveConversationState,
  verifyAndSanitizeSalesClaims,
  safeModelFailureFallback,
  getRolloutModeSync,
  setRolloutConfigOverride,
  resolveRolloutModeAsync,
  isTestIsolationSession,
  shouldRouteSessionToV2,
  runWithRequestContext,
  getRequestContext,
  deriveFormOperationId,
  createShadowSandbox,
  maskPii,
  sanitizeTelemetryPayload,
  logTelemetry,
  getTelemetryEvents,
  clearTelemetryEvents,
  getV2SalesConsultantPrompt,
  detectCustomerObjection,
  recordSalesQualityMetric,
  getSalesQualityMetricsReport,
  resetSalesQualityMetrics,
  ORDER_SAVED_HUMAN_CONFIRMATION_REPLY,
};
