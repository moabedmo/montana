const { GoogleGenerativeAI } = require('@google/generative-ai');

const VALID = new Set(['ADD_CONFIRM', 'CHECKOUT_READY', 'CANCEL_MODIFY', 'OTHER']);

const SYSTEM_INSTRUCTION =
  'You classify Egyptian Arabic customer messages in a cosmetics sales chat. Customers often misspell words, drop hamzas, use ه instead of ة, and write casually. Understand intent, not exact spelling. Reply with EXACTLY ONE WORD from: ADD_CONFIRM, CHECKOUT_READY, CANCEL_MODIFY, OTHER. Nothing else.';

async function classifyIntent(message, lastBotMessage) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return 'OTHER';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: 200, temperature: 0 },
    });

    const prompt =
      `Bot's last message: "${lastBotMessage || 'none'}"\n` +
      `Customer's message: "${message}"\n\n` +
      'Intent:';

    const result = await model.generateContent(prompt);
    const intent = (result.response.text() || '').trim().toUpperCase();
    return VALID.has(intent) ? intent : 'OTHER';
  } catch {
    return 'OTHER';
  }
}

module.exports = { classifyIntent };