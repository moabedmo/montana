# Montana Storefront

Arabic RTL e-commerce for Montana skincare products. Static HTML/CSS/JS frontend with Supabase backend and Vercel serverless APIs.

## Quick start (local)

```bash
npm install
npm run dev
```

Open `http://localhost:4000`

## Supabase migrations

Run in order in the Supabase SQL Editor:

1. `005` – `011` (existing schema)
2. `012_storefront_completion.sql` — contact, newsletter, reviews, auth profile, stock
3. `013_orders_rewards.sql` — my orders + rewards on delivery
4. `014_returns_rewards_checkout.sql` — returns, points redemption, auth checkout link

## Admin

- Store admin: `/admin.html` (Supabase Auth + `is_store_admin()`)
- Fill **Settings** with real phone, email, social links, Instapay wallet

## Environment (Vercel / `.env.local`)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Chat widget |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Order notifications |
| `PAYMOB_*` | Card payments via Paymob Accept |
| `SUPABASE_SERVICE_ROLE_KEY` | Paymob webhook auto-confirm (optional) |
| Meta `WHATSAPP_*` / `MESSENGER_*` / `INSTAGRAM_*` | Messaging webhooks |

Copy `.env.example` and fill values.

## OAuth login

Enable Google / Facebook / Apple in **Supabase Dashboard → Authentication → Providers**. Redirect URL: `https://your-domain/account.html`

## Paymob setup

1. Create Accept account at [paymob.com](https://paymob.com)
2. Set `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_IFRAME_ID`
3. Webhook URL: `https://your-domain/api/paymob-webhook`
4. Set `PAYMOB_HMAC_SECRET` from dashboard

Card option appears in checkout automatically when env vars are set.

## Key pages

| Page | Description |
|------|-------------|
| `/` | Homepage |
| `/category.html` | Product catalog |
| `/checkout.html` | Guest + logged-in checkout |
| `/account.html` | Profile, orders, rewards |
| `/returns.html` | Return / exchange requests |
| `/tracking.html` | Order tracking |
| `/admin.html` | Store management |

## CRM

Separate app under `/crm` — not linked to storefront orders by default.
