const fs = require('fs');

console.log('Reordering sections on index.html for maximum conversion...');

let html = fs.readFileSync('index.html', 'utf8');

// Identify sections:
// Section 4: Clinical Trust
// Section 5: Concerns
// Section 6: Routines
// Section 7: Catalog (Products)
// Section 8: Proof (Before & After)

const trustMatch = html.match(/<!-- 4\. CLINICAL TRUST BAR -->[\s\S]*?<\/section>/);
const concernsMatch = html.match(/<!-- 5\. SHOP BY CONCERN -->[\s\S]*?<\/section>/);
const routinesMatch = html.match(/<!-- 6\. SIGNATURE ROUTINES \(1-2-3 RITUALS\) -->[\s\S]*?<\/section>/);
const catalogMatch = html.match(/<!-- 7\. INDIVIDUAL PRODUCTS \(MONTANA AUTHENTIC BOTTLES\) -->[\s\S]*?<\/section>/);
const proofMatch = html.match(/<!-- 8\. REAL TRANSFORMATIONS \(BEFORE & AFTER\) -->[\s\S]*?<\/section>/);

if (trustMatch && concernsMatch && routinesMatch && catalogMatch && proofMatch) {
    const trust = trustMatch[0];
    const concerns = concernsMatch[0];
    const routines = routinesMatch[0];
    const catalog = catalogMatch[0];
    const proof = proofMatch[0];

    // New order:
    // 4. Clinical Trust
    // 5. Routines (Most requested bundles)
    // 6. Products (Individual products with 20% off)
    // 7. Concerns (Shop by concern guide)
    // 8. Proof (Before & After)
    
    const reorderedBlocks = trust + '\n\n' + routines + '\n\n' + catalog + '\n\n' + concerns + '\n\n' + proof;

    const fullOldBlock = html.substring(
        html.indexOf('<!-- 4. CLINICAL TRUST BAR -->'),
        html.indexOf('</section>', html.indexOf('<!-- 8. REAL TRANSFORMATIONS (BEFORE & AFTER) -->')) + 10
    );

    html = html.replace(fullOldBlock, reorderedBlocks);
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('Sections reordered successfully! Products & Routines are now front-and-center!');
} else {
    console.error('Could not match all sections');
}
