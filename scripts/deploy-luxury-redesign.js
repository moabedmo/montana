const fs = require('fs');

console.log('Writing production index.html and category.html...');

// 1. Prepare index.html from preview.html
let indexContent = fs.readFileSync('preview.html', 'utf8');

// Replace preview links with production links
indexContent = indexContent.replace(/preview-shop\.html/g, 'category.html');
indexContent = indexContent.replace(/preview\.html/g, 'index.html');
indexContent = indexContent.replace(/<title>.*?<\/title>/, '<title>Montaña Naturals — العناية الفاخرة بالبشرة | نتائج سريرية مثبتة</title>');

// Inject required production Meta Pixel and SEO tags if not already present
const prodMeta = `    <meta name="facebook-domain-verification" content="gh2uosxlksarsyhjtg4jwdjfievnyj" />
    <link rel="canonical" href="https://www.montana.com.eg/">
    <meta property="og:title" content="Montaña Naturals — العناية الفاخرة بالبشرة">
    <meta property="og:description" content="تركيبات متطورة مصرحة من وزارة الصحة المصرية لعلاج التصبغات، حب الشباب، وترميم البشرة.">
    <meta property="og:url" content="https://www.montana.com.eg/">
    <meta property="og:image" content="https://www.montana.com.eg/images/hero-banner-clean.webp">
    <script src="js/analytics-config.js"></script>
    <script src="js/meta-pixel.js?v=16"></script>
    <script src="js/metaEvents.js?v=17"></script>
    <script src="js/analytics.js" defer></script>
    <script src="js/perf.js?v=2" defer></script>
    <script src="js/seo.js" defer></script>`;

if (!indexContent.includes('gh2uosxlksarsyhjtg4jwdjfievnyj')) {
    indexContent = indexContent.replace('<head>', '<head>\n' + prodMeta);
}

fs.writeFileSync('index.html', indexContent, 'utf8');
console.log('index.html written successfully!');

// 2. Prepare category.html from preview-shop.html
let shopContent = fs.readFileSync('preview-shop.html', 'utf8');
shopContent = shopContent.replace(/preview-shop\.html/g, 'category.html');
shopContent = shopContent.replace(/preview\.html/g, 'index.html');
shopContent = shopContent.replace(/<title>.*?<\/title>/, '<title>Montaña Naturals | المتجر — العناية الفاخرة بالبشرة</title>');

const shopMeta = `    <meta name="facebook-domain-verification" content="gh2uosxlksarsyhjtg4jwdjfievnyj" />
    <link rel="canonical" href="https://www.montana.com.eg/category.html">
    <script src="js/analytics-config.js"></script>
    <script src="js/meta-pixel.js?v=16"></script>
    <script src="js/metaEvents.js?v=17"></script>
    <script src="js/analytics.js" defer></script>
    <script src="js/perf.js?v=2" defer></script>
    <script src="js/seo.js" defer></script>`;

if (!shopContent.includes('gh2uosxlksarsyhjtg4jwdjfievnyj')) {
    shopContent = shopContent.replace('<head>', '<head>\n' + shopMeta);
}

fs.writeFileSync('category.html', shopContent, 'utf8');
console.log('category.html written successfully!');
