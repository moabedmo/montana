const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'images', 'amazon-gallery');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function fileToBase64(rel) {
  const p = path.join(__dirname, '..', rel);
  if (!fs.existsSync(p)) return '';
  const ext = path.extname(p).slice(1);
  const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

const p1Img = fileToBase64('images/p1.png');
const p2Img = fileToBase64('images/p2.png');
const logoImg = fileToBase64('images/logo.png');

const SLIDES = [
  // 1. Cleanser - Ingredients
  {
    filename: 'cleanser_02_ingredients.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FAF8F5 0%, #FFFFFF 50%, #F5F1EB 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            position: relative;
            overflow: hidden;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand {
            font-size: 38px;
            font-weight: 800;
            letter-spacing: 2px;
            color: #9275A4;
            text-transform: uppercase;
          }
          .badge {
            background: #9275A4;
            color: #fff;
            padding: 12px 28px;
            border-radius: 50px;
            font-size: 24px;
            font-weight: 700;
          }
          .title-section h1 {
            font-size: 56px;
            font-weight: 900;
            color: #2D2727;
            margin-bottom: 16px;
            line-height: 1.2;
          }
          .title-section p {
            font-size: 28px;
            color: #6E6259;
            font-weight: 500;
          }
          .content-body {
            display: flex;
            flex: 1;
            align-items: center;
            justify-content: space-between;
            margin-top: 20px;
          }
          .product-col {
            width: 42%;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
          }
          .product-glow {
            position: absolute;
            width: 480px;
            height: 480px;
            background: radial-gradient(circle, rgba(216, 181, 89, 0.25) 0%, rgba(146, 117, 164, 0.15) 50%, transparent 70%);
            border-radius: 50%;
            z-index: 1;
          }
          .product-col img {
            max-height: 850px;
            max-width: 100%;
            object-fit: contain;
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 25px 35px rgba(0,0,0,0.18));
          }
          .items-col {
            width: 55%;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .card {
            background: #FFFFFF;
            border: 1.5px solid #EBE4DA;
            border-radius: 24px;
            padding: 26px 32px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.04);
            display: flex;
            align-items: center;
            gap: 24px;
          }
          .card-icon {
            width: 75px;
            height: 75px;
            border-radius: 20px;
            background: #F6F2EC;
            color: #9275A4;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            font-weight: 800;
            flex-shrink: 0;
            border: 2px solid #E5DCD0;
          }
          .card-text h3 {
            font-size: 30px;
            font-weight: 800;
            color: #2D2727;
            margin-bottom: 6px;
          }
          .card-text p {
            font-size: 22px;
            color: #665C54;
            line-height: 1.4;
          }
          .footer-strip {
            margin-top: 30px;
            padding-top: 25px;
            border-top: 2px solid #EAE3D9;
            display: flex;
            justify-content: space-around;
            color: #8C7B70;
            font-size: 22px;
            font-weight: 700;
          }
          .footer-item { display: flex; align-items: center; gap: 10px; }
          .check { color: #388E3C; font-size: 26px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">المكونات الفعالة السريرية</div>
        </div>

        <div class="title-section">
          <h1>تركيبة خماسية متطورة للتفتيح والنضارة</h1>
          <p>مكونات طبية طبيعية منتقاة بعناية لتوحيد لون البشرة واستعادة إشراقتها</p>
        </div>

        <div class="content-body">
          <div class="product-col">
            <div class="product-glow"></div>
            <img src="${p1Img}" alt="Montana Brightening Cleanser">
          </div>

          <div class="items-col">
            <div class="card">
              <div class="card-icon">1</div>
              <div class="card-text">
                <h3>خلاصة العرقسوس الطبيعي (Licorice)</h3>
                <p>يقلل إنتاج صبغة الميلانين ويزيل التصبغات والبقع الداكنة بأمان تام.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">2</div>
              <div class="card-text">
                <h3>النياسيناميد النقي (Niacinamide)</h3>
                <p>يوحد لون البشرة، يضيق المسام الواسعة، ويقوي حاجز الجلد الواقي.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">3</div>
              <div class="card-text">
                <h3>فيتامين C المركز (Vitamin C)</h3>
                <p>مضاد أكسدة قوي يمنح البشرة نضارة فورية وإشراقة طبيعية تدوم.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">4</div>
              <div class="card-text">
                <h3>حمض الساليسيليك الطبيعي (Salicylic Acid)</h3>
                <p>تقشير لطيف يزيل الجلد الميت وينظف المسام بعمق لمنع الرؤوس السوداء.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-strip">
          <div class="footer-item"><span class="check">✔</span> خالي من البارابين</div>
          <div class="footer-item"><span class="check">✔</span> خالي من الكبريتات الضارة</div>
          <div class="footer-item"><span class="check">✔</span> متوازن الحموضة (pH 5.5)</div>
          <div class="footer-item"><span class="check">✔</span> مصرح ومسجل طبياً</div>
        </div>
      </body>
      </html>
    `,
  },

  // 2. Cleanser - Multi-Zone & Benefits
  {
    filename: 'cleanser_03_benefits.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FFFFFF 0%, #FAF8F5 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand { font-size: 38px; font-weight: 800; color: #9275A4; }
          .badge { background: #D8B559; color: #2D2727; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 800; }
          .title-section h1 { font-size: 54px; font-weight: 900; margin-bottom: 16px; }
          .title-section p { font-size: 28px; color: #6E6259; }
          
          .grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 35px;
            margin-top: 50px;
            flex: 1;
          }
          .grid-card {
            background: #FFFFFF;
            border: 2px solid #EBE4DA;
            border-radius: 28px;
            padding: 45px 40px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .grid-badge {
            align-self: flex-start;
            background: #F3EEF5;
            color: #9275A4;
            padding: 8px 20px;
            border-radius: 12px;
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 20px;
          }
          .grid-card h3 { font-size: 34px; font-weight: 900; margin-bottom: 14px; color: #2D2727; }
          .grid-card p { font-size: 24px; color: #665C54; line-height: 1.5; }

          .footer-strip {
            margin-top: 30px;
            padding-top: 25px;
            border-top: 2px solid #EAE3D9;
            display: flex;
            justify-content: space-around;
            color: #8C7B70;
            font-size: 24px;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">فوائد متعددة 3 في 1</div>
        </div>

        <div class="title-section">
          <h1>عناية فائقة وتفتيح شامل للوجه والجسم</h1>
          <p>مصمم لجميع أنواع البشرة لتوفير تنظيف عميق وتفتيح لطيف دون أي جفاف</p>
        </div>

        <div class="grid-container">
          <div class="grid-card">
            <div class="grid-badge">تفتيح متكامل</div>
            <h3>تفتيح الوجه والمناطق الحساسة</h3>
            <p>تركيبة لطيفة وآمنة تماماً على منطقة البكيني وتحت الإبط والرقبة، تزيل الاسمرار الناتج عن الاحتكاك والشمس.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">تنظيف عميق</div>
            <h3>تنقية المسام ومحاربة الدهون</h3>
            <p>ينظف بعمق ليزيل الشوائب والمكياج والدهون الزائدة دون أن يجرد البشرة من زيوتها الطبيعية الواقية.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">ترطيب ونعومة</div>
            <h3>ملمس حريري بدون شد أو جفاف</h3>
            <p>معزز بزيت اللوز وجنين القمح لترك البشرة رطبة وناعمة ومشرقة بعد كل غسيل.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">أمان معتمد</div>
            <h3>مناسب للبشرة شديدة التحسس</h3>
            <p>بتركيبة متوازنة الحموضة وخالية من الصابون القاسي والعطور النفاذة، مثالي للاستخدام اليومي المستمر.</p>
          </div>
        </div>

        <div class="footer-strip">
          <div>عبوة اقتصادية 200 مل</div>
          <div>•</div>
          <div>للاستخدام الصباحي والمسائي</div>
          <div>•</div>
          <div>نتائج ملحوظة من أول أسبوعين</div>
        </div>
      </body>
      </html>
    `,
  },

  // 3. Cleanser - How to Use
  {
    filename: 'cleanser_04_how_to_use.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FAF8F5 0%, #FFFFFF 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand { font-size: 38px; font-weight: 800; color: #9275A4; }
          .badge { background: #436697; color: #fff; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 700; }
          .title-section h1 { font-size: 54px; font-weight: 900; margin-bottom: 16px; }
          .title-section p { font-size: 28px; color: #6E6259; }

          .steps-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
            margin-top: 50px;
            flex: 1;
            justify-content: center;
          }
          .step-card {
            background: #FFFFFF;
            border: 2px solid #EBE4DA;
            border-radius: 28px;
            padding: 35px 45px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.04);
            display: flex;
            align-items: center;
            gap: 35px;
          }
          .step-num {
            width: 85px;
            height: 85px;
            border-radius: 50%;
            background: linear-gradient(135deg, #9275A4, #735386);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            font-weight: 900;
            flex-shrink: 0;
            box-shadow: 0 8px 18px rgba(146, 117, 164, 0.35);
          }
          .step-content h3 { font-size: 32px; font-weight: 800; margin-bottom: 8px; color: #2D2727; }
          .step-content p { font-size: 24px; color: #665C54; line-height: 1.5; }

          .routine-box {
            background: #F7F3EE;
            border-radius: 24px;
            padding: 30px 40px;
            margin-top: 25px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1.5px dashed #D8C8B5;
          }
          .routine-text h4 { font-size: 26px; font-weight: 800; color: #2D2727; margin-bottom: 6px; }
          .routine-text p { font-size: 22px; color: #665C54; }
          .routine-pill { background: #9275A4; color: #fff; padding: 10px 24px; border-radius: 50px; font-size: 20px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">دليل الاستخدام والروتين</div>
        </div>

        <div class="title-section">
          <h1>طريقة الاستخدام للحصول على أفضل النتائج</h1>
          <p>خطوات بسيطة وسريعة لروتينك اليومي صباحاً ومساءً</p>
        </div>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-content">
              <h3>التبليل بالماء الفاتر</h3>
              <p>بللي وجهك أو المنطقة المستهدفة (الرقبة، الإبط، أو المنطقة الحساسة) بماء فاتر لفتح المسام برفق.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-content">
              <h3>التدليك الدائري لمدة 60 ثانية</h3>
              <p>ضعي ضخة أو ضختين من الغسول، ودلكي بحركات دائرية لطيفة لمدة دقيقة لتسمحي للمكونات الفعالة بالتغلغل.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-content">
              <h3>الشطف والتجفيف اللطيف</h3>
              <p>اشطفي جيداً بالماء الفاتر وجففي بشرتك بطريقة الطبطبة بمنشفة قطنية ناعمة ونظيفة.</p>
            </div>
          </div>
        </div>

        <div class="routine-box">
          <div class="routine-text">
            <h4>💡 نصيحة الخبراء لمضاعفة النتيجة:</h4>
            <p>استخدمي كريم مونتانا للتفتيح مباشرة بعد الغسول لتثبيت التفتيح والترطيب العميق.</p>
          </div>
          <div class="routine-pill">روتين التفتيح المزدوج</div>
        </div>
      </body>
      </html>
    `,
  },

  // 4. Whitening Cream - Ingredients & Action
  {
    filename: 'cream_02_ingredients.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FAF8F5 0%, #FFFFFF 50%, #F5F1EB 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand { font-size: 38px; font-weight: 800; color: #9275A4; }
          .badge { background: #9275A4; color: #fff; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 700; }
          .title-section h1 { font-size: 56px; font-weight: 900; margin-bottom: 16px; }
          .title-section p { font-size: 28px; color: #6E6259; }

          .content-body {
            display: flex;
            flex: 1;
            align-items: center;
            justify-content: space-between;
            margin-top: 20px;
          }
          .product-col {
            width: 42%;
            display: flex;
            justify-content: center;
            align-items: center;
            position: relative;
          }
          .product-glow {
            position: absolute;
            width: 480px;
            height: 480px;
            background: radial-gradient(circle, rgba(216, 181, 89, 0.25) 0%, rgba(146, 117, 164, 0.15) 50%, transparent 70%);
            border-radius: 50%;
            z-index: 1;
          }
          .product-col img {
            max-height: 800px;
            max-width: 100%;
            object-fit: contain;
            position: relative;
            z-index: 2;
            filter: drop-shadow(0 25px 35px rgba(0,0,0,0.18));
          }
          .items-col {
            width: 55%;
            display: flex;
            flex-direction: column;
            gap: 24px;
          }
          .card {
            background: #FFFFFF;
            border: 1.5px solid #EBE4DA;
            border-radius: 24px;
            padding: 26px 32px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.04);
            display: flex;
            align-items: center;
            gap: 24px;
          }
          .card-icon {
            width: 75px;
            height: 75px;
            border-radius: 20px;
            background: #F6F2EC;
            color: #9275A4;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            font-weight: 800;
            flex-shrink: 0;
            border: 2px solid #E5DCD0;
          }
          .card-text h3 { font-size: 30px; font-weight: 800; margin-bottom: 6px; }
          .card-text p { font-size: 22px; color: #665C54; line-height: 1.4; }

          .footer-strip {
            margin-top: 30px;
            padding-top: 25px;
            border-top: 2px solid #EAE3D9;
            display: flex;
            justify-content: space-around;
            color: #8C7B70;
            font-size: 22px;
            font-weight: 700;
          }
          .check { color: #388E3C; font-size: 26px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">التركيبة السريرية المكثفة</div>
        </div>

        <div class="title-section">
          <h1>تركيبة علاجية متطورة لإزالة البقع والكلف</h1>
          <p>تعمل في عمق طبقات الجلد لتثبيط التصبغات وتوحيد لون البشرة</p>
        </div>

        <div class="content-body">
          <div class="product-col">
            <div class="product-glow"></div>
            <img src="${p2Img}" alt="Montana Whitening Cream">
          </div>

          <div class="items-col">
            <div class="card">
              <div class="card-icon">✨</div>
              <div class="card-text">
                <h3>تثبيط صبغة الميلانين</h3>
                <p>يوقف إفراز الصبغة الزائدة من المصدر لمنع ظهور بقع داكنة جديدة وتفتيح القديمة.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">⚡</div>
              <div class="card-text">
                <h3>سريع الامتصاص وغير دهني</h3>
                <p>قوام خفيف كالحرير تمتصه البشرة في ثوانٍ دون أن يترك أي أثر دهني أو لمعان مزعج.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🌿</div>
              <div class="card-text">
                <h3>ترطيب وتجديد الخلايا</h3>
                <p>غني بمضادات الأكسدة ومجددات الخلايا لاستعادة نضارة البشرة وحمايتها من الإجهاد.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🛡️</div>
              <div class="card-text">
                <h3>خالي من الهيدروكينون</h3>
                <p>تفتيح طبي آمن 100% بدون أي مواد كيميائية حارقة أو مسببة للتحسس والالتهابات.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-strip">
          <div><span class="check">✔</span> خالي من الهيدروكينون</div>
          <div><span class="check">✔</span> خالي من البارابين</div>
          <div><span class="check">✔</span> مناسب لجميع أنواع البشرة</div>
          <div><span class="check">✔</span> عبوة 50 مل مركّزة</div>
        </div>
      </body>
      </html>
    `,
  },

  // 5. Whitening Cream - Application Areas
  {
    filename: 'cream_03_areas.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FFFFFF 0%, #FAF8F5 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand { font-size: 38px; font-weight: 800; color: #9275A4; }
          .badge { background: #D8B559; color: #2D2727; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 800; }
          .title-section h1 { font-size: 54px; font-weight: 900; margin-bottom: 16px; }
          .title-section p { font-size: 28px; color: #6E6259; }

          .grid-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 35px;
            margin-top: 50px;
            flex: 1;
          }
          .grid-card {
            background: #FFFFFF;
            border: 2px solid #EBE4DA;
            border-radius: 28px;
            padding: 45px 40px;
            box-shadow: 0 12px 30px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .grid-badge {
            align-self: flex-start;
            background: #F3EEF5;
            color: #9275A4;
            padding: 8px 20px;
            border-radius: 12px;
            font-size: 22px;
            font-weight: 800;
            margin-bottom: 20px;
          }
          .grid-card h3 { font-size: 34px; font-weight: 900; margin-bottom: 14px; color: #2D2727; }
          .grid-card p { font-size: 24px; color: #665C54; line-height: 1.5; }

          .footer-strip {
            margin-top: 30px;
            padding-top: 25px;
            border-top: 2px solid #EAE3D9;
            display: flex;
            justify-content: space-around;
            color: #8C7B70;
            font-size: 24px;
            font-weight: 800;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">تطبيق آمن وفعال</div>
        </div>

        <div class="title-section">
          <h1>تفتيح آمن لجميع المناطق الداكنة بالجسم</h1>
          <p>تركيبة لطيفة متخصصة تم اختبارها لتناسب أدق وأحساس مناطق البشرة</p>
        </div>

        <div class="grid-container">
          <div class="grid-card">
            <div class="grid-badge">الوجه والرقبة</div>
            <h3>علاج الكلف وآثار الحبوب</h3>
            <p>يزيل التصبغات الشمسية، كلف الحمل، والآثار الناتجة عن الحبوب القديمة ليوحد لون الوجه بالكامل.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">المناطق الحساسة</div>
            <h3>منطقة البكيني وتحت الإبط</h3>
            <p>يعالج الاسمرار الناتج عن الاحتكاك وطرق إزالة الشعر بدون أي تهيج أو احمرار بفضل مكوناته المهدئة.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">الجسم</div>
            <h3>الركب والأكواع والمفاصل</h3>
            <p>يخترق طبقات الجلد السميكة في المفاصل لتقشير الخلايا الخشنة وتفتيح السواد بفاعلية ملحوظة.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">اليدين والقدمين</div>
            <h3>آثار اسمرار الشمس والصيف</h3>
            <p>يعيد لليدين والقدمين لونهما الطبيعي ويوفر ترطيباً مكثفاً يمنع عودة الجفاف والاسمرار مجدداً.</p>
          </div>
        </div>

        <div class="footer-strip">
          <div>استخدام ليلي يومي</div>
          <div>•</div>
          <div>نتائج دائمة غير مؤقتة</div>
          <div>•</div>
          <div>آمن على الحوامل والمرضعات</div>
        </div>
      </body>
      </html>
    `,
  },

  // 6. Whitening Cream - How to Use
  {
    filename: 'cream_04_how_to_use.png',
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
          body {
            width: 1500px;
            height: 1500px;
            background: linear-gradient(135deg, #FAF8F5 0%, #FFFFFF 100%);
            display: flex;
            flex-direction: column;
            padding: 80px 100px;
            color: #2D2727;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EAE3D9;
            padding-bottom: 30px;
            margin-bottom: 50px;
          }
          .brand { font-size: 38px; font-weight: 800; color: #9275A4; }
          .badge { background: #436697; color: #fff; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 700; }
          .title-section h1 { font-size: 54px; font-weight: 900; margin-bottom: 16px; }
          .title-section p { font-size: 28px; color: #6E6259; }

          .steps-container {
            display: flex;
            flex-direction: column;
            gap: 30px;
            margin-top: 50px;
            flex: 1;
            justify-content: center;
          }
          .step-card {
            background: #FFFFFF;
            border: 2px solid #EBE4DA;
            border-radius: 28px;
            padding: 35px 45px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.04);
            display: flex;
            align-items: center;
            gap: 35px;
          }
          .step-num {
            width: 85px;
            height: 85px;
            border-radius: 50%;
            background: linear-gradient(135deg, #D8B559, #B89230);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            font-weight: 900;
            flex-shrink: 0;
            box-shadow: 0 8px 18px rgba(216, 181, 89, 0.35);
          }
          .step-content h3 { font-size: 32px; font-weight: 800; margin-bottom: 8px; color: #2D2727; }
          .step-content p { font-size: 24px; color: #665C54; line-height: 1.5; }

          .routine-box {
            background: #F7F3EE;
            border-radius: 24px;
            padding: 30px 40px;
            margin-top: 25px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            border: 1.5px dashed #D8C8B5;
          }
          .routine-text h4 { font-size: 26px; font-weight: 800; color: #2D2727; margin-bottom: 6px; }
          .routine-text p { font-size: 22px; color: #665C54; }
          .routine-pill { background: #D8B559; color: #2D2727; padding: 10px 24px; border-radius: 50px; font-size: 20px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">طريقة الاستخدام السريرية</div>
        </div>

        <div class="title-section">
          <h1>خطوات الاستخدام اليومي لأفضل نتائج تفتيح</h1>
          <p>طريقة طبية بسيطة لضمان أقصى امتصاص وأسرع فاعلية</p>
        </div>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-content">
              <h3>تنظيف وتجفيف البشرة</h3>
              <p>اغسلي المنطقة المستهدفة بغسول مونتانا للتفتيح وجففيها تماماً بلطف قبل وضع الكريم.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-content">
              <h3>توزيع كمية مناسبة</h3>
              <p>ضعي كمية بحجم حبة البازلاء على البقعة أو المنطقة المراد تفتيحها (الوجه، الرقبة، أو الأماكن الحساسة).</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-content">
              <h3>التدليك حتى الامتصاص التام</h3>
              <p>دلكي برفق حتى تمتصه البشرة بالكامل في ثوانٍ. يُفضل استخدامه مساءً قبل النوم يومياً.</p>
            </div>
          </div>
        </div>

        <div class="routine-box">
          <div class="routine-text">
            <h4>💡 نصيحة للحماية أثناء النهار:</h4>
            <p>عند التعرض للشمس نهاراً، يُنصح دائماً باستخدام واقي شمس لحماية نتائج التفتيح.</p>
          </div>
          <div class="routine-pill">حماية متكاملة</div>
        </div>
      </body>
      </html>
    `,
  },
];

async function run() {
  console.log('Launching browser to render Amazon Gallery images (1500x1500)...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const execPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const slide of SLIDES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1500, deviceScaleFactor: 1 });
    await page.setContent(slide.html, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT_DIR, slide.filename);
    await page.screenshot({ path: outPath, type: 'png' });
    await page.close();
    console.log(`Rendered: ${slide.filename} (${fs.statSync(outPath).size} bytes)`);
  }

  await browser.close();
  console.log('\nAll Amazon Gallery images generated successfully in images/amazon-gallery/');
}

run().catch(console.error);
