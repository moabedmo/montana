// Canonical public URL (production). Used for OAuth redirects hints and admin webhook display.
export const PUBLIC_SITE_URL = 'https://www.montana.com.eg';

export const WEBHOOK_URLS = {
  whatsapp: `${PUBLIC_SITE_URL}/api/whatsapp-webhook`,
  messenger: `${PUBLIC_SITE_URL}/api/messenger-webhook`,
  instagram: `${PUBLIC_SITE_URL}/api/instagram-webhook`,
  paymobWebhook: `${PUBLIC_SITE_URL}/api/paymob-webhook`
};
