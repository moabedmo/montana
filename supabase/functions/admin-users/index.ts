// Montana CRM — admin user management
// Creates/deletes rep accounts with the service-role key so the anon
// signUp path (and its email-confirmation problems) is no longer needed.
// CRM admins (crm_reps) and store admins (store_admins) may call this.
//
// Deploy:  supabase functions deploy admin-users
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function callerIsAdmin(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data: rep } = await admin
    .from("crm_reps")
    .select("role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (rep?.role === "admin" && rep.active) return true;

  const { data: store } = await admin
    .from("store_admins")
    .select("active")
    .eq("user_id", userId)
    .maybeSingle();
  return store?.active === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(jwt);
  if (!user) return json({ error: "Not signed in" }, 401);

  if (!(await callerIsAdmin(admin, user.id))) {
    return json({ error: "Admin access required" }, 403);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  try {
    switch (body.action) {
      case "create_rep": {
        const { email, password, name, phone, territory, officeId, brickIds, role } = body as {
          email: string; password: string; name: string; phone?: string;
          territory?: string; officeId?: string; brickIds?: string[];
          role?: string;
        };
        if (!email || !password || !name) {
          return json({ error: "email, password and name are required" }, 400);
        }
        if (password.length < 6) {
          return json({ error: "password must be at least 6 characters" }, 400);
        }
        const safeRole = role === "admin" ? "admin" : "rep";
        if (safeRole === "rep" && !(Array.isArray(brickIds) && brickIds.length)) {
          return json({ error: "Select at least one brick for a sales rep" }, 400);
        }

        const { data: created, error: authErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (authErr) return json({ error: authErr.message }, 400);

        const { data: rep, error: repErr } = await admin
          .from("crm_reps")
          .insert({
            user_id: created.user.id,
            name, email,
            phone: phone || null,
            territory: territory || null,
            office_id: officeId || null,
            role: safeRole,
            active: true,
          })
          .select()
          .single();
        if (repErr) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: repErr.message }, 400);
        }

        if (Array.isArray(brickIds) && brickIds.length) {
          await admin.from("crm_rep_bricks").insert(
            brickIds.map((bid) => ({ rep_id: rep.id, brick_id: bid })),
          );
        }
        return json({ rep });
      }

      case "delete_rep": {
        const { repId } = body as { repId: string };
        if (!repId) return json({ error: "repId is required" }, 400);

        const { data: rep } = await admin
          .from("crm_reps")
          .select("id, user_id, role")
          .eq("id", repId)
          .maybeSingle();
        if (!rep) return json({ error: "Account not found" }, 404);

        // Don't delete the last remaining CRM admin
        if (rep.role === "admin") {
          const { count } = await admin
            .from("crm_reps")
            .select("id", { count: "exact", head: true })
            .eq("role", "admin")
            .eq("active", true);
          if ((count ?? 0) <= 1) {
            return json({ error: "مينفعش تمسح آخر مدير في النظام" }, 400);
          }
        }

        await admin.from("crm_reps").delete().eq("id", repId);
        if (rep.user_id) await admin.auth.admin.deleteUser(rep.user_id);
        return json({ ok: true });
      }

      case "reset_password": {
        const { repId, password } = body as { repId: string; password: string };
        if (!repId || !password) {
          return json({ error: "repId and password are required" }, 400);
        }
        if (password.length < 6) {
          return json({ error: "password must be at least 6 characters" }, 400);
        }

        const { data: rep } = await admin
          .from("crm_reps")
          .select("user_id, role")
          .eq("id", repId)
          .maybeSingle();
        if (!rep?.user_id) return json({ error: "Account not found" }, 404);

        const { error: pwErr } = await admin.auth.admin.updateUserById(rep.user_id, {
          password,
          email_confirm: true,
        });
        if (pwErr) return json({ error: pwErr.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
