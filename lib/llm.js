/**
 * LLM layer — Claude primary (sales feel + intent), Gemini fallback.
 * Money/orders/prices stay in code; this module only classifies or narrates.
 */
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function hasClaude() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function hasGemini() {
  return !!process.env.GEMINI_API_KEY;
}

function getAnthropic() {
  if (!hasClaude()) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getGemini() {
  if (!hasGemini()) return null;
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/**
 * JSON-only classification / extraction.
 * @returns {Promise<object|null>}
 */
async function completeJson({ system, user, maxTokens = 600 }) {
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: 0,
        system: `${system}\n\nReply with valid JSON only. No markdown.`,
        messages: [{ role: 'user', content: user }],
      });
      const text = (res.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleaned);
    } catch (e) {
      console.warn('[llm] Claude JSON failed, trying Gemini:', e.message);
    }
  }

  const genAI = getGemini();
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });
    const result = await model.generateContent(user);
    const raw = (result.response.text() || '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[llm] Gemini JSON failed:', e.message);
    return null;
  }
}

/**
 * Plain sales narration (no tools). Facts must already be in the prompt.
 */
async function completeText({ system, user, maxTokens = 500 }) {
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const res = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: user }],
      });
      return (res.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
    } catch (e) {
      console.warn('[llm] Claude text failed, trying Gemini:', e.message);
    }
  }

  const genAI = getGemini();
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: system,
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.4 },
    });
    const result = await model.generateContent(user);
    return (result.response.text() || '').trim();
  } catch (e) {
    console.warn('[llm] Gemini text failed:', e.message);
    return null;
  }
}

module.exports = {
  completeJson,
  completeText,
  hasClaude,
  hasGemini,
  CLAUDE_MODEL,
  GEMINI_MODEL,
};
