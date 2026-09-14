// Instagram webhook — GET verification, POST inbound DMs + comments.
// Ad → bundle mapping for Click-to-Direct ads is owned by ManyChat
// (selectedBundle on POST /api/chat), not messaging_referrals here.
// message_echoes: when a human agent replies from the IG inbox, pause the bot.
const { handleInboundMessage, pauseBotForSession, resumeBotForSession } = require('../lib/chatEngine');
const { sendPageMessage, sendInstagramCommentPrivateReply } = require('../lib/metaSend');
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
    if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
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
            const sid = customerIdFromEcho(messaging, 'instagram');
            if (!sid) continue;
            if (isOurBotEcho(messaging, sid)) continue;
            if (echoWantsResume(messaging.message?.text)) {
              await resumeBotForSession(sid, 'instagram');
              console.log('Instagram bot resumed via echo command', sid);
            } else {
              await pauseBotForSession(sid, 'instagram');
              console.log('Instagram bot paused (human echo)', sid);
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
          // Meta hands us the attachment URL here; pass it on so the engine can
          // actually look at the photo instead of only knowing one arrived.
          const imageUrl = atts
            .filter((a) => /^image$/i.test(String(a?.type || '')))
            .map((a) => a?.payload?.url)
            .find((u) => typeof u === 'string' && /^https:\/\//i.test(u)) || null;
          if (!text && !hasImage) continue;

          if (!process.env.INSTAGRAM_PAGE_TOKEN) {
            console.error('Instagram: INSTAGRAM_PAGE_TOKEN missing');
            continue;
          }
          const sid = `instagram:${senderId}`;
          console.log('Instagram inbound from', senderId, String(text || (hasImage ? '[image]' : '')).slice(0, 80));
          const payload = await handleInboundMessage({
            sid,
            message: text || null,
            channel: 'instagram',
            hasImage: hasImage && !text,
            imageUrl,
          });
          if (payload?.reply) {
            await sendPageMessage(
              process.env.INSTAGRAM_PAGE_TOKEN,
              senderId,
              payload.reply,
              { sid }
            );
          }
        }

        const changes = entry?.changes || [];
        for (const change of changes) {
          if (change?.field === 'comments' && change.value?.text && change.value?.from?.id) {
            const { id: commentId, text, from } = change.value;
            const sid = `instagram:${from.id}`;
            const payload = await handleInboundMessage({
              sid,
              message: text,
              channel: 'instagram',
            });
            if (payload?.reply) {
              await sendInstagramCommentPrivateReply(
                process.env.INSTAGRAM_PAGE_TOKEN,
                commentId,
                payload.reply
              );
            }
          }
        }
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
