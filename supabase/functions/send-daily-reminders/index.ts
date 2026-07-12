// Montana CRM — daily push reminders
// Sends each subscribed rep a morning notification with how many planned
// visits they still have this month. Trigger it on a schedule (see
// crm/DEPLOY.md) or manually:
//   curl -X POST https://<ref>.supabase.co/functions/v1/send-daily-reminders \
//        -H "Authorization: Bearer <anon-key>"
//
// Required secrets (supabase secrets set KEY=value):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@domain)
//
// Deploy:  supabase functions deploy send-daily-reminders
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@montana.com",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: subs, error } = await admin
    .from("crm_push_subscriptions")
    .select("id, endpoint, p256dh, auth, rep_id, crm_reps(name, active)");
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStr = monthStart.toISOString().slice(0, 10);

  let sent = 0, removed = 0;
  for (const sub of subs ?? []) {
    const rep = sub.crm_reps as unknown as { name: string; active: boolean } | null;
    if (!rep?.active) continue;

    // remaining planned visits this cycle
    const { data: plan } = await admin
      .from("crm_cycle_plans")
      .select("id")
      .eq("rep_id", sub.rep_id)
      .eq("month", monthStr)
      .maybeSingle();

    let remaining = 0;
    if (plan) {
      const { data: items } = await admin
        .from("crm_plan_items")
        .select("planned_visits, completed_visits")
        .eq("cycle_plan_id", plan.id);
      remaining = (items ?? []).reduce(
        (s, i) => s + Math.max(0, (i.planned_visits ?? 0) - (i.completed_visits ?? 0)),
        0,
      );
    }

    const firstName = rep.name.split(" ")[0];
    const payload = JSON.stringify({
      title: "Montana CRM",
      body: remaining > 0
        ? `Good morning ${firstName} — ${remaining} planned visit${remaining > 1 ? "s" : ""} remaining this cycle. Have a great day in the field!`
        : `Good morning ${firstName} — your cycle plan is fully covered. Great work!`,
      url: "/crm/rep/",
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // subscription expired — clean it up
        await admin.from("crm_push_subscriptions").delete().eq("id", sub.id);
        removed++;
      }
    }
  }

  return new Response(JSON.stringify({ sent, removed }), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
