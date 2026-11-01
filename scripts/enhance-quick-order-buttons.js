const fs = require('fs');

console.log('Connecting 1-Click Quick Order buttons and auto-fill in checkout.html...');

// 1. Add auto-fill in checkout.html
let ck = fs.readFileSync('checkout.html', 'utf8');
const autoFillScript = `
<script>
document.addEventListener('DOMContentLoaded', () => {
    try {
        const raw = sessionStorage.getItem('qo_prefill');
        if (raw) {
            const data = JSON.parse(raw);
            if (data.name && document.getElementById('custName')) document.getElementById('custName').value = data.name;
            if (data.phone && document.getElementById('custPhone')) document.getElementById('custPhone').value = data.phone;
            if (data.addr && document.getElementById('custAddress')) document.getElementById('custAddress').value = data.addr;
            if (data.gov && document.getElementById('governorateSelect')) {
                const sel = document.getElementById('governorateSelect');
                const setGov = () => {
                    for (let i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value === data.gov || sel.options[i].text.includes(data.gov)) {
                            sel.selectedIndex = i;
                            sel.dispatchEvent(new Event('change'));
                            break;
                        }
                    }
                };
                setGov();
                setTimeout(setGov, 600);
            }
            sessionStorage.removeItem('qo_prefill');
        }
    } catch (_) {}
});
</script>
`;

if (!ck.includes('qo_prefill')) {
    ck = ck.replace('</body>', autoFillScript + '\n</body>');
    fs.writeFileSync('checkout.html', ck, 'utf8');
    console.log('checkout.html updated with prefill handler!');
}

// 2. Add Quick Order button to Routine cards in index.html and category.html
function addRoutineQoBtn(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Brightening
    content = content.replace(
        `onclick="handleOrderRoutine('brightening')"`,
        `onclick="handleOrderRoutine('brightening')"`
    );

    // Let's check routine footers
    content = content.replace(
        `<button class="btn-add-routine" onclick="handleOrderRoutine('brightening')">`,
        `<button class="btn-quick-order" onclick="openQuickOrder('روتين التفتيح والنضارة الكامل', 777, 'images/p2-premium.webp', 'brightening')"><i class="fas fa-bolt"></i> طلب سريع</button>\n                        <button class="btn-add-routine" onclick="handleOrderRoutine('brightening')">`
    );

    content = content.replace(
        `<button class="btn-add-routine" onclick="handleOrderRoutine('post-laser')">`,
        `<button class="btn-quick-order" onclick="openQuickOrder('روتين عناية وترميم ما بعد الليزر', 618, 'images/p5-premium.webp', 'post-laser')"><i class="fas fa-bolt"></i> طلب سريع</button>\n                        <button class="btn-add-routine" onclick="handleOrderRoutine('post-laser')">`
    );

    content = content.replace(
        `<button class="btn-add-routine" onclick="handleOrderRoutine('face-body')">`,
        `<button class="btn-quick-order" onclick="openQuickOrder('روتين نضارة الوجه وترطيب الجسم', 558, 'images/p1-premium.webp', 'face-body')"><i class="fas fa-bolt"></i> طلب سريع</button>\n                        <button class="btn-add-routine" onclick="handleOrderRoutine('face-body')">`
    );

    fs.writeFileSync(file, content, 'utf8');
    console.log(file + ' updated with Quick Order buttons on routines!');
}

addRoutineQoBtn('index.html');
addRoutineQoBtn('category.html');
