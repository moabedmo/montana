// Instagram webhook — structurally similar to Messenger. GET handles
// Meta's verification handshake, POST receives inbound DMs AND public
// post comments (replied to privately, turning them into a real DM
// conversation), both handled by the same chatbot brain used by the
// website (lib/chatEngine.js). Requires the IG account to be
// subscribed to both the "messages" and "comments" webhook fields in
// Meta's app dashboard.
const { handleInboundMessage } = require('../lib/chatEngine');
const { sendPageMessage, sendInstagramCommentPrivateReply } = require('../lib/metaSend');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    try {
      const messaging = req.body.entry?.[0]?.messaging?.[0];
      const change = req.body.entry?.[0]?.changes?.[0];

      if (messaging?.message?.text && messaging?.sender?.id) {
        // Normal Instagram DM.
        const senderId = messaging.sender.id;
        const sid = `instagram:${senderId}`;
        const payload = await handleInboundMessage({ sid, message: messaging.message.text });
        await sendPageMessage(process.env.INSTAGRAM_PAGE_TOKEN, senderId, payload.reply);
      } else if (change?.field === 'comments' && change.value?.text && change.value?.from?.id) {
        // A public comment on an IG post — reply privately (converts
        // it into a real DM conversation, handled by the same
        // chatEngine as a normal message).
        const { id: commentId, text, from } = change.value;
        const sid = `instagram:${from.id}`;
        const payload = await handleInboundMessage({ sid, message: text });
        await sendInstagramCommentPrivateReply(process.env.INSTAGRAM_PAGE_TOKEN, commentId, payload.reply);
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('Instagram webhook error:', err.message);
      res.status(200).send('EVENT_RECEIVED');
    }
    return;
  }

  res.status(405).send('Method not allowed');
};
