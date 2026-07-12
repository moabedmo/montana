const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'scar', image: 'images/p6.png', desc: 'Anti-scar silicone gel for treating old and new scars' },
    { id: 'cleanser', image: 'images/p2.png', desc: 'Whitening cleanser with licorice extract for brightening skin' },
    { id: 'cream', image: 'images/p3.png', desc: 'Whitening cream with alpha-arbutin for even skin tone' },
    { id: 'lotion', image: 'images/p4.png', desc: 'Hand and body lotion, 72-hour hydration, non-greasy' },
    { id: 'laser', image: 'images/p5.png', desc: 'Post laser cream with sesame oil for skin recovery' },
    { id: 'acne', image: 'images/p1.png', desc: 'Acne facial cleanser with argan and jojoba oil for oily skin' },
];

async function generateBanner(product, size) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const imageData = fs.readFileSync(path.join(__dirname, product.image));
    const base64 = imageData.toString('base64');

    const isDesktop = size === 'desktop';
    const layout = isDesktop
        ? 'Very wide horizontal landscape banner (3:1 aspect ratio). Beautiful young woman with flawless glowing skin on the right side of the image. Product bottle on the left side placed on a white marble surface with gold accents. Luxury spa/bathroom background.'
        : 'Wide horizontal banner (2:1 aspect ratio). Compact layout. Product on right side, beautiful woman on left side. Luxury background.';

    const prompt = `Take this exact product bottle (${product.desc}). Do NOT change the bottle design at all. Create a premium skincare advertisement image with NO TEXT, NO WORDS, NO LETTERS, NO WRITING at all - completely text-free image. ${layout} Warm golden soft lighting. Purple brand color theme. Premium high-end luxury feel like La Mer or SK-II ads. The image must be VERY WIDE and SHORT like a website banner. IMPORTANT: Absolutely NO text or writing anywhere in the image.`;

    console.log(`  Generating: ${product.id} - ${size}...`);

    try {
        const result = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: base64 } }
        ]);

        const parts = result.response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                const outputName = `banner-${product.id}-${size}.png`;
                const outputPath = path.join(__dirname, 'images', outputName);
                const imgBuffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(outputPath, imgBuffer);
                console.log(`  ✅ Saved: images/${outputName} (${(imgBuffer.length / 1024).toFixed(0)}KB)`);
                return outputName;
            }
        }
        console.log(`  ⚠️ No image returned`);
        return null;
    } catch (err) {
        console.log(`  ❌ Error: ${err.message.substring(0, 200)}`);
        return null;
    }
}

async function main() {
    console.log('🎨 Montana Clean Banner Generator (NO TEXT)');
    console.log('============================================\n');

    let generated = 0, failed = 0;

    for (const product of products) {
        console.log(`\n📦 ${product.id}:`);

        for (const size of ['desktop', 'mobile']) {
            const result = await generateBanner(product, size);
            if (result) generated++; else failed++;
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n============================================`);
    console.log(`✅ Generated: ${generated} / ${generated + failed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Saved in: images/`);
}

main();
