# Montana Naturals — working notes

Egyptian skincare brand. Storefront at **montana.com.eg** (Vercel), Supabase for
data, and an Arabic sales bot that also sells through Messenger and Instagram.

Answer the owner in **Egyptian Arabic**.

---

## How a customer message actually flows

```
Instagram / Messenger DM
        ↓
     ManyChat            ← receives it, NOT api/instagram-webhook.js
        ↓ POST /api/chat  (X-Montana-Secret header)
   api/chat.js           ← splits the reply into reply1/reply2/reply3
        ↓
   lib/chatEngine.js     ← the brain (~8k lines)
        ↓
   Supabase              ← cart, history, checkout wizard, orders
```

- `'NONE'` in reply1/2/3 means **"send nothing"** — ManyChat matches on that string.
- The website widget posts to the same `/api/chat` with `channel: 'web'`.
- **The channel comes from the session-id prefix** (`instagram:123`), not the
  `channel` field. A sid with no prefix is treated as `web`. Getting this wrong
  makes tests exercise the wrong code path and look like bugs that aren't there.

## ⚠️ The trap that has burned three fixes

`lib/chatEngine.js` contains a ~640-line block:

```js
if (!skipScriptedMaze && message) { … }
```

`skipScriptedMaze` is set to `true` whenever LLM-first mode is on — **which it is
in production**. Everything inside that block never runs. Three separate correct
fixes were written into it, shipped, and silently did nothing.

**Any rule that must hold on every turn goes ABOVE that block**, near the
caller-number and order-problem checks. `scripts/test-live-path-not-dead-code.js`
enforces this — run it after touching the engine.

---

## Before and after every change

```bash
node scripts/eval-chat.js
```

62 real customer conversations replayed against production. **Currently ~51/62.**
If it drops below ~49, something broke.

The score moves ±2–3 between runs with identical code, because the model words
replies differently each time. One case flipping is noise; a drop of 4+ is real.

When a live failure comes in, add it to `scripts/eval-chat-cases.json` **before**
fixing it.

### Assertions check meaning, not wording
The eval predates LLM-first and used to demand exact phrasing, failing replies
that were perfectly good. If a case fails, **read the actual reply first** — it is
often correct and the assertion is too literal. Loosen the assertion in that case;
don't contort the bot to satisfy a regex.

### Unit tests
```bash
for t in scripts/test-*.js; do node "$t" >/dev/null 2>&1 && echo "PASS $t" || echo "FAIL $t"; done
```

## Deploying

**Commit first, then deploy.** Since the project gained a GitHub remote
(`montanahala32/montana2`), a deploy ships the last committed state — not the
working tree. Uncommitted edits deploy successfully and change nothing, which
looks exactly like a broken deploy and cost an afternoon to spot.

```bash
git add -A && git commit -m "…"
vercel deploy --prod
```

If a change doesn't show up live, check `git status` before suspecting Vercel.

**The commit author email must belong to a real GitHub account.** Vercel blocks
a deployment whose commit author it cannot match, and the CLI reports this only
as a deployment that never leaves `UNKNOWN` — no error, no failure, it just
never goes live. The owner's account is `moabedmo` / `mo-abed5@outlook.com`;
`git config user.email` must stay on that. When a deploy hangs, the reason is
on the deployment's page under **Deployment Blocked**, not in the terminal:

```bash
vercel inspect <deployment-url>   # then open the Inspect link it prints
```

Blocked deployments also queue behind each other — clear them with
`vercel remove <url> --yes --safe` before retrying.

Roll back instantly:
```bash
vercel rollback <previous-deployment-url>
```

Vercel **Hobby** plan: max 12 serverless functions (all 12 used — extend an
existing `api/*.js`, never add a file) and 2 cron jobs (both used).

---

## Decisions the owner has made — do not "fix" these

- **The bot never asks for money.** A staff member phones the customer for a
  200 EGP confirmation payment. The bot must not mention it *and must not deny
  it* — denying it made a real call look like a scam. If a customer asks about a
  call demanding money, the bot asks which number rang her and checks it against
  `CS_SUPPORT_PHONE` (`01019787225`).
- **Order problems go straight to a human.** "الأوردر موصلش", "مشكلة في الأوردر",
  late/wrong/missing/returned → hand over the support number, no phone lookup, no
  selling. `needsHuman: true`.
- **"الشحن مجاني من 3 منتجات" is said once per conversation.** Repeating it after
  every price reads as pushy; never saying it loses the upsell.
- **Silicone / scar gel is never mentioned to customers.**
- Cosmetic claims only — every product reply carries the "دواعي استعمال تجميلية"
  line. Keep it.

## Telegram

Bot **@Montanaeg_bot** → `TELEGRAM_CHAT_ID`.

Orders are announced **from the server** in `create_order()`. They used to be
announced from the browser, so Messenger/Instagram orders — which have no browser
— were never announced at all. Keep it server-side.

Also alerting: stock crossing low/zero (`lib/stockAlerts.js`), new pharmacy
invoice and cancelled/returned orders (`lib/adminAlerts.js`, fired from the admin
UI where a human is always present), and a daily digest at 07:00 UTC riding the
existing cron (`lib/dailyDigest.js`).

**When Telegram goes quiet:**
```
https://www.montana.com.eg/api/integrations-status?telegram=diag
```
`chatReachable: false` with `"chat not found"` usually means the recipient never
pressed **Start** on the bot (or deleted the chat) — Telegram refuses to deliver
until they do. `?telegram=whoami` lists the chats that have messaged the bot, so
the real id can be recovered.

## Known-good facts

- Products and prices live in Supabase; the bot must read them with its tools,
  never state a price from memory.
- Routine bundles: brightening 777, post-laser 618, face-body 558 — these are the
  **sum of live product prices**, not a discount. The perk is free shipping.
- `lib/adOffers.js` `formatAllRoutineOffersList()` runs ~426 chars and the reply
  cap is 420 — the cap exempts anything containing `────` for exactly this reason.
  Don't remove that exemption.

## Still open

- **ManyChat**: two flows appear to fire on one keyword (duplicate replies —
  `api/chat.js` now swallows repeats within 12s as a safety net), and
  `selectedBundle` sometimes arrives as the literal `{{cuf_…}}` template, so the
  bot can't tell which ad the customer came from. Both are dashboard fixes.
- ~11 eval cases still failing, several of them flaky rather than broken.
