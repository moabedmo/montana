const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    {
        id: 'scar',
        image: 'images/p6.png',
        nameEn: 'Anti-Scar Silicone Gel',
        nameAr: 'جل السيليكون لعلاج الندبات',
        subtextEn: 'Treats Old & New Scars - Visible Results',
        subtextAr: 'يعالج الندبات القديمة والجديدة - نتائج مذهلة',
    },
    {
        id: 'cleanser',
        image: 'images/p2.png',
        nameEn: 'Whitening Cleanser',
        nameAr: 'غسول التفتيح والتوحيد',
        subtextEn: 'With Licorice Extract - Cleanses, Unifies & Illuminates',
        subtextAr: 'بخلاصة العرقسوس - ينظف ويوحد ويُنير بشرتك',
    },
    {
        id: 'cream',
        image: 'images/p3.png',
        nameEn: 'Whitening Cream',
        nameAr: 'كريم التفتيح بالألفا أربوتين',
        subtextEn: 'Instant Bright - Alpha-Arbutin & Vitamin C',
        subtextAr: 'تفتيح فوري - للوجه والرقبة والمناطق الحساسة',
    },
    {
        id: 'lotion',
        image: 'images/p4.png',
        nameEn: 'Hand & Body Lotion',
        nameAr: 'لوشن اليدين والجسم',
        subtextEn: '72-Hour Hydration - Non-Greasy - For All Skin Types',
        subtextAr: 'ترطيب 72 ساعة - غير دهني - لجميع أنواع البشرة',
    },
    {
        id: 'laser',
        image: 'images/p5.png',
        nameEn: 'Post Laser Cream',
        nameAr: 'كريم ما بعد الليزر',
        subtextEn: 'With Sesame Oil & Green Tea - Smoothes, Heals & Repairs',
        subtextAr: 'بزيت السمسم والشاي الأخضر - يهدئ ويعالج ويصلح',
    },
    {
        id: 'acne',
        image: 'images/p1.png',
        nameEn: 'Acne Facial Cleanser',
        nameAr: 'غسول الوجه لعلاج حب الشباب',
        subtextEn: 'With Argan & Jojoba Oil - Clear Skin in 14 Days',
        subtextAr: 'بزيت الأرجان والجوجوبا - نتيجة في 14 يوم',
    },
];

async function generateBanner(product, lang, size) {
    const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash-image',
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        });

    const imageData = fs.readFileSync(path.join(__dirname, product.image));
    const base64 = imageData.toString('base64');
    const mimeType = 'image/png';

    const isDesktop = size === 'desktop';
    const isEn = lang === 'en';
    const dims = isDesktop ? '1400x500' : '800x400';
    const name = isEn ? product.nameEn : product.nameAr;
    const sub = isEn ? product.subtextEn : product.subtextAr;
    const layout = isDesktop
        ? 'Wide landscape banner. Beautiful woman with glowing skin on right, product on left on marble surface with gold accents.'
        : 'Compact mobile banner. Product on right, woman on left.';

    const prompt = `Take this exact product bottle. Do NOT change the bottle at all. Create a VERY WIDE horizontal premium skincare ad banner. The image MUST be much wider than tall - landscape orientation, aspect ratio approximately 3:1 for desktop or 2:1 for mobile. ${layout} ${isEn ? 'English' : 'Arabic'} text headline: "${name}", subtext: "${sub}". Brand "MONTAÑA" visible. Luxury purple #9B6CB8 theme, warm golden lighting, spa background. Premium high-end style. IMPORTANT: Make the image very wide and short, like a website banner.`;

    console.log(`  Generating: ${product.id} - ${lang} - ${size}...`);

    try {
        const result = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType, data: base64 } }
        ]);

        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData) {
                const outputName = `banner-${product.id}-${size}-${lang}.png`;
                const outputPath = path.join(__dirname, 'images', outputName);
                const imgBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imgBuffer);
                console.log(`  ✅ Saved: images/${outputName} (${(imgBuffer.length/1024).toFixed(0)}KB)`);
                return outputName;
            }
        }

        console.log(`  ⚠️ No image in response for ${product.id}-${size}-${lang}. Response text: ${parts.map(p => p.text || '').join('').substring(0, 100)}`);
        return null;
    } catch (err) {
        console.log(`  ❌ Error: ${err.message.substring(0, 150)}`);
        return null;
    }
}

async function main() {
    console.log('🎨 Montana Banner Generator');
    console.log('===========================\n');

    const versions = [
        { lang: 'en', size: 'desktop' },
        { lang: 'ar', size: 'desktop' },
        { lang: 'en', size: 'mobile' },
        { lang: 'ar', size: 'mobile' },
    ];

    let generated = 0;
    let failed = 0;

    for (const product of products) {
        console.log(`\n📦 ${product.nameEn}:`);

        for (const v of versions) {
            const result = await generateBanner(product, v.lang, v.size);
            if (result) generated++;
            else failed++;

            // Rate limit
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    console.log(`\n===========================`);
    console.log(`✅ Generated: ${generated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Saved in: images/`);
}

main();
