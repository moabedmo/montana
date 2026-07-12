// Poll pending customer notifications (after admin confirms via Telegram).
// ?pendingProof=1 also returns awaiting proof upload for chat session restore.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const sessionId = String(req.query.sessionId || '').slice(0, 64);
  if (!sessionId) return res.json({ message: null });

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://ikryeyqrithikabwidov.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcnlleXFyaXRoaWthYndpZG92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MzY1ODcsImV4cCI6MjA5NzMxMjU4N30.kNfHPxV4fq67cOF8uFsTrLOxPYcLcmmDO3ScIHzI9Uo'
  );

  try {
    const wantPending = req.query.pendingProof === '1';
    const tasks = [
      sb.rpc('poll_chat_notification', { p_session_id: sessionId }),
    ];
    if (wantPending) {
      tasks.push(sb.rpc('get_pending_proof_by_session', { p_session_id: sessionId }));
    }

    const results = await Promise.all(tasks);
    const notifyResult = results[0];
    if (notifyResult.error) {
      console.error('chat-notify:', notifyResult.error.message);
    }

    const payload = notifyResult.data || { message: null };
    if (wantPending) {
      const pendingResult = results[1];
      if (pendingResult.error) {
        console.error('chat-notify pending:', pendingResult.error.message);
        payload.pending_proof = { found: false };
      } else {
        payload.pending_proof = pendingResult.data || { found: false };
      }
    }

    res.json(payload);
  } catch (err) {
    console.error('chat-notify:', err.message);
    res.json({ message: null });
  }
};
