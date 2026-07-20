// Thin Vercel function wrapper — the real logic lives in lib/chatEngine.js.
const { handleInboundMessage, channelOf, getCartForSid, getOrderForSid, getPointsBalance } = require('../lib/chatEngine');
const { handleOwnerAssistant } = require('../lib/ownerAssistant');
const { enforceRateLimit, rateLimit, hasValidApiSecret } = require('../lib/security');

// Trusted external senders (e.g. ManyChat relaying Facebook/Instagram DMs and
// comments to this same bot brain) authenticate via the X-Montana-Secret header
// and get rate-limited per conversation instead of per IP — those platforms'
// outbound requests can share IPs across many unrelated businesses, so an
// IP-keyed limit would risk throttling real customers.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    // Owner dashboard assistant (Mohamed Abed) — same /api/chat function to
    // stay within Vercel Hobby serverless function limits.
    if (req.body?.owner_assistant) {
      enforceRateLimit(req, 'owner-assistant', { windowMs: 60_000, max: 30 });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      const { message, history } = req.body || {};
      const result = await handleOwnerAssistant({
        accessToken: token,
        message,
        history: Array.isArray(history) ? history.slice(-20) : [],
      });
      return res.json({ ok: true, ...result });
    }

    const trusted = hasValidApiSecret(req);
    const { message, sessionId, formSubmit, channel, getCart, getPoints, phone } = req.body || {};

    if (req.body?.getOrder) {
      const sid = String(sessionId || '').slice(0, 64);
      if (!sid) return res.status(400).json({ error: 'sessionId required' });
      enforceRateLimit(req, 'chat-getorder', { windowMs: 60_000, max: 60 });
      const order = await getOrderForSid(sid);
      return res.json({ order });
    }

    // Lightweight read used by complete-order.html to show the customer's
    // real cart when she arrives via a checkout link from a non-web channel
    // — no model turn, just the persisted cart for this sid.
    if (getCart) {
      const sid = String(sessionId || '').slice(0, 64);
      if (!sid) return res.status(400).json({ error: 'sessionId required' });
      enforceRateLimit(req, 'chat-getcart', { windowMs: 60_000, max: 60 });
      const { cart, subtotal } = await getCartForSid(sid);
      return res.json({ cart, subtotal });
    }

    // Lightweight read used by complete-order.html to show the loyalty
    // points balance for whatever phone number the customer has typed so
    // far into the form.
    if (getPoints) {
      enforceRateLimit(req, 'chat-getpoints', { windowMs: 60_000, max: 30 });
      const points = await getPointsBalance(phone);
      return res.json({ points: points ?? 0 });
    }

    if (!message && !formSubmit) {
      return res.status(400).json({ error: 'message required' });
    }
    if (message && String(message).length > 2000) {
      return res.status(400).json({ error: 'message too long' });
    }
    const sid = String(sessionId || 'default').slice(0, 64);
    const safeChannel = ['messenger', 'instagram'].includes(channel) ? channel : undefined;
    if (trusted) {
      rateLimit(`chat:external:${sid}`, { windowMs: 60_000, max: 40 });
    } else {
      enforceRateLimit(req, 'chat', { windowMs: 60_000, max: 40 });
    }
    const payload = await handleInboundMessage({ sid, message, formSubmit, channel: safeChannel });
    // ManyChat (messenger/instagram) can't split a single field into
    // multiple bubbles itself — its "Send Message" steps each need their
    // own variable. Split the reply into up to 3 parts here so the
    // ManyChat flow can send them as separate messages; reply1 always
    // holds the first (or only) part so it still works if nothing maps
    // reply2/reply3.
    if (payload?.reply) {
      // Facebook/Instagram/WhatsApp render Send Message text as plain text —
      // unlike chat-widget.js's formatReply(), they don't turn **bold** into
      // real bold, so the asterisks would show up literally to the customer.
      // The website widget still gets the raw markdown (it renders it).
      if (channelOf(sid) !== 'web') {
        payload.reply = payload.reply.replace(/\*\*(.*?)\*\*/g, '$1');
      }
      // "NONE" instead of "" — ManyChat's "has any value" condition treated
      // an empty string inconsistently (a real customer got the literal
      // unresolved "{{Bot Reply 2}}" text sent to them once the field was
      // empty). An explicit sentinel the Condition step can string-match
      // against ("isn't NONE") removes that ambiguity entirely.
      let parts = String(payload.reply).split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
      // Fallback: chatEngine.js's sanitizeReply() already normalizes the
      // known bullet-list case into blank-line-separated paragraphs, but if
      // the model returns one long block some other way (no blank lines at
      // all), force a split on single newlines instead of leaving the
      // customer with one giant unreadable bubble.
      if (parts.length === 1 && parts[0].length > 500) {
        const lines = parts[0].split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) parts = lines;
      }
      payload.reply1 = parts[0] || payload.reply;
      payload.reply2 = parts.length > 1 ? parts[1] : 'NONE';
      payload.reply3 = parts.length > 2 ? parts.slice(2).join('\n\n') : 'NONE';
    }
    res.json(payload);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    if (error.status === 401) return res.status(401).json({ ok: false, error: error.message || 'Unauthorized' });
    if (error.status === 403) return res.status(403).json({ ok: false, error: error.message || 'Forbidden' });
    if (error.status === 429) return res.status(429).json({ error: 'Too many requests' });
    if (error.status === 503) return res.status(503).json({ ok: false, error: error.message || 'Unavailable' });
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'حصل مشكلة، حاول تاني' });
  }
};
