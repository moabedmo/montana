const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AQ.Ab8RN6I43FItX7Jx3GZo3-dUVr0FC4uPao865yLw8fr1b7v-8w';

const products = [
    { id: 'acne', img: 'p1.png', prompt: 'Premium skincare ad banner. Beautiful young woman washing her face with foam, clear fresh skin, on the RIGHT side. LEFT side has empty white marble surface with gold accents for product placement. CENTER area empty with soft blurred background for text. Luxury purple spa bathroom, warm golden lighting. Purple color theme. NO TEXT NO WORDS. Wide landscape banner.' },
    { id: 'cleanser', img: 'p2.png', prompt: 'Premium skincare ad banner. Beautiful young woman with bright radiant glowing skin smiling on the RIGHT side. LEFT side has empty white marble surface with gold accents for product placement. CENTER area empty. Luxury purple spa, warm golden lighting. Purple theme. NO TEXT. Wide landscape.' },
    { id: 'cream', img: 'p3.png', prompt: 'Premium skincare ad banner. Beautiful young woman touching her neck with even bright skin on the RIGHT side. LEFT side has empty white marble pedestal with gold accents for product placement. CENTER empty. Luxury purple bathroom, warm lighting. Purple theme. NO TEXT. Wide landscape.' },
    { id: 'lotion', img: 'p4.png', prompt: 'Premium skincare ad banner. Beautiful young woman applying lotion on her arm, smooth hydrated skin on the RIGHT side. LEFT side has empty white marble surface with gold accents for product placement. CENTER empty. Luxury purple spa, warm golden lighting. Purple theme. NO TEXT. Wide landscape.' },
    { id: 'laser', img: 'p5.png', prompt: 'Premium skincare ad banner. Beautiful young woman with calm soothed perfect skin, peaceful expression on the RIGHT side. LEFT side has empty white marble surface with gold accents for product placement. CENTER empty. Luxury calming spa, warm lighting. Purple theme. NO TEXT. Wide landscape.' },
    { id: 'scar', img: 'p6.png', prompt: 'Premium skincare ad banner. Beautiful young woman with flawless smooth skin gently touching her face on the RIGHT side. LEFT side has empty white marble surface with gold accents for product placement. CENTER empty. Luxury purple spa, warm golden lighting. Purple theme. NO TEXT. Wide landscape.' },
];

async function generateBackground(prompt) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=' + API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1, aspectRatio: '16:9', outputOptions: { mimeType: 'image/png' } }
        })
    });
    const data = await res.json();
    if (data.predictions && data.predictions[0].bytesBase64Encoded) {
        return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
    }
    throw new Error(JSON.stringify(data).substring(0, 200));
}

async function compositeProductOnBanner(bgBuffer, productImgPath, outputPath) {
    const bgMeta = await sharp(bgBuffer).metadata();

    // Resize product image - make it prominent, about 60% of banner height
    const productHeight = Math.floor(bgMeta.height * 0.75);
    const productImg = await sharp(productImgPath)
        .resize({ height: productHeight, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    const productMeta = await sharp(productImg).metadata();

    // Place product on the LEFT side, vertically centered
    const left = Math.floor(bgMeta.width * 0.06);
    const top = Math.floor((bgMeta.height - productMeta.height) / 2);

    await sharp(bgBuffer)
        .composite([{
            input: productImg,
            left: left,
            top: top,
            blend: 'over'
        }])
        .png()
        .toFile(outputPath);
}

async function main() {
    console.log('🖥️ Generating Widescreen Desktop Banners\n');

    for (const p of products) {
        console.log('📦 ' + p.id + ':');
        try {
            // Step 1: Generate widescreen background with Imagen
            console.log('  1. Generating widescreen background...');
            const bgBuf = await generateBackground(p.prompt);
            console.log('  ✅ Background ready (' + Math.round(bgBuf.length/1024) + 'KB)');

            // Step 2: Composite product image on top
            console.log('  2. Adding product...');
            const productPath = path.join(__dirname, 'images', p.img);
            const outputPath = path.join(__dirname, 'images', 'hero-' + p.id + '.png');
            await compositeProductOnBanner(bgBuf, productPath, outputPath);

            const finalSize = fs.statSync(outputPath).size;
            console.log('  ✅ hero-' + p.id + '.png (' + Math.round(finalSize/1024) + 'KB)\n');

        } catch(e) {
            console.log('  ❌ ' + e.message.substring(0, 150) + '\n');
        }

        await new Promise(r => setTimeout(r, 2000));
    }
    console.log('✅ All done!');
}

main();
