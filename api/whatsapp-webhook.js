// WhatsApp Cloud API webhook — GET handles Meta's verification
// handshake, POST receives inbound messages and replies via the same
// chatbot brain used by the website (lib/chatEngine.js).
const { handleInboundMessage } = require('../lib/chatEngine');
const { sendWhatsAppText } = require('../lib/metaSend');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'montana_whatsapp_secret_2026';
    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    try {
      const change = req.body.entry?.[0]?.changes?.[0]?.value;
      const msg = change?.messages?.[0];
      if (!msg) return res.status(200).send('EVENT_RECEIVED'); // delivery/read receipts — ignore

      const from = msg.from; // wa_id, digits only
      const text = msg.text?.body;
      if (!text) return res.status(200).send('EVENT_RECEIVED'); // non-text message — out of scope for v1

      const sid = `whatsapp:${from}`;
      const payload = await handleInboundMessage({ sid, message: text, channel: 'whatsapp' });
      if (payload?.reply && payload.reply !== 'NONE') {
        await sendWhatsAppText(from, payload.reply);
      }
      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('WhatsApp webhook error:', err.message);
      res.status(200).send('EVENT_RECEIVED'); // always 200 — avoid Meta's retry storm
    }
    return;
  }

  res.status(405).send('Method not allowed');
};
