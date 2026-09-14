/**
 * Build English storefront pages from Arabic templates.
 * Run: node scripts/build-en-site.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyEnText, findRemainingArabic } from './en-text-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EN_DIR = path.join(ROOT, 'en');

const EN_SCRIPTS = `
<script>window.MONTANA_LOCALE="en";</script>
<script type="module" src="../js/i18n/bootstrap-en.js"></script>
<script type="module" src="../js/en-apply-ui.js"></script>`;

function fixAssetPaths(html) {
  let out = html.replace(/\b(href|src)="([^"]+)"/g, (match, attr, url) => {
    if (/^(https?:|\/\/|#|javascript:|mailto:|tel:|data:)/i.test(url)) return match;
    if (url.startsWith('../')) return match;
    // Root-absolute already resolves the same from /en/ as from / — prefixing
    // it produces "..//js/…". Only document-relative URLs need the hop up.
    if (url.startsWith('/')) return match;
    // Compare without the cache-buster. Every test here used to run against the
    // raw URL, so adding "?v=3" to script.js in index.html silently stopped it
    // being rewritten: /en/ then asked for /en/script.js, got a 404, and the
    // English pages shipped without their scripts or the chat widget.
    const bare = url.split(/[?#]/)[0];
    if (
      bare.endsWith('.css') ||
      bare.endsWith('.js') ||
      bare.startsWith('images/') ||
      bare.startsWith('js/') ||
      bare.startsWith('css/') ||
      bare === 'manifest.json'
    ) {
      return `${attr}="../${url}"`;
    }
    return match;
  });
  out = out.replace(/\bdata-image="(images\/[^"]+)"/g, 'data-image="../$1"');
  out = out.replace(/url\('(images\/[^']+)'\)/g, "url('../$1')");
  out = out.replace(/url\("(images\/[^"]+)"\)/g, 'url("../$1")');
  return out;
}

function fixEnInternalLinks(html) {
  return html
    .replace(/\bhref="\/(?!en\/|product\/)([a-z0-9_-]+\.html)([^"]*)"/gi, 'href="/en/$1$2"')
    .replace(/\bhref="(?!https?:|\/\/|#|javascript:|\/|\.\.)([a-z0-9_-]+\.html)([^"]*)"/gi, 'href="/en/$1$2"')
    .replace(/\bhref="\.\.\/index\.html"/g, 'href="/"');
}

function injectEnScripts(html) {
  if (html.includes('bootstrap-en.js')) return html;
  return html
    .replace('<script src="../components.js">', `${EN_SCRIPTS}\n<script src="../components.js">`)
    .replace('<script src="components.js">', `${EN_SCRIPTS.replace(/\.\.\//g, '')}\n<script src="components.js">`);
}

function buildIndex() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace('<html lang="ar" dir="rtl">', '<html lang="en" dir="ltr">');
  html = html.replace('<body class="mnt-home">', '<body class="mnt-home mnt-en">');
  if (!html.includes('ltr-en.css')) {
    html = html.replace(
      '<link rel="stylesheet" href="css/home.bundle.css?v=5" media="print"',
      '<link rel="stylesheet" href="css/ltr-en.css?v=2">\n    <link rel="stylesheet" href="css/home.bundle.css?v=5" media="print"'
    );
  }
  html = fixAssetPaths(html);
  html = html.replace(
    '<a href="/en/" class="lang-switch" data-locale-toggle="1"><i class="fas fa-globe"></i> English</a>',
    '<a href="/" class="lang-switch" data-locale-toggle="1"><i class="fas fa-globe"></i> العربية</a>'
  );
  html = html.replace(
    /<div class="lux-concerns-grid" id="concernsGrid"[^>]*>[\s\S]*?<\/div>\s*<p class="lux-concerns-disclaimer">[^<]*<\/p>/,
    '<div class="lux-concerns-grid" id="concernsGrid"></div>\n        <p class="lux-concerns-disclaimer"></p>'
  );
  html = html.replace(
    '<a href="/en/" class="header-action lang-switch-action" data-locale-toggle="1" title="English">',
    '<a href="/" class="header-action lang-switch-action" data-locale-toggle="1" title="Arabic">'
  );
  html = html.replace(
    '<small>English</small>\n                    </a>\n                </div>\n            </div>\n        </div>\n    </div>\n    <nav class="main-nav">',
    '<small>العربية</small>\n                    </a>\n                </div>\n            </div>\n        </div>\n    </div>\n    <nav class="main-nav">'
  );
  html = applyEnText(html);
  html = fixEnInternalLinks(html);
  html = html.replace(
    '<link rel="canonical" href="https://www.montana.com.eg/">',
    '<link rel="canonical" href="https://www.montana.com.eg/en/">'
  );
  html = html.replace(
    '<meta property="og:url" content="https://www.montana.com.eg/">',
    '<meta property="og:url" content="https://www.montana.com.eg/en/">'
  );
  html = html.replace(
    '<meta property="og:locale" content="ar_EG">',
    '<meta property="og:locale" content="en_US">'
  );
  html = html.replace(/href="\/product\//g, 'href="/en/product/');
  html = injectEnScripts(html);
  if (!html.includes('seo.js')) {
    html = html.replace('</head>', '    <script src="../js/seo.js" defer></script>\n</head>');
  }
  // These anchors are matched with a regex, not a literal string, because the
  // cache-buster on each tag changes. Bumping ?v= on hero-showcase.js used to
  // make the en-render-home injection below miss silently, and the English
  // homepage then shipped with nothing to render it.
  const tag = (src) =>
    new RegExp(`<script type="module" src="(?:\\.\\./)?${src.replace(/[.]/g, '\\.')}(\\?[^"]*)?">`);

  if (!html.includes('bootstrap-en.js')) {
    html = html.replace(
      /<script src="(?:\.\.\/)?js\/lang-switch\.js(\?[^"]*)?" defer>/,
      (m) => `<script>window.MONTANA_LOCALE="en";</script>\n<script type="module" src="../js/i18n/bootstrap-en.js"></script>\n${m}`
    );
  }
  if (!html.includes('en-render-home.js')) {
    html = html.replace(
      tag('js/hero-showcase.js'),
      (m) => `<script type="module" src="../js/en-render-home.js?v=2"></script>\n${m}`
    );
  }
  html = html.replace(tag('js/home.js'), (m) => m.replace('src="js/', 'src="../js/'));
  fs.mkdirSync(EN_DIR, { recursive: true });
  fs.writeFileSync(path.join(EN_DIR, 'index.html'), html, 'utf8');
}

function buildPage(name, titleEn, bodyClass = 'mnt-en') {
  const src = path.join(ROOT, name);
  if (!fs.existsSync(src)) return;
  let html = fs.readFileSync(src, 'utf8');
  html = html.replace(/<html lang="ar" dir="rtl">/, '<html lang="en" dir="ltr">');
  html = html.replace(/<body(?:\s+class="[^"]*")?\s*>/, `<body class="${bodyClass}">`);
  html = html.replace(/<title>[^<]+<\/title>/, `<title>${titleEn}</title>`);
  html = html.replace(
    /<link rel="stylesheet" href="premium.css">/,
    '<link rel="stylesheet" href="../premium.css">\n    <link rel="stylesheet" href="../css/ltr-en.css?v=1">'
  );
  html = fixAssetPaths(html);
  if ((name === 'category.html' || name === 'search.html') && !html.includes('shop-premium.css')) {
    html = html.replace(
      '<link rel="stylesheet" href="../dark-theme.css">',
      '<link rel="stylesheet" href="../dark-theme.css">\n    <link rel="stylesheet" href="../shop-premium.css?v=1">'
    );
  }
  html = applyEnText(html);
  html = fixEnInternalLinks(html);
  html = html.replace(/href="\/product\//g, 'href="/en/product/');
  html = injectEnScripts(html);
  if (!html.includes('seo.js')) {
    html = html.replace('</head>', '    <script src="../js/seo.js" defer></script>\n</head>');
  }
  if (!html.includes('lang-switch.js')) {
    html = html.replace(
      '<script src="../js/cart.js">',
      '<script src="../js/lang-switch.js?v=2"></script>\n<script src="../js/cart.js">'
    ).replace(
      '<script src="js/cart.js">',
      '<script src="js/lang-switch.js?v=2"></script>\n<script src="js/cart.js">'
    );
  }
  fs.writeFileSync(path.join(EN_DIR, name), html, 'utf8');
}

buildIndex();
buildPage('category.html', 'Montana | Shop', 'mnt-shop mnt-en');
buildPage('product.html', 'Montana | Product Details');
buildPage('checkout.html', 'Montana | Checkout');
buildPage('contact.html', 'Montana | Contact us');
buildPage('about.html', 'Montana | About us');
buildPage('search.html', 'Montana | Search', 'mnt-shop mnt-en');
buildPage('faq.html', 'Montana | FAQ');
buildPage('account.html', 'Montana | My account');
buildPage('privacy.html', 'Montana | Privacy policy');
buildPage('tracking.html', 'Montana | Track order');
buildPage('returns.html', 'Montana | Returns');
buildPage('login.html', 'Montana | Sign in');
buildPage('terms.html', 'Montana | Terms');
buildPage('wishlist.html', 'Montana | Wishlist', 'mnt-shop mnt-en');
buildPage('order-confirmation.html', 'Montana | Order confirmed');
buildPage('ingredients.html', 'Montana | Ingredients');

const enFiles = fs.readdirSync(EN_DIR).filter((f) => f.endsWith('.html'));
let warnings = 0;
for (const file of enFiles) {
  const content = fs.readFileSync(path.join(EN_DIR, file), 'utf8');
  const remaining = findRemainingArabic(content, file);
  if (remaining.length) {
    console.warn(`⚠ ${file}: ${remaining.length} Arabic fragment(s) remain:`, remaining.slice(0, 8).join(', '));
    warnings++;
  }
}
console.log(`Built English pages in en/${warnings ? ` (${warnings} files need more mappings)` : ' — all clean'}`);
