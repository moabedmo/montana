// Montana Naturals — Facebook Comments Management Engine
// Handles storing, listing, syncing, and replying to Facebook Page & Ad comments from Admin Dashboard.

const { createClient } = require('@supabase/supabase-js');
const { sendFacebookCommentPublicReply, sendFacebookCommentPrivateReply } = require('./metaSend');

const SUPABASE_URL = 'https://ikryeyqrithikabwidov.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo';
const SERVICE_KEY = process.env.SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SETTINGS_KEY = 'fb_comments_store';
const MAX_FALLBACK_COMMENTS = 250;

let inMemoryComments = [];

function adminClient(token = null) {
  if (SERVICE_KEY) {
    return createClient(SUPABASE_URL, SERVICE_KEY);
  }
  if (token) {
    return createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON);
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK STORAGE IN site_settings IF TABLE DOES NOT EXIST YET
// ─────────────────────────────────────────────────────────────────────────────

async function loadFallbackComments(sb) {
  try {
    const { data } = await sb.from('site_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryComments = parsed;
        return inMemoryComments;
      }
    }
  } catch (err) {
    console.warn('[fbComments] loadFallbackComments:', err.message);
  }
  return inMemoryComments;
}

async function saveFallbackComments(sb, comments) {
  try {
    const list = Array.isArray(comments) ? comments.slice(0, MAX_FALLBACK_COMMENTS) : [];
    inMemoryComments = list;
    const val = JSON.stringify(list);
    const { data: existing } = await sb.from('site_settings').select('id').eq('key', SETTINGS_KEY).maybeSingle();
    if (existing?.id) {
      await sb.from('site_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await sb.from('site_settings').insert({ key: SETTINGS_KEY, value: val });
    }
  } catch (err) {
    console.warn('[fbComments] saveFallbackComments:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE INBOUND & LISTING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function recordInboundComment({
  commentId,
  postId = null,
  postName = null,
  fromName = 'عميل فيسبوك',
  fromId = null,
  message = '',
  permalinkUrl = null,
  createdTime = null,
}) {
  if (!commentId || !message) return null;
  const sb = adminClient();
  const nowIso = new Date().toISOString();
  const cTime = createdTime ? new Date(createdTime).toISOString() : nowIso;

  const row = {
    comment_id: String(commentId),
    post_id: postId ? String(postId) : null,
    post_name: postName ? String(postName).slice(0, 200) : null,
    from_name: fromName ? String(fromName).slice(0, 150) : 'عميل فيسبوك',
    from_id: fromId ? String(fromId) : null,
    message: String(message),
    status: 'pending',
    permalink_url: permalinkUrl || null,
    created_at: cTime,
    updated_at: nowIso,
  };

  // Try PostgreSQL table `facebook_comments` first
  try {
    const { data: existing } = await sb.from('facebook_comments').select('id, status, reply_text').eq('comment_id', row.comment_id).maybeSingle();
    if (existing) {
      const { data } = await sb.from('facebook_comments').update({
        message: row.message,
        updated_at: nowIso,
      }).eq('id', existing.id).select('*').single();
      return data;
    }
    const { data, error } = await sb.from('facebook_comments').insert(row).select('*').single();
    if (!error && data) return data;
    if (error && error.code !== 'PGRST205') throw error;
  } catch (err) {
    // If table doesn't exist, proceed to fallback
    if (!/PGRST205|relation.*does not exist/i.test(err.message || '')) {
      console.warn('[fbComments] table insert error, falling back:', err.message);
    }
  }

  // Fallback to site_settings
  const fallbackList = await loadFallbackComments(sb);
  const existingIdx = fallbackList.findIndex(c => c.comment_id === row.comment_id);
  if (existingIdx !== -1) {
    fallbackList[existingIdx].message = row.message;
    fallbackList[existingIdx].updated_at = nowIso;
    await saveFallbackComments(sb, fallbackList);
    return fallbackList[existingIdx];
  }
  const newEntry = {
    id: Date.now(),
    ...row,
    reply_text: null,
    replied_at: null,
    replied_by: null,
  };
  fallbackList.unshift(newEntry);
  await saveFallbackComments(sb, fallbackList);
  return newEntry;
}

async function listComments({ status = 'all', limit = 50, offset = 0, search = '' } = {}) {
  const sb = adminClient();
  let comments = [];

  // Try PostgreSQL table first
  try {
    let q = sb.from('facebook_comments').select('*', { count: 'exact' });
    if (status && status !== 'all') {
      q = q.eq('status', status);
    }
    if (search) {
      q = q.or(`from_name.ilike.%${search}%,message.ilike.%${search}%`);
    }
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (!error && data) {
      const { count: pendingCount } = await sb.from('facebook_comments').select('id', { count: 'exact', head: true }).eq('status', 'pending');
      return {
        comments: data,
        total: count || data.length,
        pendingCount: pendingCount || 0,
      };
    }
  } catch (err) {
    if (!/PGRST205|relation.*does not exist/i.test(err.message || '')) {
      console.warn('[fbComments] table list error, fallback:', err.message);
    }
  }

  // Fallback
  const all = await loadFallbackComments(sb);
  let filtered = all;
  if (status && status !== 'all') {
    filtered = filtered.filter(c => c.status === status);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(c =>
      String(c.from_name || '').toLowerCase().includes(s) ||
      String(c.message || '').toLowerCase().includes(s)
    );
  }
  const pendingCount = all.filter(c => c.status === 'pending').length;
  const paged = filtered.slice(offset, offset + limit);

  return {
    comments: paged,
    total: filtered.length,
    pendingCount,
  };
}

async function replyToComment({
  commentId,
  replyText,
  repliedBy = 'مسؤول الصفحة',
  replyType = 'public',
}) {
  if (!commentId || !replyText) {
    throw new Error('commentId and replyText are required');
  }

  const pageToken = process.env.MESSENGER_PAGE_TOKEN;
  if (!pageToken) {
    throw new Error('MESSENGER_PAGE_TOKEN is not configured on server');
  }

  // Send to Facebook Graph API
  if (replyType === 'private') {
    await sendFacebookCommentPrivateReply(pageToken, commentId, replyText);
  } else {
    await sendFacebookCommentPublicReply(pageToken, commentId, replyText);
  }

  const sb = adminClient();
  const nowIso = new Date().toISOString();
  const updateData = {
    status: 'replied',
    reply_text: String(replyText).trim(),
    replied_at: nowIso,
    replied_by: repliedBy || 'مسؤول الصفحة',
    updated_at: nowIso,
  };

  // Try PostgreSQL table
  try {
    const { data, error } = await sb
      .from('facebook_comments')
      .update(updateData)
      .eq('comment_id', String(commentId))
      .select('*')
      .maybeSingle();
    if (!error && data) return data;
  } catch (_) {}

  // Fallback
  const all = await loadFallbackComments(sb);
  const item = all.find(c => String(c.comment_id) === String(commentId));
  if (item) {
    Object.assign(item, updateData);
    await saveFallbackComments(sb, all);
    return item;
  }

  return { comment_id: commentId, ...updateData };
}

async function updateCommentStatus({ commentId, status, repliedBy = null }) {
  if (!commentId || !status) throw new Error('commentId and status required');
  const sb = adminClient();
  const nowIso = new Date().toISOString();
  const updateData = {
    status,
    updated_at: nowIso,
  };
  if (repliedBy) updateData.replied_by = repliedBy;

  // Try PostgreSQL table
  try {
    const { data, error } = await sb
      .from('facebook_comments')
      .update(updateData)
      .eq('comment_id', String(commentId))
      .select('*')
      .maybeSingle();
    if (!error && data) return data;
  } catch (_) {}

  // Fallback
  const all = await loadFallbackComments(sb);
  const item = all.find(c => String(c.comment_id) === String(commentId));
  if (item) {
    Object.assign(item, updateData);
    await saveFallbackComments(sb, all);
    return item;
  }
  return { comment_id: commentId, status };
}

async function syncLatestCommentsFromFacebook(limitPosts = 10) {
  const token = process.env.MESSENGER_PAGE_TOKEN;
  if (!token) throw new Error('MESSENGER_PAGE_TOKEN is not configured');

  const fields = 'id,message,created_time,comments.limit(20){id,message,from,created_time,permalink_url}';
  const url = `https://graph.facebook.com/v20.0/me/feed?fields=${encodeURIComponent(fields)}&limit=${limitPosts}&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Failed to fetch Facebook feed (${res.status})`);
  }

  let ingested = 0;
  const posts = Array.isArray(data.data) ? data.data : [];
  for (const post of posts) {
    const comments = Array.isArray(post.comments?.data) ? post.comments.data : [];
    for (const c of comments) {
      if (!c.id || !c.message) continue;
      await recordInboundComment({
        commentId: c.id,
        postId: post.id,
        postName: post.message ? post.message.slice(0, 100) : 'منشور على الصفحة',
        fromName: c.from?.name || 'عميل فيسبوك',
        fromId: c.from?.id || null,
        message: c.message,
        permalinkUrl: c.permalink_url || null,
        createdTime: c.created_time || null,
      });
      ingested++;
    }
  }

  return { ok: true, synced: ingested, postsChecked: posts.length };
}

module.exports = {
  recordInboundComment,
  listComments,
  replyToComment,
  updateCommentStatus,
  syncLatestCommentsFromFacebook,
};
