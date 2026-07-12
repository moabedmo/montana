// Facebook Messenger webhook — GET handles Meta's verification
// handshake, POST receives inbound DMs AND public Page-post comments
// (replied to privately, turning them into a real DM conversation),
// both handled by the same chatbot brain used by the website
// (lib/chatEngine.js). Requires the Page to be subscribed to both the
// "messages" and "feed" webhook fields in Meta's app dashboard.
const { handleInboundMessage } = require('../lib/chatEngine');
const { sendPageMessage, sendFacebookCommentPrivateReply } = require('../lib/metaSend');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  if (req.method === 'POST') {
    try {
      const messaging = req.body.entry?.[0]?.messaging?.[0];
      const change = req.body.entry?.[0]?.changes?.[0];

      if (messaging?.message?.text && messaging?.sender?.id) {
        // Normal Messenger DM.
        const senderId = messaging.sender.id;
        const sid = `messenger:${senderId}`;
        const payload = await handleInboundMessage({ sid, message: messaging.message.text });
        await sendPageMessage(process.env.MESSENGER_PAGE_TOKEN, senderId, payload.reply);
      } else if (change?.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add') {
        // A public comment on a Page post — reply privately (converts
        // it into a real Messenger conversation with the commenter,
        // handled by the exact same chatEngine as a normal DM).
        const { comment_id, message: commentText, from } = change.value;
        if (commentText && from?.id) {
          const sid = `messenger:${from.id}`;
          const payload = await handleInboundMessage({ sid, message: commentText });
          await sendFacebookCommentPrivateReply(process.env.MESSENGER_PAGE_TOKEN, comment_id, payload.reply);
        }
      }

      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('Messenger webhook error:', err.message);
      res.status(200).send('EVENT_RECEIVED');
    }
    return;
  }

  res.status(405).send('Method not allowed');
};
