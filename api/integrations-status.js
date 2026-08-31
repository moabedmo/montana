// Returns which integrations are configured (booleans only — no secrets).
// Also hosts Meta Pixel public config (GET) + Conversions API (POST) +
// customer-by-phone lookup via ?action=… + owner company docs (Hobby 12-function limit).
const {
  getPublicPixelId,
  handleMetaPublicConfig,
  handleMetaCapi,
} = require('../lib/metaCapi');
const { handleCustomerByPhone } = require('../lib/customerLookup');
const {
  assertOwner,
  listDocuments,
  uploadDocument,
  prepareUpload,
  confirmUpload,
  signedDownload,
  deleteDocument,
  getCompanyLinks,
  saveCompanyLinks,
  getStockistPharmacies,
  saveStockistPharmacies,
  upsertStockistPharmacy,
  deleteStockistPharmacy,
} = require('../lib/ownerCompanyDocs');

function bearer(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

async function handleOwnerCompanyDocs(req, res) {
  try {
    const { userId } = await assertOwner(bearer(req));
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const action = String(
      url.searchParams.get('docsAction') ||
      req.body?.docsAction ||
      req.body?.action ||
      url.searchParams.get('sub') ||
      'list'
    ).toLowerCase();

    if (req.method === 'GET' && (action === 'list' || action === 'owner-company-docs')) {
      const docs = await listDocuments();
      return res.json({ ok: true, docs });
    }
    if (req.method === 'GET' && (action === 'links' || action === 'links-get')) {
      const links = await getCompanyLinks();
      return res.json({ ok: true, links });
    }
    if (req.method === 'POST' && (action === 'links' || action === 'links-save')) {
      const links = await saveCompanyLinks(req.body?.links || req.body, userId);
      return res.json({ ok: true, links });
    }
    if (req.method === 'GET' && (action === 'pharmacies' || action === 'stockists' || action === 'pharmacies-list')) {
      const pharmacies = await getStockistPharmacies({ force: true });
      return res.json({ ok: true, pharmacies });
    }
    if (req.method === 'POST' && (action === 'pharmacies-save' || action === 'stockists-save')) {
      const pharmacies = await saveStockistPharmacies(req.body?.pharmacies || [], userId);
      return res.json({ ok: true, pharmacies });
    }
    if (req.method === 'POST' && (action === 'pharmacies-upsert' || action === 'stockists-upsert')) {
      const pharmacies = await upsertStockistPharmacy(req.body?.pharmacy || req.body, userId);
      return res.json({ ok: true, pharmacies });
    }
    if (
      (req.method === 'DELETE' || req.method === 'POST') &&
      (action === 'pharmacies-delete' || action === 'stockists-delete')
    ) {
      const id = url.searchParams.get('id') || req.body?.id;
      const pharmacies = await deleteStockistPharmacy(id, userId);
      return res.json({ ok: true, pharmacies });
    }
    if (req.method === 'GET' && action === 'url') {
      const id = url.searchParams.get('id') || req.body?.id;
      const download = String(url.searchParams.get('download') || '') === '1';
      const { url: signed, doc } = await signedDownload(id, download);
      return res.json({ ok: true, url: signed, doc });
    }
    if (req.method === 'POST' && action === 'upload') {
      const body = req.body || {};
      const doc = await uploadDocument({
        title: body.title,
        category: body.category,
        notes: body.notes,
        fileName: body.fileName || body.file_name,
        mimeType: body.mimeType || body.mime_type,
        fileBase64: body.fileBase64 || body.file_base64,
        userId,
      });
      return res.json({ ok: true, doc });
    }
    if (req.method === 'POST' && action === 'prepare') {
      const body = req.body || {};
      const prepared = await prepareUpload({
        title: body.title,
        category: body.category,
        notes: body.notes,
        fileName: body.fileName || body.file_name,
        mimeType: body.mimeType || body.mime_type,
        fileSize: body.fileSize || body.file_size,
        userId,
      });
      return res.json({ ok: true, ...prepared });
    }
    if (req.method === 'POST' && action === 'confirm') {
      const meta = req.body?.meta || req.body;
      const doc = await confirmUpload(meta);
      return res.json({ ok: true, doc });
    }
    if (
      (req.method === 'DELETE' || req.method === 'POST') &&
      (action === 'delete' || action === 'remove')
    ) {
      const id = url.searchParams.get('id') || req.body?.id;
      await deleteDocument(id);
      return res.json({ ok: true });
    }
    if (req.method === 'GET') {
      const docs = await listDocuments();
      return res.json({ ok: true, docs });
    }
    return res.status(400).json({ ok: false, error: 'Unknown docs action' });
  } catch (e) {
    console.error('[owner-company-docs]', e);
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
  }
}

module.exports = async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action') || '';

  if (action === 'meta-public-config') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'GET or POST only' });
    }
    return handleMetaPublicConfig(req, res);
  }

  if (action === 'meta-capi') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
    return handleMetaCapi(req, res);
  }

  if (action === 'customer-by-phone') {
    return handleCustomerByPhone(req, res);
  }

  if (action === 'owner-company-docs') {
    return handleOwnerCompanyDocs(req, res);
  }

  // Owner-authenticated product stock update
  if (action === 'set-product-stock') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    try {
      await assertOwner(bearer(req));
      const { createClient } = require('@supabase/supabase-js');
      const service = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (!service) return res.status(503).json({ ok: false, error: 'SERVICE_ROLE missing' });
      const admin = createClient('https://ikryeyqrithikabwidov.supabase.co', service);
      const stockMap = (req.body && req.body.stock && typeof req.body.stock === 'object')
        ? req.body.stock
        : null;
      if (!stockMap) return res.status(400).json({ ok: false, error: 'stock map required' });
      const updated = [];
      for (const [slug, stock] of Object.entries(stockMap)) {
        const n = Number(stock);
        if (!slug || !Number.isFinite(n) || n < 0) continue;
        const { data, error } = await admin
          .from('products')
          .update({ stock: Math.round(n) })
          .eq('slug', slug)
          .select('slug,name,stock')
          .maybeSingle();
        if (error) throw error;
        if (data) updated.push(data);
      }
      return res.json({ ok: true, updated });
    } catch (e) {
      console.error('[set-product-stock]', e);
      return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
    }
  }

  // Jumia OAuth (web app) — start + callback for refresh token
  if (
    action === 'jumia-oauth-start' ||
    action === 'jumia-oauth-callback' ||
    action === 'jumia-oauth' ||
    action === 'jumia-token-test'
  ) {
    const {
      buildAuthorizeUrl,
      exchangeAuthorizationCode,
      jumiaCreds,
      requestClientCredentialsToken,
      htmlPage,
      REDIRECT_URI,
    } = require('../lib/jumiaAuth');

    const wantsHtml = String(req.headers.accept || '').includes('text/html') || action === 'jumia-oauth-callback';

    try {
      if (action === 'jumia-token-test') {
        const probed = await requestClientCredentialsToken();
        if (wantsHtml) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          if (probed.ok) {
            const t = probed.token || {};
            return res.send(htmlPage(
              'Jumia Token Test',
              `<h1 class="ok">التوكن اشتغل ✓</h1>
               <p>الطريقة: <code style="min-height:auto;display:inline;padding:4px 8px">${probed.method}</code></p>
               <p>expires_in: ${t.expires_in || '—'} · في Refresh Token؟ ${t.refresh_token ? 'نعم' : 'لا'}</p>
               ${t.refresh_token ? `<p>Refresh Token (انسخه لـ Vercel: JUMIA_REFRESH_TOKEN)</p><textarea readonly onclick="this.select()">${t.refresh_token}</textarea>` : '<p>مفيش refresh_token — هنستخدم access token المتجدّد بـ client_credentials.</p>'}
               <p>Access Token (قصير):</p>
               <textarea readonly onclick="this.select()">${t.access_token || ''}</textarea>`
            ));
          }
          const meta = probed.meta || {};
          const rows = (probed.results || [])
            .map((r) => `<li><strong>${r.label}</strong>: HTTP ${r.status} — ${r.error || ''} ${r.error_description || ''}</li>`)
            .join('');
          return res.status(400).send(htmlPage(
            'Jumia Token Test',
            `<h1 class="err">مقدرناش نطلع توكن بـ ID+Secret</h1>
             <p>جوميا قالت المطلوب ID + Secret بس — والسيرفر بيرجع <code style="min-height:auto;display:inline;padding:4px 8px">invalid_client</code> وده عادة يعني الـ Secret مش مطابق لـ ID.</p>
             <ul style="line-height:1.8">${rows}</ul>
             <p>التشخيص (من غير كشف الـ Secret):</p>
             <ul style="line-height:1.8">
               <li>Client ID يبدأ بـ: <code style="min-height:auto;display:inline;padding:4px 8px">${meta.client_id_prefix || '—'}…</code> (طول ${meta.client_id_len || 0})</li>
               <li>Secret طول: <strong>${meta.client_secret_len || 0}</strong> · آخر 4: <code style="min-height:auto;display:inline;padding:4px 8px">${meta.client_secret_suffix || '—'}</code></li>
             </ul>
             <p>ارجع لأيقونة القفل في تطبيق <strong>montana</strong> وانسخ الـ Secret من جديد كامل، والصقه في Vercel في <code style="min-height:auto;display:inline;padding:4px 8px">JUMIA_CLIENT_SECRET</code> على Production.</p>`
          ));
        }
        return res.status(probed.ok ? 200 : 400).json({
          ok: probed.ok,
          method: probed.method || null,
          has_access_token: !!probed.token?.access_token,
          has_refresh_token: !!probed.token?.refresh_token,
          results: probed.results,
          meta: probed.meta || null,
        });
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const code = url.searchParams.get('code');
      const errQ = url.searchParams.get('error');
      const errDesc = url.searchParams.get('error_description');

      if (errQ) {
        const msg = errDesc || errQ;
        if (wantsHtml) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.status(400).send(htmlPage('Jumia OAuth', `<h1 class="err">فشل التفويض</h1><p>${msg}</p>`));
        }
        return res.status(400).json({ ok: false, error: msg });
      }

      if (code || action === 'jumia-oauth-callback') {
        if (!code) {
          // Landing without code: Jumia has no public authorize URL — guide in-UI flow.
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(htmlPage(
            'Jumia OAuth',
            `<h1>ربط جوميا بمونتانيا</h1>
             <p>في شاشة جوميا غالبًا <strong>مفيش زر تفويض</strong> ظاهر للبائع.</p>
             <p>جرّب الاختبار المباشر (ID + Secret من غير زر):</p>
             <a class="btn" href="/api/integrations-status?action=jumia-token-test">اختبار توكن جوميا الآن</a>
             <p style="margin-top:18px">Redirect المسجّل (لو جوميا رجّعت code لاحقًا):</p>
             <code>${REDIRECT_URI}</code>
             <p style="font-size:13px;color:#666;margin-top:14px">Client ID في Vercel:
               ${jumiaCreds().clientId ? jumiaCreds().clientId.slice(0, 8) + '…' : '<span class="err">مش موجود</span>'}
               · Secret: ${jumiaCreds().clientSecret ? 'موجود' : '<span class="err">مش موجود</span>'}
             </p>`
          ));
        }
        const tokens = await exchangeAuthorizationCode(code);
        const refresh = tokens.refresh_token || '';
        const access = tokens.access_token || '';
        if (wantsHtml) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(htmlPage(
            'Jumia Token',
            `<h1 class="ok">تم التفويض ✓</h1>
             <p>انسخ <strong>Refresh Token</strong> وحطه في Vercel باسم <code style="min-height:auto;display:inline;padding:4px 8px">JUMIA_REFRESH_TOKEN</code> ثم احذف هذه الصفحة من التاريخ.</p>
             <p>Refresh Token:</p>
             <textarea readonly onclick="this.select()">${refresh || '(لم يُرجع refresh_token — ابعت سكرين لـ JSON)'}</textarea>
             <p style="margin-top:16px">Access Token (قصير العمر — مش محتاج تحفظه):</p>
             <textarea readonly onclick="this.select()">${access || ''}</textarea>
             <p style="font-size:13px;color:#666">expires_in: ${tokens.expires_in || '—'} · token_type: ${tokens.token_type || '—'}</p>
             <a class="btn" href="/owner.html">رجوع للوحة المالك</a>`
          ));
        }
        return res.json({
          ok: true,
          has_refresh_token: !!refresh,
          expires_in: tokens.expires_in || null,
          token_type: tokens.token_type || null,
          refresh_token: url.searchParams.get('reveal') === '1' ? refresh : undefined,
        });
      }

      // start
      const creds = jumiaCreds();
      if (creds.authUrl) {
        const auth = buildAuthorizeUrl('montana');
        if (wantsHtml || url.searchParams.get('redirect') === '1') {
          res.writeHead(302, { Location: auth });
          return res.end();
        }
        return res.json({
          ok: true,
          authorize_url: auth,
          redirect_uri: creds.redirectUri,
          has_client_id: !!creds.clientId,
          has_client_secret: !!creds.clientSecret,
        });
      }

      // Default: Jumia has no public authorize route — guide + token test.
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(htmlPage(
        'Jumia OAuth',
        `<h1>تفويض جوميا</h1>
         <p>مفيش زر تفويض في واجهة جوميا عند معظم الحسابات — جرّب الاختبار المباشر:</p>
         <a class="btn" href="/api/integrations-status?action=jumia-token-test">اختبار توكن جوميا الآن</a>
         <p style="margin-top:16px;font-size:13px;color:#666">Client ID: ${(creds.clientId || '').slice(0, 8) || '—'}… · Secret: ${creds.clientSecret ? 'موجود' : 'مش موجود'}</p>`
      ));
    } catch (e) {
      console.error('[jumia-oauth]', e);
      if (wantsHtml) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(e.status || 500).send(htmlPage(
          'Jumia OAuth Error',
          `<h1 class="err">حصل خطأ</h1><p>${e.message || 'error'}</p>
           <p>تأكد إن Client ID/Secret في Vercel هم بتوع <strong>montana2</strong> أو <strong>montana</strong> (التفويض الذاتي)، والـ Redirect URI مطابق تمامًا لو استخدمت تطبيق ويب.</p>
           <a class="btn" href="/api/integrations-status?action=jumia-token-test">اختبار التوكن</a>`
        ));
      }
      return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
    }
  }

  // Jumia orders (owner + store admin)
  if (action === 'jumia-orders' || action === 'jumia-shops') {
    try {
      const {
        assertJumiaViewer,
        listJumiaOrders,
        listJumiaShops,
        getJumiaOrderItems,
      } = require('../lib/jumiaClient');
      await assertJumiaViewer(bearer(req));
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (action === 'jumia-shops') {
        const shops = await listJumiaShops();
        return res.json({ ok: true, shops });
      }

      const days = Number(url.searchParams.get('days') || req.body?.days || 30);
      const size = Number(url.searchParams.get('size') || req.body?.size || 50);
      const status = url.searchParams.get('status') || req.body?.status || '';
      const country = url.searchParams.get('country') || req.body?.country || '';
      const shopId = url.searchParams.get('shop_id') || req.body?.shop_id || '';
      const token = url.searchParams.get('token') || req.body?.token || '';
      const withItems = String(url.searchParams.get('items') || '') === '1';

      const result = await listJumiaOrders({ days, size, status, country, shopId, token });
      if (withItems && result.orders.length) {
        try {
          const ids = result.orders.map((o) => o.id).slice(0, 20);
          const items = await getJumiaOrderItems(ids);
          const byOrder = new Map();
          for (const it of items) {
            const oid = String(it.orderId || it.order_id || it.orderNumber || '');
            if (!byOrder.has(oid)) byOrder.set(oid, []);
            byOrder.get(oid).push(it);
          }
          result.orders = result.orders.map((o) => ({
            ...o,
            items: byOrder.get(String(o.id)) || [],
          }));
        } catch (e) {
          result.items_error = e.message;
        }
      }
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[jumia-orders]', e);
      return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
    }
  }

  // Jumia inventory sync
  if (
    action === 'jumia-stock' ||
    action === 'jumia-stock-compare' ||
    action === 'jumia-stock-push' ||
    action === 'jumia-sku-map' ||
    action === 'jumia-feed'
  ) {
    try {
      const { assertJumiaViewer } = require('../lib/jumiaClient');
      const {
        compareInventory,
        pushMontanaStockToJumia,
        getSkuMap,
        saveSkuMap,
        getJumiaFeed,
      } = require('../lib/jumiaStock');
      const { userId } = await assertJumiaViewer(bearer(req));
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (action === 'jumia-feed') {
        const feedId = url.searchParams.get('id') || req.body?.feedId || req.body?.id;
        const feed = await getJumiaFeed(feedId);
        return res.json({ ok: true, feed });
      }

      if (action === 'jumia-sku-map') {
        if (req.method === 'GET') {
          const map = await getSkuMap();
          return res.json({ ok: true, ...map });
        }
        if (req.method === 'POST') {
          const map = await saveSkuMap(req.body?.mappings || req.body || [], userId);
          return res.json({ ok: true, ...map });
        }
        return res.status(405).json({ ok: false, error: 'GET or POST' });
      }

      if (action === 'jumia-stock-push' && (req.method === 'POST' || req.method === 'GET')) {
        const slugsParam = url.searchParams.get('slugs') || '';
        const bodySlugs = req.body?.slugs;
        const slugs = Array.isArray(bodySlugs)
          ? bodySlugs
          : slugsParam
            ? slugsParam.split(',').map((s) => s.trim()).filter(Boolean)
            : null;
        const onlyMismatched =
          req.body?.onlyMismatched != null
            ? !!req.body.onlyMismatched
            : String(url.searchParams.get('all') || '') !== '1';
        const result = await pushMontanaStockToJumia({ slugs, onlyMismatched });
        return res.json(result);
      }

      // compare (default)
      const cmp = await compareInventory();
      return res.json({ ok: true, ...cmp });
    } catch (e) {
      console.error('[jumia-stock]', e);
      return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
    }
  }

  // Amazon SP-API (Egypt) — token test + orders + inventory
  if (
    action === 'amazon-token-test' ||
    action === 'amazon-orders' ||
    action === 'amazon-marketplaces' ||
    action === 'amazon-stock' ||
    action === 'amazon-stock-compare' ||
    action === 'amazon-stock-push' ||
    action === 'amazon-sku-map'
  ) {
    try {
      const {
        assertAmazonViewer,
        listAmazonOrders,
        listAmazonMarketplaces,
        testAmazonConnection,
        amazonCreds,
      } = require('../lib/amazonClient');

      if (action === 'amazon-token-test') {
        const token = bearer(req);
        if (token) await assertAmazonViewer(token);
        const result = await testAmazonConnection();
        const c = amazonCreds();
        return res.json({
          ...result,
          marketplace_id: c.marketplaceId,
          api_base: c.apiBase,
          has_client_id: !!c.clientId,
          has_client_secret: !!c.clientSecret,
          has_refresh_token: !!c.refreshToken,
        });
      }

      const { userId } = await assertAmazonViewer(bearer(req));

      if (action === 'amazon-marketplaces') {
        const marketplaces = await listAmazonMarketplaces();
        return res.json({ ok: true, marketplaces });
      }

      if (action === 'amazon-sku-map') {
        const { getSkuMap, saveSkuMap } = require('../lib/amazonStock');
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (req.method === 'GET') {
          const map = await getSkuMap();
          return res.json({ ok: true, ...map });
        }
        if (req.method === 'POST') {
          const map = await saveSkuMap(req.body?.mappings || req.body || [], userId);
          return res.json({ ok: true, ...map });
        }
        return res.status(405).json({ ok: false, error: 'GET or POST' });
      }

      if (action === 'amazon-stock' || action === 'amazon-stock-compare' || action === 'amazon-stock-push') {
        const {
          compareInventory,
          pushMontanaStockToAmazon,
        } = require('../lib/amazonStock');
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

        if (action === 'amazon-stock-push' && (req.method === 'POST' || req.method === 'GET')) {
          const slugsParam = url.searchParams.get('slugs') || '';
          const bodySlugs = req.body?.slugs;
          const slugs = Array.isArray(bodySlugs)
            ? bodySlugs
            : slugsParam
              ? slugsParam.split(',').map((s) => s.trim()).filter(Boolean)
              : null;
          const onlyMismatched =
            req.body?.onlyMismatched != null
              ? !!req.body.onlyMismatched
              : String(url.searchParams.get('all') || '') !== '1';
          const result = await pushMontanaStockToAmazon({ slugs, onlyMismatched });
          return res.json(result);
        }

        const cmp = await compareInventory();
        return res.json({ ok: true, ...cmp });
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const days = Number(url.searchParams.get('days') || req.body?.days || 30);
      const size = Number(url.searchParams.get('size') || req.body?.size || 50);
      const marketplaceId =
        url.searchParams.get('marketplace_id') || req.body?.marketplace_id || '';
      const result = await listAmazonOrders({ days, maxResults: size, marketplaceId });
      return res.json({ ok: true, ...result });
    } catch (e) {
      console.error('[amazon]', e);
      return res.status(e.status || 500).json({ ok: false, error: e.message || 'error' });
    }
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // ?telegram=listen / =restore — park the webhook while hunting for the chat
  // id. With a webhook active Telegram hands every update straight to it and
  // getUpdates stays empty, so a message can arrive and leave no trace we can
  // read back. Parking it makes updates queue up where whoami can see them.
  if (req.query?.telegram === 'listen' || req.query?.telegram === 'restore') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.json({ configured: false });
    const call = async (method, body) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      return r.json();
    };
    if (req.query.telegram === 'listen') {
      await call('deleteWebhook', { drop_pending_updates: false });
      return res.json({ webhook: 'parked', next: 'send /start to the bot, then call ?telegram=whoami' });
    }
    const url = `${process.env.PUBLIC_SITE_URL || 'https://www.montana.com.eg'}/api/telegram-webhook`;
    await call('setWebhook', { url, allowed_updates: ['callback_query', 'message'], drop_pending_updates: false });
    return res.json({ webhook: 'restored', url });
  }

  // ?telegram=whoami — recover the real chat id. getUpdates is refused while a
  // webhook is set, so the webhook is lifted for the length of this call and
  // put straight back. Pending updates are kept, never dropped.
  if (req.query?.telegram === 'whoami') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return res.json({ configured: false });
    const call = async (method, body) => {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
        return await r.json();
      } catch (e) { return { ok: false, description: String(e.message || e) }; }
    };
    const previous = await call('getWebhookInfo');
    const hookUrl = previous?.result?.url || null;
    await call('deleteWebhook', { drop_pending_updates: false });
    const updates = await call('getUpdates', { limit: 20, timeout: 0 });
    if (hookUrl) {
      await call('setWebhook', {
        url: hookUrl,
        allowed_updates: ['callback_query', 'message'],
        drop_pending_updates: false,
      });
    }
    const chats = [];
    for (const u of (updates?.result || [])) {
      const c = u.message?.chat || u.my_chat_member?.chat || u.channel_post?.chat;
      if (!c) continue;
      if (chats.some((x) => String(x.id) === String(c.id))) continue;
      chats.push({
        id: c.id,
        type: c.type,
        name: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || null,
        lastText: String(u.message?.text || '').slice(0, 40) || null,
      });
    }
    return res.json({
      configuredChatId: process.env.TELEGRAM_CHAT_ID || null,
      chatsThatMessagedTheBot: chats,
      updatesSeen: (updates?.result || []).length,
      webhookRestored: !!hookUrl,
      note: chats.length
        ? 'Set TELEGRAM_CHAT_ID to the id you want order alerts in.'
        : 'No messages have reached this bot. Send /start to it, then call this again.',
    });
  }

  // ?telegram=diag — why order alerts are not arriving. Returns no secrets:
  // just whether the webhook is registered here, what Telegram last complained
  // about, and whether the configured chat is reachable at all.
  if (req.query?.telegram === 'diag') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token) return res.json({ configured: false });
    const call = async (method, body) => {
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
        return await r.json();
      } catch (e) { return { ok: false, description: String(e.message || e) }; }
    };
    const info = await call('getWebhookInfo');
    const chat = await call('getChat', { chat_id: chatId });
    const me = await call('getMe');
    return res.json({
      configured: true,
      chatIdSet: !!chatId,
      chatIdTail: chatId ? `…${String(chatId).slice(-4)}` : null,
      botUsername: me?.result?.username || null,
      chatReachable: !!chat?.ok,
      chatError: chat?.ok ? null : chat?.description || null,
      chatType: chat?.result?.type || null,
      chatTitle: chat?.result?.title || null,
      webhookRegistered: !!info?.result?.url,
      webhookIsThisSite: !!info?.result?.url && /montana\.com\.eg\/api\/telegram-webhook/.test(info.result.url),
      webhookAllowedUpdates: info?.result?.allowed_updates || null,
      webhookLastError: info?.result?.last_error_message || null,
      webhookPending: info?.result?.pending_update_count ?? null,
      skipWebhookSet: process.env.TELEGRAM_SKIP_WEBHOOK_SET === '1',
    });
  }

  const amazonId = !!(process.env.AMAZON_LWA_CLIENT_ID || process.env.AMAZON_CLIENT_ID);
  const amazonSecret = !!(process.env.AMAZON_LWA_CLIENT_SECRET || process.env.AMAZON_CLIENT_SECRET);
  const amazonRefresh = !!(process.env.AMAZON_LWA_REFRESH_TOKEN || process.env.AMAZON_REFRESH_TOKEN);
  res.json({
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    paymob: !!(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID && process.env.PAYMOB_IFRAME_ID),
    bosta: !!process.env.BOSTA_API_KEY,
    whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    messenger: !!process.env.MESSENGER_PAGE_TOKEN,
    instagram: !!process.env.INSTAGRAM_PAGE_TOKEN,
    gemini: !!process.env.GEMINI_API_KEY,
    metaPixel: !!getPublicPixelId(),
    metaCapi: !!(getPublicPixelId() && process.env.FB_CAPI_ACCESS_TOKEN),
    serviceRole: !!(process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY),
    jumia: !!(process.env.JUMIA_CLIENT_ID && process.env.JUMIA_CLIENT_SECRET),
    jumiaRefresh: !!(process.env.JUMIA_REFRESH_TOKEN || process.env.JUMIA_CLIENT_SECRET),
    amazon: amazonId && amazonSecret && amazonRefresh,
  });
};
