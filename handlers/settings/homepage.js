'use strict';

const { getHomepageContent, saveHomepageContent, getDefaultHomepageContent } = require('../../lib/homepage-content');
const { setCors, sendJson, readJsonBody, checkAdmin } = require('../../lib/http');

async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      var data = await getHomepageContent();
      sendJson(res, 200, {
        ok: true,
        content: data.content,
        source: data.source,
        updated_at: data.updated_at || null,
        defaults_available: true
      });
      return;
    }

    if (req.method === 'POST') {
      var body = await readJsonBody(req);
      if (!checkAdmin(req, body)) {
        sendJson(res, 401, { ok: false, error: 'Unauthorized — API Admin Key مطلوب' });
        return;
      }

      if (body.action === 'reset') {
        body.content = getDefaultHomepageContent();
      }

      if (!body.content) {
        sendJson(res, 400, { ok: false, error: 'content مطلوب' });
        return;
      }

      var saved = await saveHomepageContent(body.content);
      if (!saved.ok) {
        sendJson(res, 500, { ok: false, error: saved.error });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        message: body.action === 'reset' ? 'تم استعادة النصوص الافتراضية' : 'تم حفظ محتوى الصفحة الرئيسية',
        content: saved.content,
        updated_at: saved.updated_at
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/settings/homepage]', err);
    var msg = err.message || 'Internal server error';
    if (/SUPABASE_URL|must be set/i.test(msg)) {
      sendJson(res, 503, { ok: false, error: 'Supabase غير مربوط — شغّلي migration 004 وضيفي SUPABASE_URL على Vercel' });
      return;
    }
    sendJson(res, 500, { ok: false, error: msg });
  }
}

module.exports = handler;
