// Returns which integrations are configured (booleans only — no secrets).
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  res.json({
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    paymob: !!(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID && process.env.PAYMOB_IFRAME_ID),
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    messenger: !!process.env.MESSENGER_PAGE_TOKEN,
    instagram: !!process.env.INSTAGRAM_PAGE_TOKEN,
    gemini: !!process.env.GEMINI_API_KEY
  });
};
