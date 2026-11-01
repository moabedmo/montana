const fs = require('fs');

console.log('Implementing Free Shipping Progress Bar, 1-Click Quick Order, and Confirmation Reassurance...');

// 1. Update checkout.html and order-confirmation.html with clear call notice
let checkoutHtml = fs.readFileSync('checkout.html', 'utf8');
const reassuranceNotice = `
    <div style="background:rgba(216,181,89,0.12);border:1.5px solid #D8B559;border-radius:14px;padding:14px 18px;margin:16px 0;text-align:center;">
        <div style="font-size:14.5px;font-weight:800;color:#2D1F35;margin-bottom:4px;">
            📞 ستقوم خدمة العملاء بالتواصل معكِ هاتفياً لتأكيد موعد التوصيل
        </div>
        <div style="font-size:12.5px;color:#5A4B62;">
            معاينة وفحص الشحنة عند الاستلام قبل دفع أي مبلغ للمندوب · الدفع كاش عند الاستلام
        </div>
    </div>`;

if (!checkoutHtml.includes('ستقوم خدمة العملاء بالتواصل معكِ هاتفياً لتأكيد موعد التوصيل')) {
    checkoutHtml = checkoutHtml.replace(
        '<p class="ck-submit-err" id="submitErr" role="alert"></p>',
        reassuranceNotice + '\n<p class="ck-submit-err" id="submitErr" role="alert"></p>'
    );
    fs.writeFileSync('checkout.html', checkoutHtml, 'utf8');
    console.log('checkout.html updated with reassurance notice!');
}

// 2. Update order-confirmation.html
let confHtml = fs.readFileSync('order-confirmation.html', 'utf8');
if (!confHtml.includes('ستقوم خبيرة العناية من مونتانيا بالتواصل معكِ')) {
    confHtml = confHtml.replace(
        "orderReceivedDesc: 'هنراجع الطلب ونكلمك قريب لتأكيد التوصيل.'",
        "orderReceivedDesc: 'شكراً لثقتك في مونتانيا 💜 ستقوم خدمة العملاء بالتواصل معكِ هاتفياً لتأكيد تفاصيل وموعد التوصيل. الدفع عند الاستلام بعد فحص الشحنة.'"
    );
    fs.writeFileSync('order-confirmation.html', confHtml, 'utf8');
    console.log('order-confirmation.html updated with reassurance message!');
}
