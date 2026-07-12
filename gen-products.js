const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'p1', img: 'p1.png' },
    { id: 'p2', img: 'p2.png' },
    { id: 'p3', img: 'p3.png' },
    { id: 'p4', img: 'p4.png' },
    { id: 'p5', img: 'p5.png' },
    { id: 'p6', img: 'p6.png' },
];

async function gen(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const base64 = fs.readFileSync(path.join(__dirname, 'images', product.img)).toString('base64');

    const prompt = 'Take this exact product bottle. Do NOT change the bottle design at all. Remove the background and place the bottle on a premium luxury setting: soft flowing purple silk fabric background with elegant folds and waves. The bottle should be centered, LARGE, COMPLETE and FULLY VISIBLE from cap to bottom. Add soft studio lighting with gentle highlights and reflections on the bottle. Premium high-end product photography style. Square image 1024x1024. NO TEXT NO WORDS.';

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
    console.log('🎨 Generating premium product images...\n');

    for (const p of products) {
        console.log('📦 ' + p.id + '...');
        try {
            const buf = await gen(p);
            if (!buf) { console.log('  ❌ No image'); continue; }
            fs.writeFileSync(path.join(__dirname, 'images', p.id + '-premium.png'), buf);
            console.log('  ✅ ' + p.id + '-premium.png (' + Math.round(buf.length/1024) + 'KB)');
        } catch(e) {
            console.log('  ❌ ' + e.message.substring(0, 150));
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log('\n✅ Done!');
}

main();
