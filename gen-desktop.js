const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'acne', img: 'p1.png', woman: 'washing her face with foam, clear fresh skin' },
    { id: 'cleanser', img: 'p2.png', woman: 'bright radiant glowing skin, smiling confidently' },
    { id: 'cream', img: 'p3.png', woman: 'touching her neck, even-toned bright skin' },
    { id: 'lotion', img: 'p4.png', woman: 'applying lotion on her arm, smooth hydrated skin' },
    { id: 'laser', img: 'p5.png', woman: 'calm soothed perfect skin, peaceful expression' },
    { id: 'scar', img: 'p6.png', woman: 'flawless smooth skin, gently touching her face' },
];

async function gen(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const base64 = fs.readFileSync(path.join(__dirname, 'images', product.img)).toString('base64');

    const prompt = `Take this exact product bottle. Create a premium WIDE LANDSCAPE banner image. The image MUST be in WIDE SCREEN format - much wider than tall, like a cinema screen or website hero banner. Aspect ratio 2.8:1 or wider.

Layout:
- This EXACT product bottle shown LARGE and FULLY VISIBLE on the LEFT side on white marble surface with gold accents. Show the COMPLETE bottle from cap to bottom.
- Beautiful young woman with ${product.woman} on the RIGHT side
- The CENTER area should be EMPTY with soft blurred luxury background - this space is reserved for text overlay later
- Luxury spa/bathroom background with warm golden lighting
- Purple brand color theme #9B6CB8
- Premium high-end advertisement style like Dior or La Mer

CRITICAL:
- The image MUST be VERY WIDE and SHORT like a website banner, NOT square, NOT portrait
- NO TEXT, NO WORDS, NO LETTERS anywhere in the image
- The product bottle must be SHARP, CLEAR, COMPLETE and PROMINENT`;

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
    console.log('🖥️ Desktop Banners\n');

    for (const p of products) {
        console.log('📦 ' + p.id + '...');
        try {
            const buf = await gen(p);
            if (!buf) { console.log('  ❌ No image'); continue; }
            const outPath = path.join(__dirname, 'images', 'hero-' + p.id + '.png');
            fs.writeFileSync(outPath, buf);
            console.log('  ✅ hero-' + p.id + '.png (' + Math.round(buf.length/1024) + 'KB)');
        } catch(e) {
            console.log('  ❌ ' + e.message.substring(0, 100));
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n✅ Done!');
}

main();
