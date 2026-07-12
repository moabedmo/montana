const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';
const genAI = new GoogleGenerativeAI(API_KEY);

const products = [
    { id: 'acne', img: 'p1.png', desc: 'pump bottle with blue accents, tall bottle', woman: 'clear fresh skin, washing face' },
    { id: 'cleanser', img: 'p2.png', desc: 'pump bottle, tall purple bottle', woman: 'bright radiant glowing skin' },
    { id: 'cream', img: 'p3.png', desc: 'small jar/pot, compact bottle', woman: 'even-toned bright skin, touching neck' },
    { id: 'lotion', img: 'p4.png', desc: 'small bottle with gold accents', woman: 'applying cream on arm, smooth skin' },
    { id: 'laser', img: 'p5.png', desc: 'small compact bottle with pink label', woman: 'calm soothed skin, eyes closed' },
    { id: 'scar', img: 'p6.png', desc: 'small bottle with green accents', woman: 'flawless smooth skin, gentle smile' },
];

async function generate(product) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const imgData = fs.readFileSync(path.join(__dirname, 'images', product.img));
    const base64 = imgData.toString('base64');

    const prompt = `Create a premium skincare advertisement image using this exact product bottle.

CRITICAL RULES:
1. The product bottle MUST be shown LARGE, FULL, COMPLETE and CLEARLY VISIBLE - it is the HERO of the image. Show the ENTIRE bottle from cap to bottom, nothing cut off.
2. The product bottle should take up about 30-40% of the image height and be placed on the RIGHT side on a white marble pedestal/surface
3. A beautiful young woman on the LEFT side with ${product.woman}
4. The CENTER-LEFT area should be mostly EMPTY/CLEAN with just soft background - this space is reserved for text that will be added later
5. Luxury spa bathroom background with warm golden lighting, purple tones
6. Premium high-end quality like Dior or La Mer advertisements
7. ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS anywhere in the image
8. The image should be SQUARE format (1024x1024)
9. Purple brand color theme #9B6CB8
10. Make sure the product bottle is SHARP, IN FOCUS, and PROMINENT`;

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

async function main() {
    console.log('🎨 Montana Banner Generator v3');
    console.log('================================\n');

    for (const product of products) {
        console.log('📦 ' + product.id + ':');

        try {
            console.log('  Generating...');
            const raw = await generate(product);
            if (!raw) { console.log('  ❌ No image'); continue; }

            // Save raw square image first
            const rawPath = path.join(__dirname, 'images', 'raw-' + product.id + '.png');
            fs.writeFileSync(rawPath, raw);

            // Get actual dimensions
            const meta = await sharp(raw).metadata();
            console.log('  Raw: ' + meta.width + 'x' + meta.height);

            // Desktop 1400x500: take the CENTER-RIGHT portion (woman + product area)
            // Since text goes in center-left, we keep the full width and crop height from center
            const dCropTop = Math.floor(meta.height * 0.15);
            const dCropH = Math.floor(meta.height * 0.55);
            await sharp(raw)
                .extract({ left: 0, top: dCropTop, width: meta.width, height: dCropH })
                .resize(1400, 500, { fit: 'cover', position: 'center' })
                .png()
                .toFile(path.join(__dirname, 'images', 'hero-' + product.id + '-ar.png'));
            console.log('  ✅ hero-' + product.id + '-ar.png (1400x500)');

            // Same for English version (same image, text overlay will differ)
            fs.copyFileSync(
                path.join(__dirname, 'images', 'hero-' + product.id + '-ar.png'),
                path.join(__dirname, 'images', 'hero-' + product.id + '-en.png')
            );
            console.log('  ✅ hero-' + product.id + '-en.png (1400x500)');

            // Mobile 800x400: crop more centered, tighter
            const mCropTop = Math.floor(meta.height * 0.1);
            const mCropH = Math.floor(meta.height * 0.65);
            await sharp(raw)
                .extract({ left: 0, top: mCropTop, width: meta.width, height: mCropH })
                .resize(800, 400, { fit: 'cover', position: 'center' })
                .png()
                .toFile(path.join(__dirname, 'images', 'hero-' + product.id + '-mob.png'));
            console.log('  ✅ hero-' + product.id + '-mob.png (800x400)');

        } catch (e) {
            console.log('  ❌ ' + e.message.substring(0, 150));
        }

        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n✅ Done!');
}

main();
