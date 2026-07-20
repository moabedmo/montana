const { GoogleGenerativeAI } = require('@google/generative-ai');

const VALID = new Set(['ADD_CONFIRM', 'CHECKOUT_READY', 'SEND_CHECKOUT_LINK', 'CANCEL_MODIFY', 'OTHER']);

async function classifyIntent(message, lastBotMessage, productNames) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { intent: 'OTHER', products: [] };

    const names = Array.isArray(productNames) ? productNames : [];
    const productList = names.join('\n');

    const systemInstruction =
      'You classify Egyptian Arabic customer messages in a cosmetics sales chat.\n\n' +
      'Customers misspell words, drop hamzas, use ه instead of ة, and write casually. Understand intent, not exact spelling.\n\n' +
      `Available products: ${productList}\n\n` +
      'Rules:\n' +
      '- ADD_CONFIRM: the customer has DECIDED they want the product and wants it added to their order. Signals: \'تمام عاوزاهم\', \'اوك عايزه\', \'يريت\', \'زوده\', \'ضيفه\', \'خلاص عايزه\', \'اعمل بيه اوردر\', \'هاخده\'.\n\n' +
      'This is a DECISION, not initial interest. If the customer is merely asking about or requesting information on a product for the first time (\'عايز كريم التفتيح\', \'ممكن الغسول\', \'عندكم كذا؟\'), that is OTHER — they want to hear about it first.\n\n' +
      'The distinction: OTHER = \'tell me about it\'. ADD_CONFIRM = \'I want it, add it\'.\n' +
      '- CHECKOUT_READY: customer wants to finish and pay ("نكمل", "جاهزة", "ابعتي اللينك", "عايزة أطلب").\n' +
      '- SEND_CHECKOUT_LINK: the customer is volunteering their personal/delivery details (name, phone number, address) unprompted in the chat, OR asking how to order / where to send details. The system will offer a choice: send details in chat OR open the website checkout link with their products + loyalty points.\n' +
      '- CANCEL_MODIFY: customer references an EXISTING order they already placed and wants to cancel or change it.\n' +
      '- OTHER: questions, browsing, complaints, greetings.\n\n' +
      'If ADD_CONFIRM but you cannot determine which product, return intent OTHER.\n\n' +
      'Reply with JSON only: {"intent": "...", "products": ["..."]}';

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const prompt =
      `Bot's last message: "${lastBotMessage || 'none'}"\n` +
      `Customer's message: "${message}"`;

    const result = await model.generateContent(prompt);
    const raw = (result.response.text() || '').trim();
    const parsed = JSON.parse(raw);

    const intent = typeof parsed?.intent === 'string' ? parsed.intent.trim().toUpperCase() : '';
    if (!VALID.has(intent)) return { intent: 'OTHER', products: [] };

    const nameSet = new Set(names);
    const products = Array.isArray(parsed.products)
      ? parsed.products.filter((p) => typeof p === 'string' && nameSet.has(p))
      : [];

    if (intent === 'ADD_CONFIRM' && products.length === 0) {
      return { intent: 'OTHER', products: [] };
    }

    return {
      intent,
      products: intent === 'ADD_CONFIRM' ? products : [],
    };
  } catch {
    return { intent: 'OTHER', products: [] };
  }
}

module.exports = { classifyIntent };
