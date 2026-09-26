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

74 real customer conversations. **Currently ~62/74.** If it drops below ~58,
something broke.

**It replays against `https://www.montana.com.eg/api/chat` — production, not
the working tree.** Running it before `vercel --prod` measures the deployed
build and says nothing about the change in hand; a "regression" found that way
is not one. Run it *after* deploying, or point `CHAT_URL` somewhere else.

The score moves ±2–3 between runs with identical code, because the model words
replies differently each time. One case flipping is noise; a drop of 4+ is real.
A batch of failures reading `HTTP 0` is the network, not the bot — those are
requests that never landed, and the run should be repeated rather than read.

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

## Pushing, and deploying

**The remote is `moabedmo/montana`, branch `live`.**

```bash
git add -A && git commit -m "…"
git push https://github.com/moabedmo/montana.git HEAD:live
```

`main` on that repo is a different, older generation of the site — 66 commits
ending in June, 688 files this tree does not have. Do not force over it.

**Pushing to GitHub does not deploy.** Vercel is not watching the `live`
branch — a push lands the code and the site keeps serving the old build. The
deploy is a second, separate step:

```bash
vercel --prod --yes
```

The CLI is now signed into team **montana** (`montana1`), project **montana2**,
which is the one serving www.montana.com.eg — check with `vercel project ls`
before trusting it. It was once signed into an unrelated account, which is why
these notes used to say never to run it here.

**`gh` holds two accounts and the active one decides the push.** When it is on
`montanahala32`, a push to `moabedmo/montana` comes back
`Permission ... denied to montanahala32` — a 403, not a login prompt:

```bash
gh auth switch --user moabedmo
```

**Git credentials.** A system-level `manager` helper answers before the repo's
own `gh` helper and hands over a different GitHub account, and GitHub replies
`Repository not found` rather than a permission error — the repo looks deleted
when it is only the wrong login. The fix, already applied to this clone:

```bash
git config --local --replace-all credential.helper ""
git config --local --add credential.helper "!gh auth git-credential"
```

**Push protection.** A live Google API key sits in nine `gen-*.js` /
`generate-*.js` files and in the history (`ddc323c`, `04bba60`). GitHub blocks
pushes on it and gives an unblock URL. It needs revoking in Google Cloud, not
allowing.

**`montanahala32/montana2` is not this project.** It was created during an
unasked-for account migration whose commit email (`u2356538@gmail.com`) is the
one that blocked deployments for an afternoon. Ignore it.

**Commit author email must belong to a real GitHub account** — `moabedmo` /
`mo-abed5@outlook.com`. Vercel silently refuses to deploy a commit whose author
it cannot match, showing only a deployment stuck at `UNKNOWN`.

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

## The storefront is a light theme, on five brand colours

```
GRAY LAVENDER  #9275A4   the lead — accent, and the whole ink ramp
BLUE           #436697   secondary accent; dark enough to be text as-is
LIGHT GRAY     #F4F3F3   the tinted band between white sections
GRAY ORANGE    #D8B559   the gold — fills, glows, price chips
LIGHT RED      #DDC3C3   blush tint
```

They live at the top of `premium.css`, which is in **both** bundles. Nothing
else invents a colour: every token is one of these five, one darkened for text,
or one thinned to a tint.

**The palette has no colour dark enough for body text.** The lavender manages
3.96:1 on white against a 4.5 floor; the other three are 1.1–2.0. So the ink
ramp is the lavender darkened — `--mnt-ink` / `-body` / `-muted`, measured at
12.6 / 7.6 / 4.5:1.

**Gold is worse: `#D8B559` as text is 1.97:1.** `--mnt-gold` is for fills and
glows only. Gold text on white uses `--mnt-gold-ink`; gold text on a dark pill
(the product badges) uses `--mnt-gold-light`. Getting that backwards is the
single easiest way to make something invisible, and it has happened in both
directions already.

Two places are deliberately dark and stay that way: the **hero photograph** and
the **footer** (plus the thin promo strip).

CSS is hand-written and bundled — edit the source file, never `css/*.bundle.css`:

```bash
npm run build:css    # styles/app/premium/home-premium/shop-premium → css/*.bundle.css
npm run build:en     # index.html → en/index.html (never edit en/ by hand)
```

Bump the `?v=` on `css/home.bundle.css` in `index.html` when the bundle changes,
or returning visitors keep the old one.

- **Section backgrounds come from `--mnt-surface*`, text from the ink ramp**
  (`--mnt-ink`, `-body`, `-muted`, `-faint`). The plum tokens are brand ink and
  the dark chrome — painting a section with one is what made the site purple.
- `--mnt-gold` (#C9A84C) is for fills and glows. Gold **text** on white must use
  `--mnt-gold-ink`; the bright gold is unreadable on a light surface.
- Tokens live in `premium.css` because it is in **both** bundles.
  `home-premium.css` is homepage-only — tokens defined only there leave every
  shop page with undefined colours.
- Anything added to `.showcase-info` needs a colour in the **HERO COPY** block at
  the bottom of `home-premium.css`. `premium.css` sets `h1..h6 { color: var(--mnt-ink)
  !important }` site-wide, so hero text without an override comes out dark on the
  dark photo and is invisible.
- `dark-theme.css` is now the *light* theme for inner pages. The name stayed
  because ~30 pages link it directly.

### The hero is six stills, not six videos

`images/hero-slide-{1..6}.webp` cross-fade on the carousel's own timer
(`js/hero-showcase.js`), mapped to products **by slug** — the DB order does not
match the file numbering. `videos/p*.mp4` (11 MB) is no longer referenced.

A full-bleed backdrop must not carry `width`/`height` attributes: `css/perf.css`
has `img[width][height] { height: auto }`, which outranks a class selector and
silently collapsed the hero to a 165px letterbox.

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
