const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'acne', img: 'p1.png', woman: 'clear fresh skin, washing face with foam' },
    { id: 'cleanser', img: 'p2.png', woman: 'bright radiant glowing skin, smiling' },
    { id: 'cream', img: 'p3.png', woman: 'even-toned bright skin, touching her neck' },
    { id: 'lotion', img: 'p4.png', woman: 'applying lotion on arm, smooth hydrated skin' },
    { id: 'laser', img: 'p5.png', woman: 'calm soothed perfect skin, peaceful expression' },
    { id: 'scar', img: 'p6.png', woman: 'flawless smooth skin, gentle smile touching face' },
];

async function gen(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const base64 = fs.readFileSync(path.join(__dirname, 'images', product.img)).toString('base64');

    const prompt = `Take this exact product bottle. Do NOT change the bottle at all. Create a premium luxury skincare advertisement image:

- This EXACT product bottle MUST be shown COMPLETELY - full bottle from top to bottom, LARGE and PROMINENT, placed on the LEFT side on a white marble surface with gold accents
- Beautiful young woman with ${product.woman} on the RIGHT side
- The CENTER area should be EMPTY with soft blurred background - this space is for text overlay later
- Luxury spa background, warm golden lighting
- Purple brand color theme
- NO TEXT, NO WORDS, NO LETTERS anywhere
- Premium high-end advertisement like Dior or La Mer`;

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
    console.log('🎨 Generating banners...\n');

    for (const p of products) {
        console.log('📦 ' + p.id + '...');
        try {
            const buf = await gen(p);
            if (!buf) { console.log('  ❌ No image'); continue; }

            // Save as-is, NO cropping, NO resizing
            fs.writeFileSync(path.join(__dirname, 'images', 'hero-' + p.id + '.png'), buf);
            console.log('  ✅ hero-' + p.id + '.png (' + Math.round(buf.length/1024) + 'KB)');
        } catch(e) {
            console.log('  ❌ ' + e.message.substring(0, 100));
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n✅ Done!');
}

main();
