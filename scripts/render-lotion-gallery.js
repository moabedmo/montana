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

const p4Img = fileToBase64('images/p4.png');
const p5Img = fileToBase64('images/p5.png');

const NEW_SLIDES = [
  // 1. Lotion - Ingredients & Deep Moisture
  {
    filename: 'lotion_02_ingredients.png',
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
            max-height: 820px;
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
          <div class="badge">ترطيب مكثف 72 ساعة</div>
        </div>

        <div class="title-section">
          <h1>تركيبة متطورة لحبس الرطوبة وتغذية البشرة</h1>
          <p>ترطيب عميق طويل الأمد يحمي حاجز الجلد من الجفاف والتشققات</p>
        </div>

        <div class="content-body">
          <div class="product-col">
            <div class="product-glow"></div>
            <img src="${p4Img}" alt="Montana Body & Hand Lotion">
          </div>

          <div class="items-col">
            <div class="card">
              <div class="card-icon">💧</div>
              <div class="card-text">
                <h3>ترطيب هيدراتوري يدوم 72 ساعة</h3>
                <p>يحبس جزيئات الماء داخل مسام الجلد ليمنحك نعومة مستمرة طوال اليوم حتى بعد غسيل اليدين.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">⚡</div>
              <div class="card-text">
                <h3>سريع الامتصاص وغير لزج</h3>
                <p>قوام خفيف مخملي تمتصه البشرة فورياً، يسمح لكِ بارتداء ملابسك فوراً دون أي إحساس بالتلاصق.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🛡️</div>
              <div class="card-text">
                <h3>دعم حاجز البشرة الواقي</h3>
                <p>معزز بمضادات الأكسدة والزيوت المغذية لحماية الجلد من العوامل الجوية ومسببات الجفاف الشديد.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🌸</div>
              <div class="card-text">
                <h3>ملمس ناعم كالحرير ورائحة منعشة</h3>
                <p>يغمر اليدين والجسم بنعومة فائقة ويعيد للبشرة الباهتة مرونتها وإشراقتها الحيوية.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-strip">
          <div><span class="check">✔</span> ترطيب مستمر 72 ساعة</div>
          <div><span class="check">✔</span> خالي من البارابين</div>
          <div><span class="check">✔</span> غير دهني بالكامل</div>
          <div><span class="check">✔</span> لليدين والجسم بالكامل</div>
        </div>
      </body>
      </html>
    `,
  },

  // 2. Lotion - Strawberry Skin & Benefits
  {
    filename: 'lotion_03_benefits.png',
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
          <div class="badge">عناية مكثفة بالجلد الخشن</div>
        </div>

        <div class="title-section">
          <h1>وداعاً لجلد الوزة والخشونة وتشققات البشرة</h1>
          <p>حل جذري لخشونة الساقين والكوعين والركبتين ولترطيب اليدين بعد المنظفات</p>
        </div>

        <div class="grid-container">
          <div class="grid-card">
            <div class="grid-badge">علاج جلد الوزة</div>
            <h3>تنعيم ملمس الساقين والذراعين</h3>
            <p>يساعد على ترطيب وتليين بصيلات الشعر المتصلبة لمنع احتباس الشعر تحت الجلد والقضاء على المظهر المحبب.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">ترميم اليدين</div>
            <h3>علاج تشققات وجفاف اليدين</h3>
            <p>يعيد ترميم كفوف اليدين المتضررة من كثرة استخدام الصابون، المنظفات، والكحول الطبي ويعيد لها نعومتها.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">تنعيم المفاصل</div>
            <h3>تليين الكوعين والركبتين الخشنة</h3>
            <p>يتغلغل في طبقات الجلد الجافة والسميكة ويفكك التصلب والخشونة ليمنحك ملمساً أملساً تماماً.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">لجميع أفراد الأسرة</div>
            <h3>آمن على البشرة الحساسة</h3>
            <p>بتركيبة نقية ومفحوصة معملياً تناسب جميع أنواع البشرة الجافة والعادية والمختلطة للاستخدام اليومي.</p>
          </div>
        </div>

        <div class="footer-strip">
          <div>امتصاص فوري في ثوانٍ</div>
          <div>•</div>
          <div>عبوة 50 مل عملية للمنزل والحقيبة</div>
          <div>•</div>
          <div>نتائج واضحة من أول استخدام</div>
        </div>
      </body>
      </html>
    `,
  },

  // 3. Lotion - How to use
  {
    filename: 'lotion_04_how_to_use.png',
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
          <div class="badge">روتين الترطيب اليومي</div>
        </div>

        <div class="title-section">
          <h1>أفضل توقيت وطريقة لاستخدام اللوشن</h1>
          <p>خطوات بسيطة تضمن لكِ أعلى استفادة وحبس كامل للرطوبة داخل البشرة</p>
        </div>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-content">
              <h3>الاستخدام بعد الشاور مباشرة (والجلد مندي)</h3>
              <p>أفضل وقت لوضع اللوشن هو بعد الاستحمام بالماء الدافئ مباشرة والمسام مفتوحة لحبس أكبر قدر من الرطوبة.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-content">
              <h3>التوزيع بحركات دائرية ناعمة</h3>
              <p>وزعي كمية مناسبة على الذراعين، الساقين، واليدين ودلكي برفق حتى تمتصه البشرة تماماً في ثوانٍ.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-content">
              <h3>التركيز على المناطق الأكثر جفافاً</h3>
              <p>ركزي بجرعة إضافية بسيطة على الكوعين، الركبتين، وكفوف اليدين بعد كل غسيل لحمايتها الدائمة.</p>
            </div>
          </div>
        </div>

        <div class="routine-box">
          <div class="routine-text">
            <h4>💡 نصيحة للنعومة الفائقة:</h4>
            <p>استخدمي اللوشن مرتين يومياً صباحاً ومساءً للحفاظ على بشرة ممتلئة وناعمة كالحرير دائماً.</p>
          </div>
          <div class="routine-pill">عناية 24/7</div>
        </div>
      </body>
      </html>
    `,
  },

  // 4. Post-Laser Cream - Mebo Comparison & Burns
  {
    filename: 'laser_02_mebo_comparison.png',
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
          .badge { background: #D8B559; color: #2D2727; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 800; }
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
            background: radial-gradient(circle, rgba(216, 181, 89, 0.25) 0%, rgba(67, 102, 151, 0.15) 50%, transparent 70%);
            border-radius: 50%;
            z-index: 1;
          }
          .product-col img {
            max-height: 820px;
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
            color: #436697;
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
          <div class="badge">الترميم السريري المتطور</div>
        </div>

        <div class="title-section">
          <h1>بديل ميبو المتطور: ترميم الحروق بدون رائحة</h1>
          <p>قوة الشفاء والترميم القصوى بنفس الفاعلية وبقوام خفيف يمتصه الجلد فورياً</p>
        </div>

        <div class="content-body">
          <div class="product-col">
            <div class="product-glow"></div>
            <img src="${p5Img}" alt="Montana Post-Laser Cream">
          </div>

          <div class="items-col">
            <div class="card">
              <div class="card-icon">⚡</div>
              <div class="card-text">
                <h3>تسريع التئام الجلد المتضرر</h3>
                <p>يحفز تجديد الخلايا الملساء وترميم الأنسجة المتضررة بعد حروق الليزر وحروق الشمس واللسعات الحرارية.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🚫</div>
              <div class="card-text">
                <h3>بدون رائحة نفاذة ومزعجة</h3>
                <p>وداعاً لرائحة السمسم القوية المعروفة في مراهم الحروق التقليدية، استمتعي بترميم كامل برائحة هادئة ومنعشة.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">🛡️</div>
              <div class="card-text">
                <h3>منع التصبغات والاسمرار</h3>
                <p>مدعم بالنياسيناميد (Niacinamide) النقي لمنع الاسمرار والندبات التي تصيب الجلد بعد الالتهابات والحرارة.</p>
              </div>
            </div>

            <div class="card">
              <div class="card-icon">✨</div>
              <div class="card-text">
                <h3>امتصاص سريع وبدون أثر دهني</h3>
                <p>لا يترك طبقة زيتية صفراء مزعجة على الجلد ولا يلطخ الملابس، مثالي للوجه والمناطق الحساسة.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-strip">
          <div><span class="check">✔</span> بعد جلسات الليزر والتقشير</div>
          <div><span class="check">✔</span> لعلاج حروق الشمس</div>
          <div><span class="check">✔</span> خالي من العطور القاسية</div>
          <div><span class="check">✔</span> عبوة 50 مل عملية</div>
        </div>
      </body>
      </html>
    `,
  },

  // 5. Post-Laser Cream - Multi-Use Scenarios
  {
    filename: 'laser_03_uses.png',
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
          .badge { background: #436697; color: #fff; padding: 12px 28px; border-radius: 50px; font-size: 24px; font-weight: 700; }
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
            background: #EDF3FA;
            color: #436697;
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
          <div class="badge">دواعي الاستعمال الشاملة</div>
        </div>

        <div class="title-section">
          <h1>العناية الأولى لتهدئة وترميم الجلد المتضرر</h1>
          <p>استخدامات طبية وتجميلية متعددة لحماية البشرة بعد الإجراءات الحرارية</p>
        </div>

        <div class="grid-container">
          <div class="grid-card">
            <div class="grid-badge">إزالة الشعر بالليزر</div>
            <h3>بعد جلسات العيادات والليزر</h3>
            <p>يهدئ الإحساس بالحرقان فورياً ويقضي على الاحمرار والتحسس ويمنع التهاب بصيلات الشعر بعد الجلسة.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">حروق الشمس والمصايف</div>
            <h3>ترميم حروق وحرارة الشمس</h3>
            <p>يبرد الجلد الملتهب نتيحة التعرض الطويل لأشعة الشمس الحارقة ويمنع تقشر البشرة المؤلم وتغير لونها.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">التقشير والديرمابن</div>
            <h3>تسريع التئام إجراءات البشرة</h3>
            <p>يوفر بيئة مثالية لترميم حاجز الجلد المتضرر بعد جلسات التقشير الكيميائي، الديرمابن، والميزوثيرابي.</p>
          </div>

          <div class="grid-card">
            <div class="grid-badge">اللسعات المنزلية</div>
            <h3>حروق المطبخ والماء الساخن</h3>
            <p>إسعاف أولي منزلي آمن لتسكين لسعات الفرن والبخار الساخن وتسريع تجديد خلايا الجلد بدون ترك ندبات.</p>
          </div>
        </div>

        <div class="footer-strip">
          <div>أمان سريري موثوق</div>
          <div>•</div>
          <div>للوجه والمناطق الحساسة والجسم</div>
          <div>•</div>
          <div>تسكين فوري للحرارة</div>
        </div>
      </body>
      </html>
    `,
  },

  // 6. Post-Laser Cream - How to Use
  {
    filename: 'laser_04_how_to_use.png',
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
            background: linear-gradient(135deg, #436697, #2D476D);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            font-weight: 900;
            flex-shrink: 0;
            box-shadow: 0 8px 18px rgba(67, 102, 151, 0.35);
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
          .routine-pill { background: #436697; color: #fff; padding: 10px 24px; border-radius: 50px; font-size: 20px; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">MONTANA NATURALS</div>
          <div class="badge">بروتوكول الترميم السريري</div>
        </div>

        <div class="title-section">
          <h1>إرشادات الاستخدام لتهدئة سريعة وحماية تامة</h1>
          <p>طريقة طبية سهلة لتحقيق أسرع التئام ومنع أي ندبات أو تصبغات</p>
        </div>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-num">1</div>
            <div class="step-content">
              <h3>التطبيق الفوري بعد الإجراء</h3>
              <p>ضعي طبقة كافية من الكريم على المنطقة المتأثرة فور الانتهاء من جلسة الليزر أو التعرض للشمس لتبريد الحرارة.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">2</div>
            <div class="step-content">
              <h3>التوزيع برفق وبدون فرك قوي</h3>
              <p>وزعي الكريم بطريقة الطبطبة الخفيفة حتى يمتصه الجلد دون إحداث أي احتكاك إضافي بالبشرة المتحسسة.</p>
            </div>
          </div>

          <div class="step-card">
            <div class="step-num">3</div>
            <div class="step-content">
              <h3>التكرار من 2 إلى 3 مرات يومياً</h3>
              <p>كرري الاستخدام بانتظام لمدة 3 إلى 5 أيام بعد الجلسة حتى يزول الاحمرار تماماً ويستعيد الجلد توازنه.</p>
            </div>
          </div>
        </div>

        <div class="routine-box">
          <div class="routine-text">
            <h4>💡 نصيحة سريرية بعد الليزر:</h4>
            <p>تجنبي التعرض للشمس المباشرة أو الماء شديد السخونة خلال أول 48 ساعة من الجلسة.</p>
          </div>
          <div class="routine-pill">حماية سريرية</div>
        </div>
      </body>
      </html>
    `,
  },
];

async function run() {
  console.log('Rendering Lotion and Laser gallery slides (1500x1500)...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const execPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const slide of NEW_SLIDES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1500, deviceScaleFactor: 1 });
    await page.setContent(slide.html, { waitUntil: 'networkidle0' });
    const outPath = path.join(OUT_DIR, slide.filename);
    await page.screenshot({ path: outPath, type: 'png' });
    await page.close();
    console.log(`Rendered: ${slide.filename} (${fs.statSync(outPath).size} bytes)`);
  }

  await browser.close();
  console.log('Done rendering Lotion and Laser images!');
}

run().catch(console.error);
