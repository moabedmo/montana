// Facebook Messenger webhook — GET handles Meta's verification
// handshake, POST receives inbound DMs AND public Page-post / ad
// comments (replied to privately).
// Ad → bundle mapping for Click-to-Messenger ads is owned by ManyChat
// (selectedBundle on POST /api/chat), not messaging_referrals here.
const { handleInboundMessage, pauseBotForSession, resumeBotForSession } = require('../lib/chatEngine');
const { sendPageMessage, sendFacebookCommentPrivateReply } = require('../lib/metaSend');
const {
  isOurBotEcho,
  customerIdFromEcho,
  echoWantsResume,
} = require('../lib/botPause');

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
      const entries = req.body.entry || [];
      for (const entry of entries) {
        const messagingEvents = entry?.messaging || [];
        for (const messaging of messagingEvents) {
          if (messaging?.delivery || messaging?.read) continue;

          if (messaging?.message?.is_echo) {
            const sid = customerIdFromEcho(messaging, 'messenger');
            if (!sid) continue;
            if (isOurBotEcho(messaging, sid)) continue;
            if (echoWantsResume(messaging.message?.text)) {
              await resumeBotForSession(sid, 'messenger');
              console.log('Messenger bot resumed via echo command', sid);
            } else {
              await pauseBotForSession(sid, 'messenger');
              console.log('Messenger bot paused (human echo)', sid);
            }
            continue;
          }

          const senderId = messaging?.sender?.id;
          if (!senderId) continue;
          const text = messaging?.message?.text || messaging?.postback?.title || null;
          const atts = messaging?.message?.attachments || [];
          const hasImage = !!(
            messaging?.message?.sticker_id
            || atts.some((a) => /^(image|story_mention)$/i.test(String(a?.type || '')))
          );
          // Text wins when caption + image; image-only still reaches the bot
          if (!text && !hasImage) continue;

          if (!process.env.MESSENGER_PAGE_TOKEN) {
            console.error('Messenger: MESSENGER_PAGE_TOKEN missing');
            continue;
          }
          const sid = `messenger:${senderId}`;
          console.log('Messenger inbound from', senderId, String(text || (hasImage ? '[image]' : '')).slice(0, 80));
          const payload = await handleInboundMessage({
            sid,
            message: text || null,
            channel: 'messenger',
            hasImage: hasImage && !text,
          });
          if (payload?.reply) {
            await sendPageMessage(
              process.env.MESSENGER_PAGE_TOKEN,
              senderId,
              payload.reply,
              { sid }
            );
            console.log('Messenger reply sent to', senderId);
          }
        }

        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change?.field === 'feed' && change.value?.item === 'comment' && change.value?.verb === 'add') {
            const { comment_id, message: commentText, from } = change.value;
            if (commentText && from?.id && comment_id) {
              const sid = `messenger:${from.id}`;
              const payload = await handleInboundMessage({
                sid,
                message: commentText,
                channel: 'messenger',
              });
              if (payload?.reply) {
                await sendFacebookCommentPrivateReply(
                  process.env.MESSENGER_PAGE_TOKEN,
                  comment_id,
                  payload.reply
                );
              }
            }
          }
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
