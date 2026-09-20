// Thin Vercel function wrapper — the real logic lives in lib/chatEngine.js.
const { handleInboundMessage, channelOf, getCartForSid, getOrderForSid, getPointsBalance } = require('../lib/chatEngine');
const { handleOwnerAssistant } = require('../lib/ownerAssistant');
const { enforceRateLimit, rateLimit, hasValidApiSecret } = require('../lib/security');
const { extractImageUrl } = require('../lib/imageUnderstanding');
const { claimInbound, releaseInbound, inboundKey } = require('../lib/inboundDedup');

// Trusted external senders (e.g. ManyChat relaying Facebook/Instagram DMs and
// comments to this same bot brain) authenticate via the X-Montana-Secret header
// and get rate-limited per conversation instead of per IP — those platforms'
// outbound requests can share IPs across many unrelated businesses, so an
// IP-keyed limit would risk throttling real customers.

// ManyChat has fired the same inbound twice (two flows on one keyword, or a
// retry): two /api/chat calls ~3s apart, and the customer got the same reply
// twice. Swallow the repeat BEFORE handleInboundMessage runs, so no state is
// advanced either — and answer with the same "send nothing" sentinel the
// botPaused path already uses, which the ManyChat flow understands.
//
// The claim lives in Postgres (lib/inboundDedup.js). It was a Map here, which
// could not see a duplicate that landed on a second lambda instance — and a
// duplicate arriving 3s later, while the first request is still mid model call,
// always does.
//
// Web is excluded on purpose: the site widget renders the reply inline, so
// silence there would look broken.

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let dupKey = null;
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
    const body = req.body || {};
    const {
      message,
      sessionId,
      formSubmit,
      channel,
      getCart,
      getPoints,
      phone,
      selectedBundle,
      selected_bundle,
    } = body;

    // Human takeover: ManyChat owns Messenger, so Meta inbox echoes do NOT
    // reach this server. When an agent opens Live Chat, ManyChat must POST
    // pauseBot:true with the same sessionId. Aliases for easier mapping.
    const pauseBot = !!(
      body.pauseBot ||
      body.pause_bot ||
      body.humanTakeover ||
      body.human_takeover ||
      body.liveChat ||
      body.live_chat
    );
    const resumeBot = !!(
      body.resumeBot ||
      body.resume_bot ||
      body.botResume ||
      body.bot_resume
    );

    // ManyChat ad → bundle key (selectedBundle / selected_bundle). Map the Custom
    // User Field every turn — unresolved {{cuf_*}} or empty = bot cannot know the ad.
    // Also accept ad title text (Meta shows it in Inbox even when CF mapping is broken).
    const bundleKeyRaw = selectedBundle ?? selected_bundle ?? body.offer ?? body.offerKey ?? null;
    const productKeyRaw =
      body.selectedProduct ??
      body.selected_product ??
      body.productSlug ??
      body.product_slug ??
      body.product ??
      null;
    const adTitleRaw =
      body.adTitle ??
      body.ad_title ??
      body.adName ??
      body.ad_name ??
      body.campaign_name ??
      body.facebook_ad_title ??
      null;
    const unresolvedTpl = typeof bundleKeyRaw === 'string' && /^\{\{[^}]+\}\}$/.test(bundleKeyRaw.trim());
    console.log(
      '[chat] selectedBundle=',
      JSON.stringify(bundleKeyRaw),
      'selectedProduct=',
      JSON.stringify(productKeyRaw != null ? String(productKeyRaw).slice(0, 60) : null),
      'adTitle=',
      JSON.stringify(adTitleRaw != null ? String(adTitleRaw).slice(0, 80) : null),
      unresolvedTpl ? '(UNRESOLVED MANYchat TEMPLATE — fix Custom Field mapping)' : '',
      pauseBot ? 'pauseBot=1' : '',
      resumeBot ? 'resumeBot=1' : '',
      'sessionId=',
      String(sessionId || '').slice(0, 48)
    );

    if (body?.getOrder) {
      const sid = String(sessionId || '').slice(0, 64);
      if (!sid) return res.status(400).json({ error: 'sessionId required' });
      enforceRateLimit(req, 'chat-getorder', { windowMs: 60_000, max: 60 });
      const order = await getOrderForSid(sid);
      return res.json({ order });
    }

    if (getCart) {
      const sid = String(sessionId || '').slice(0, 64);
      if (!sid) return res.status(400).json({ error: 'sessionId required' });
      enforceRateLimit(req, 'chat-getcart', { windowMs: 60_000, max: 60 });
      const { cart, subtotal, freeShipping } = await getCartForSid(sid);
      return res.json({ cart, subtotal, freeShipping: !!freeShipping });
    }

    if (getPoints) {
      enforceRateLimit(req, 'chat-getpoints', { windowMs: 60_000, max: 30 });
      const points = await getPointsBalance(phone);
      return res.json({ points: points ?? 0 });
    }

    const hasBundle = bundleKeyRaw != null && String(bundleKeyRaw).trim() !== '' && !unresolvedTpl;
    const hasProduct =
      productKeyRaw != null &&
      String(productKeyRaw).trim() !== '' &&
      !/\{\{/.test(String(productKeyRaw));
    const hasAdTitle = adTitleRaw != null && String(adTitleRaw).trim() !== '' && !/\{\{/.test(String(adTitleRaw));
    // ManyChat / webhooks: customer sent a photo (often empty last_input_text)
    const flagOn = (v) => {
      if (v === true || v === 1) return true;
      if (typeof v === 'string') return /^(1|true|yes|image|photo|sticker)$/i.test(v.trim()) || /^https?:\/\//i.test(v.trim());
      return false;
    };
    const hasImage = !!(
      flagOn(body.hasImage) ||
      flagOn(body.has_image) ||
      flagOn(body.isImage) ||
      flagOn(body.is_image) ||
      flagOn(body.photo) ||
      flagOn(body.image) ||
      (Array.isArray(body.attachments) && body.attachments.some((a) => /image|photo|sticker/i.test(String(a?.type || a || ''))))
      || (typeof body.attachment_type === 'string' && /image|photo|sticker/i.test(body.attachment_type))
      || (typeof body.type === 'string' && /^(image|photo|sticker)$/i.test(body.type))
    );
    // The URL, not just the fact that a photo arrived. Without it the engine
    // can only answer every photo with the same canned pitch.
    const imageUrl = extractImageUrl(body);
    if (!message && !formSubmit && !hasBundle && !hasProduct && !hasAdTitle && !pauseBot && !resumeBot && !hasImage && !imageUrl) {
      return res.status(400).json({ error: 'message required' });
    }
    if (message && String(message).length > 2000) {
      return res.status(400).json({ error: 'message too long' });
    }
    const sid = String(sessionId || 'default').slice(0, 64);
    const channelHint = ['messenger', 'instagram'].includes(channel) ? channel : undefined;
    if (trusted) {
      rateLimit(`chat:external:${sid}`, { windowMs: 60_000, max: 40 });
    } else {
      enforceRateLimit(req, 'chat', { windowMs: 60_000, max: 40 });
    }

    if (pauseBot) {
      console.warn('[chat] human takeover pauseBot', sid);
    }

    // Repeat of the same text on a ManyChat-driven channel → send nothing.
    // Cleared again in the catch below, so a retry after a real failure still
    // gets answered instead of being silently swallowed.
    dupKey = message && channelOf(sid) !== 'web' ? inboundKey(sid, message) : null;
    if (dupKey && !(await claimInbound(dupKey))) {
      console.warn('[chat] duplicate inbound swallowed', sid, String(message).slice(0, 60));
      return res.json({
        sessionId: sid,
        reply: '',
        reply1: 'NONE',
        reply2: 'NONE',
        reply3: 'NONE',
        duplicate: true,
      });
    }

    const payload = await handleInboundMessage({
      sid,
      message,
      formSubmit,
      channel: channelHint,
      selectedBundle: hasBundle ? String(bundleKeyRaw).trim() : null,
      selectedProduct: hasProduct ? String(productKeyRaw).trim() : null,
      adTitle: hasAdTitle ? String(adTitleRaw).trim() : null,
      pauseBot,
      resumeBot,
      hasImage: hasImage || !!imageUrl,
      imageUrl,
    });
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
      let parts;
      const reply = String(payload.reply).trim();
      // Prefer one bubble for short replies — multi-bubble walls feel robotic.
      if (reply.length <= 380) {
        parts = [reply];
      } else {
        parts = reply.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
        if (parts.length === 1 && reply.length > 380) {
          // Hard split long single paragraphs
          parts = [];
          let rest = reply;
          while (rest.length > 380 && parts.length < 2) {
            let cut = rest.lastIndexOf(' ', 380);
            if (cut < 120) cut = 380;
            parts.push(rest.slice(0, cut).trim());
            rest = rest.slice(cut).trim();
          }
          if (rest) parts.push(rest);
        }
        parts = parts.slice(0, 3);
      }
      payload.reply1 = parts[0] || 'NONE';
      payload.reply2 = parts[1] || 'NONE';
      payload.reply3 = parts[2] || 'NONE';
    } else if (payload?.botPaused) {
      payload.reply = '';
      payload.reply1 = 'NONE';
      payload.reply2 = 'NONE';
      payload.reply3 = 'NONE';
    }
    return res.json(payload);
  } catch (err) {
    // This turn produced no answer, so don't let its key mute ManyChat's retry.
    if (dupKey) await releaseInbound(dupKey);
    const status = err.status || 500;
    console.error('chat:', err.message);
    return res.status(status).json({ error: err.message || 'Chat failed' });
  }
};
