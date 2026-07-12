const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'acne', img: 'p1.png', nameAr: 'غسول الوجه لعلاج حب الشباب', nameEn: 'Acne Facial Cleanser', woman: 'washing her face with foam, fresh clean look' },
    { id: 'cleanser', img: 'p2.png', nameAr: 'غسول التفتيح والتوحيد', nameEn: 'Whitening Cleanser', woman: 'bright radiant glowing skin, smiling confidently' },
    { id: 'cream', img: 'p3.png', nameAr: 'كريم التفتيح بالألفا أربوتين', nameEn: 'Whitening Cream', woman: 'touching her neck, even-toned bright skin' },
    { id: 'lotion', img: 'p4.png', nameAr: 'لوشن اليدين والجسم', nameEn: 'Hand & Body Lotion', woman: 'applying lotion on her arm, smooth hydrated skin' },
    { id: 'laser', img: 'p5.png', nameAr: 'كريم ما بعد الليزر', nameEn: 'Post Laser Cream', woman: 'calm peaceful expression, soothed perfect skin' },
    { id: 'scar', img: 'p6.png', nameAr: 'جل السيليكون لعلاج الندبات', nameEn: 'Anti-Scar Silicone Gel', woman: 'touching her face gently, flawless smooth skin' },
];

async function generateBanner(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const imgData = fs.readFileSync(path.join(__dirname, 'images', product.img));
    const base64 = imgData.toString('base64');

    const prompt = `Take this exact product bottle. Do NOT change the bottle design at all. Create a premium luxury skincare advertisement image. Beautiful young woman with ${product.woman} on the right side. This exact product bottle on the left side placed on a white marble surface with gold accents. Soft warm golden lighting, elegant luxury spa bathroom background. Purple brand color theme. Premium high-end style like La Mer or SK-II ads. NO TEXT, NO WORDS, NO LETTERS anywhere. Clean image only.`;

    console.log('  Generating image...');
    const result = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType: 'image/png', data: base64 } }
    ]);

    const parts = result.response.candidates[0].content.parts;
    for (const p of parts) {
        if (p.inlineData) {
            return Buffer.from(p.inlineData.data, 'base64');
        }
    }
    return null;
}

async function cropAndSave(buffer, outputName, width, height, cropTop, cropHeight) {
    await sharp(buffer)
        .extract({ left: 0, top: cropTop, width: 1024, height: cropHeight })
        .resize(width, height, { fit: 'cover' })
        .png({ quality: 90 })
        .toFile(path.join(__dirname, 'images', outputName));

    const stats = fs.statSync(path.join(__dirname, 'images', outputName));
    console.log('  ✅ ' + outputName + ' (' + width + 'x' + height + ', ' + Math.round(stats.size/1024) + 'KB)');
}

async function main() {
    console.log('🎨 Montana Banner Generator v2');
    console.log('================================\n');

    let success = 0;
    let failed = 0;

    for (const product of products) {
        console.log('📦 ' + product.nameEn + ':');

        try {
            const rawBuffer = await generateBanner(product);
            if (!rawBuffer) {
                console.log('  ❌ No image returned');
                failed++;
                continue;
            }

            console.log('  🔄 Cropping to banner sizes...');

            // Desktop: 1400x500 - crop middle horizontal band
            await cropAndSave(rawBuffer, 'hero-' + product.id + '-desktop.png', 1400, 500, 200, 400);

            // Mobile: 800x400 - crop center area
            await cropAndSave(rawBuffer, 'hero-' + product.id + '-mobile.png', 800, 400, 180, 500);

            success++;
        } catch (e) {
            console.log('  ❌ Error: ' + e.message.substring(0, 150));
            failed++;
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n================================');
    console.log('✅ Success: ' + success + '/' + products.length);
    console.log('❌ Failed: ' + failed);
    console.log('📁 Files in: images/');
}

main();
