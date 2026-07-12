const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'cleanser', img: 'p2.png', woman: 'bright radiant glowing skin, smiling confidently, touching her cheek' },
    { id: 'cream', img: 'p3.png', woman: 'even-toned bright skin, touching her neck elegantly' },
    { id: 'lotion', img: 'p4.png', woman: 'applying lotion on her arm, smooth hydrated glowing skin' },
    { id: 'laser', img: 'p5.png', woman: 'calm soothed perfect skin, peaceful expression, eyes closed' },
    { id: 'scar', img: 'p6.png', woman: 'flawless smooth skin, gently touching her face, gentle smile' },
];

async function gen(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const base64 = fs.readFileSync(path.join(__dirname, 'images', product.img)).toString('base64');

    const prompt = 'Take this exact product bottle. Create a premium skincare advertisement image in WIDE LANDSCAPE format (1400x500 pixels, very wide banner). The product bottle MUST be shown LARGE, COMPLETE and FULLY VISIBLE on the LEFT on white marble with gold accents. Beautiful young woman with ' + product.woman + ' on the RIGHT. Center area empty for text overlay later. Luxury spa bathroom background, warm golden lighting, purple theme. NO TEXT NO WORDS. MUST be wide landscape banner format.';

    const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: base64 } }
    ]);

    for (const p of result.response.candidates[0].content.parts) {
        if (p.inlineData) return Buffer.from(p.inlineData.data, 'base64');
    }
    return null;
}

async function main() {
    console.log('🎨 Generating remaining 5 banners...\n');

    for (const p of products) {
        console.log('📦 ' + p.id + '...');
        try {
            const buf = await gen(p);
            if (!buf) { console.log('  ❌ No image'); continue; }
            fs.writeFileSync(path.join(__dirname, 'images', 'hero-' + p.id + '.png'), buf);
            console.log('  ✅ hero-' + p.id + '.png (' + Math.round(buf.length/1024) + 'KB)');
        } catch(e) {
            console.log('  ❌ ' + e.message.substring(0, 150));
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n✅ Done!');
}

main();
