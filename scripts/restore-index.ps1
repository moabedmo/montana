$path = 'd:\montana\index.html'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$origLen = $content.Length

# ── Remove embedded base64 assets (logo + product PNGs) ──
$content = [regex]::Replace($content, '<img id="nlogo" src="data:image[^"]*"[^>]*>', '<span id="nlogo" class="brand-logo" role="img" aria-label="Montana Naturals"></span>')
$imgs = @('p1','p2','p3','p4','p5','p6')
foreach ($img in $imgs) {
    $content = [regex]::Replace($content, '<img class="pp-img" src="data:image/png;base64,[^"]*"', "<img class=`"pp-img`" src=`"assets/$img.png`"", 1)
}

# ── Fonts ──
$content = $content.Replace(
    "<link href=`"https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;500;700&display=swap`" rel=`"stylesheet`">",
    "<link href=`"https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&family=Markazi+Text:wght@400;500;600;700&display=swap`" rel=`"stylesheet`">"
)

# ── External CSS ──
if ($content -notmatch 'css/product-stage.css') {
    $content = $content.Replace(
        "</head>",
        @"
<link rel="stylesheet" href="css/shop.css">
<link rel="stylesheet" href="css/brand.css">
<link rel="stylesheet" href="css/product-stage.css">
<link rel="stylesheet" href="css/quiz.css">
<link rel="stylesheet" href="css/mobile-app.css">
</head>
"@
    )
}

# ── Nav CSS ──
$content = $content.Replace(
@'
#nav{position:fixed;top:0;left:0;right:0;z-index:800;padding:22px 52px;display:flex;align-items:center;justify-content:space-between;}
#nav::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,1,10,.85) 0%,transparent);pointer-events:none;}
#nlogo{height:30px;filter:drop-shadow(0 0 14px rgba(167,139,250,.4));position:relative;z-index:1;}
#nlinks{display:flex;gap:32px;position:relative;z-index:1;}
'@,
@'
#nav{position:fixed;top:0;left:0;right:0;z-index:800;padding:22px 48px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;backdrop-filter:blur(14px);border-bottom:.5px solid rgba(167,139,250,.15);}
#nav::before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(26,15,46,.82) 0%,rgba(26,15,46,.45) 100%);pointer-events:none;}
#nlogo{grid-column:1;justify-self:start;margin-inline-start:20px;position:relative;z-index:1;}
#nlinks{grid-column:2;justify-self:center;display:flex;align-items:center;gap:28px;position:relative;z-index:1;}
#nav-controls{grid-column:3;justify-self:end;display:flex;align-items:center;gap:10px;position:relative;z-index:1;}
'@
)

$content = $content.Replace(
'.nl{font-size:8px;letter-spacing:.34em;text-transform:uppercase;color:rgba(255,255,255,.28);text-decoration:none;transition:color .4s;}',
'.nl{font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:rgba(255,255,255,.28);text-decoration:none;transition:color .4s;}'
)
$content = $content.Replace(
'.nl:hover{color:rgba(167,139,250,.8);}',
@'
.nl:hover{color:rgba(167,139,250,.8);}
.nl-shop{color:rgba(167,139,250,.55);}
.nl-shop:hover{color:rgba(167,139,250,.95);}
.nav-cart-btn{position:relative;display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.45);background:none;border:.5px solid rgba(124,58,237,.35);padding:10px 18px;text-decoration:none;cursor:pointer;transition:all .35s;}
.nav-cart-btn:hover{color:#fff;border-color:rgba(167,139,250,.5);}
.nav-cart-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#7C3AED;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;font-family:'Jost',sans-serif;}
.pp-actions{display:flex;align-items:center;gap:14px;margin-top:18px;pointer-events:all;}
.pp-add{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.75);background:rgba(124,58,237,.22);border:.5px solid rgba(167,139,250,.35);padding:12px 22px;cursor:pointer;transition:all .35s;}
.pp-add:hover{background:rgba(124,58,237,.38);border-color:rgba(167,139,250,.55);color:#fff;}
.pp-view{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(167,139,250,.55);text-decoration:none;transition:color .35s;}
.pp-view:hover{color:rgba(167,139,250,.95);}
#story-progress{position:fixed;right:28px;left:auto;bottom:88px;z-index:700;display:flex;flex-direction:column;align-items:flex-end;gap:4px;opacity:0;transition:opacity .45s;pointer-events:none;text-align:right;}
#story-progress-num{font-family:'Playfair Display',serif;font-size:15px;color:rgba(167,139,250,.78);letter-spacing:.1em;}
#story-progress-label{font-size:12px;color:rgba(255,255,255,.24);}
html[lang=ar] #story-progress{right:auto;left:28px;align-items:flex-start;text-align:right;}
html[lang=ar] #story-progress-num{font-family:'Markazi Text',serif;font-size:17px;letter-spacing:0;}
html[lang=ar] #story-progress-label{font-family:'Almarai',sans-serif;font-size:13px;}
'@
)

# ── Product vis / imgwrap (product-stage.css handles sculptural layers) ──
$content = $content.Replace(
@'
.pp-vis{display:flex;align-items:center;justify-content:center;position:relative;}
.pp-imgwrap{position:relative;width:300px;height:420px;display:flex;align-items:center;justify-content:center;}
.pp-imgwrap::before{content:'';position:absolute;width:240px;height:240px;border-radius:50%;background:radial-gradient(ellipse,rgba(109,40,217,.2) 0%,transparent 68%);filter:blur(32px);}
.pp-ring{position:absolute;border-radius:50%;border:.5px solid rgba(124,58,237,.1);}
.pp-img{max-height:80%;max-width:80%;object-fit:contain;mix-blend-mode:normal;filter:drop-shadow(0 20px 40px rgba(120,50,220,.5));position:relative;z-index:1;transition:transform .7s cubic-bezier(.25,.46,.45,.94);}
'@,
@'
.pp-vis{display:flex;align-items:center;justify-content:center;position:relative;min-height:min(780px,72vh);}
.pp-imgwrap{position:relative;width:380px;height:540px;display:flex;align-items:stretch;justify-content:center;}
.pp-imgwrap::before{display:none;}
.pp-ring{position:absolute;border-radius:50%;border:.5px solid rgba(167,139,250,.14);pointer-events:none;}
.pp-img{object-fit:contain;position:relative;z-index:1;}
@media(min-width:769px){.pp-imgwrap{width:580px;height:780px;}}
'@
)

# ── Remove old fixed lang switcher styles ──
$content = [regex]::Replace($content, '#lsw\{position:fixed;bottom:32px;left:48px;[^}]+\}\s*#lsw button\{[^}]+\}', '')

# ── Arabic typography ──
$content = $content.Replace(
"html[lang=ar] .pp-h,html[lang=ar] .pp-body,html[lang=ar] .pp-problem,html[lang=ar] .pp-result,html[lang=ar] .pp-act,html[lang=ar] .pp-vol,html[lang=ar] .ch-act,html[lang=ar] .ch-t,html[lang=ar] .fsl,html[lang=ar] .ftag,html[lang=ar] .fq,html[lang=ar] .fcta,html[lang=ar] .pre,html[lang=ar] .sub,html[lang=ar] #ov-open h1{font-family:'Noto Naskh Arabic',sans-serif!important;}",
@'
html[lang=ar] body{direction:rtl;font-family:'Almarai',sans-serif;}
html[lang=ar] .pp-text{direction:rtl;padding-right:56px!important;padding-left:0!important;text-align:right;}
html[lang=ar] .pp-h,html[lang=ar] #ov-open h1,html[lang=ar] .ch-t,html[lang=ar] .fq,html[lang=ar] .pp-problem,html[lang=ar] .pp-result{font-family:'Markazi Text',serif!important;font-weight:500;}
html[lang=ar] .pp-body,html[lang=ar] .pp-act,html[lang=ar] .pp-vol,html[lang=ar] .ch-act,html[lang=ar] .fsl,html[lang=ar] .ftag,html[lang=ar] .pre,html[lang=ar] .sub,html[lang=ar] .nl,html[lang=ar] .nav-cart-btn,html[lang=ar] .pp-add,html[lang=ar] .pp-view{font-family:'Almarai',sans-serif!important;letter-spacing:0;text-transform:none;}
html[lang=ar] .ov-prod.flip .pp-text{direction:rtl;padding-left:56px!important;padding-right:0!important;}
html[lang=ar] .pp-text::before{border-right:1px solid rgba(255,255,255,.11)!important;border-left:1px solid rgba(167,139,250,.24)!important;}
@media(max-width:768px){
  #nav{padding:16px 20px;grid-template-columns:auto 1fr auto;gap:10px;}
  #nlinks{gap:16px;}
  .nl{font-size:11px;letter-spacing:.2em;}
  .nav-cart-btn{padding:8px 12px;font-size:11px;}
  #nav-controls{gap:8px;}
}
'@
)

# ── Nav HTML ──
$content = $content.Replace(
@'
  <div id="nlinks">
    <a href="#" class="nl">Collection</a>
    <a href="#" class="nl">Philosophy</a>
    <a href="#" class="nl">Begin</a>
  </div>
</nav>
'@,
@'
  <div id="nlinks">
    <a href="index.html" class="nl" id="nav-story" data-i18n="navStory">Story</a>
    <a href="shop.html" class="nl nl-shop" id="nav-shop" data-i18n="navShop">Collection</a>
    <a href="ingredients.html" class="nl" id="nav-ingredients" data-i18n="navIngredients">Ingredients</a>
    <a href="cart.html" class="nav-cart-btn" id="nav-cart-btn">
      <span id="nav-cart-label" data-i18n="navCart">Bag</span>
      <span class="nav-cart-badge" id="nav-cart-badge" data-count="0">0</span>
    </a>
  </div>
  <div id="nav-controls">
    <button type="button" id="ambient-btn" aria-pressed="false" title="Play music" aria-label="Play music">
      <svg class="muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5zm11.5 3c0-2.71-1.56-5.05-3.84-6.2L11 5.86c2.9 1.22 4.96 4.08 4.96 7.64s-2.06 6.42-4.96 7.64l1.66-1.66c2.28-1.15 3.84-3.49 3.84-6.2z"/></svg>
      <svg class="waves" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h2.5l4.5 4.5V5.5L5.5 10H3zm14 2c0-2.21-1.79-4-4-4v1.5c1.38 0 2.5 1.12 2.5 2.5S14.38 14.5 13 14.5V16c2.21 0 4-1.79 4-4zm-4-6v1.5c3.31 0 6 2.69 6 6s-2.69 6-6 6V20c4.42 0 8-3.58 8-8s-3.58-8-8-8z"/></svg>
    </button>
    <div id="lsw">
      <button id="btn-en" class="on">EN</button>
      <button id="btn-ar">عربي</button>
    </div>
  </div>
</nav>
'@
)

# ── Story progress indicator ──
if ($content -notmatch 'id="story-progress"') {
    $content = $content.Replace(
        '</div>`n`n<div id="scroller">',
        @'
</div>

<div id="story-progress" aria-hidden="true">
  <span id="story-progress-num">01 / 14</span>
  <span id="story-progress-label">Chapter</span>
</div>

<div id="scroller">
'@
    )
    # fallback without backtick-n issue
    $content = $content.Replace(
        "</div>`r`n`r`n<div id=`"scroller`">",
        @"
</div>

<div id=`"story-progress`" aria-hidden=`"true`">
  <span id=`"story-progress-num`">01 / 14</span>
  <span id=`"story-progress-label`">Chapter</span>
</div>

<div id=`"scroller`">
"@
    )
}

# ── Remove inline lang switcher from stage ──
$content = [regex]::Replace($content, '(?s)\s*<div id="lsw">\s*<button id="btn-en" style="[^"]*">EN</button>.*?</div>\s*', "`n", 1)

# ── Product IDs + actions ──
$pairs = @(
    @{ ov = 'ov-p1'; id = 'acne-cleanser' },
    @{ ov = 'ov-p2'; id = 'whitening-cleanser' },
    @{ ov = 'ov-p3'; id = 'whitening-cream' },
    @{ ov = 'ov-p4'; id = 'body-lotion' },
    @{ ov = 'ov-p5'; id = 'post-laser' },
    @{ ov = 'ov-p6'; id = 'anti-scar' }
)
foreach ($p in $pairs) {
    $ov = $p.ov
    $id = $p.id
    if ($content -match "id=`"$ov`"") {
        $content = [regex]::Replace(
            $content,
            "(<div class=`"overlay ov-prod`" id=`"$ov`">.*?<span class=`"pp-vol`">[^<]*</span>)(\s*</div>\s*<div class=`"pp-vis`">)",
            "`$1`n      <div class=`"pp-actions`">`n        <button type=`"button`" class=`"pp-add`" data-product=`"$id`">Add to Bag</button>`n        <a href=`"product.html?id=$id`" class=`"pp-view`" data-pid=`"$id`">View</a>`n      </div>`$2",
            1
        )
        $content = [regex]::Replace(
            $content,
            "(id=`"$ov`"[^>]*>.*?<div class=`"pp-imgwrap`")>",
            "`$1 data-product-id=`"$id`">",
            1
        )
    }
}

# ── Finale CTA -> shop ──
$content = [regex]::Replace($content, '<button class="fcta">([^<]*(?:<[^/][^>]*>[^<]*)*)</button>', '<a href="shop.html" class="fcta">$1</a>', 1)

# ── Replace old product hover with MontanaProductStage ──
$content = [regex]::Replace($content, '(?s)/\* ═+\s*PRODUCT IMG 3D HOVER\s*═+\s*\*/.*?w\.addEventListener\(''mouseleave''.*?\}\);\s*\}\);\s*', '')

# ── Enhance setScene + scroll ──
if ($content -notmatch 'enhanceProductStages') {
    $content = $content.Replace(
        'let _activeOv=null,_swTimer=null;',
@'
let _activeOv=null,_swTimer=null;
const PROD_SCENES=[2,4,6,8,10,12];

function enhanceProductStages(){
  if(window.MontanaProductStage)MontanaProductStage.enhanceAll(document);
}

function animateProductEntrance(el){
  if(window.MontanaProductStage)MontanaProductStage.animateEntrance(el);
}

function updateStoryProgress(s){
  var bar=document.getElementById('story-progress');
  var num=document.getElementById('story-progress-num');
  var lbl=document.getElementById('story-progress-label');
  if(!bar||!num)return;
  var ar=document.documentElement.getAttribute('lang')==='ar';
  num.textContent=(s<9?'0':'')+(s+1)+' / '+TOTAL_SCENES;
  if(lbl)lbl.textContent=ar?'الفصل':'Chapter';
  bar.style.opacity=s>0?'1':'0';
}
'@
    )

    $content = $content.Replace(
        '  _swTimer=setTimeout(()=>{',
@'
  updateStoryProgress(s);
  if(PROD_SCENES.indexOf(s)!==-1){
    var pel=ovEls[s];
    if(pel)animateProductEntrance(pel.querySelector('.pp-vis'));
  }
  _swTimer=setTimeout(()=>{
'@
    )

    $content = $content.Replace(
        'setScene(0);',
@'
setScene(0);
enhanceProductStages();
'@
    )
}

# ── Shop scripts before inline lang script ──
if ($content -notmatch 'js/products.js') {
    $shopScripts = @'

<script src="js/products.js"></script>
<script src="js/shop-cart.js"></script>
<script src="js/shop-common.js"></script>
<script src="js/product-stage.js"></script>
<script src="js/ambient-audio.js"></script>
<script src="js/shop-extras.js"></script>
<script src="js/mobile-app.js"></script>
<script>
document.addEventListener('DOMContentLoaded',function(){
  if(window.MontanaShop){
    MontanaShop.initLang();
    MontanaShop.bindLang();
    MontanaShop.bindNav();
    MontanaShop.bindIngredientLinks(document);
  }
  if(window.MontanaAmbient)MontanaAmbient.init();
  document.querySelectorAll('.pp-add').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.stopPropagation();
      if(!window.MontanaCart)return;
      MontanaCart.add(btn.getAttribute('data-product'));
      if(window.MontanaShop)MontanaShop.toast(MontanaShop.t('added'));
      if(window.MontanaShop)MontanaShop.updateBadge();
    });
  });
  document.querySelectorAll('.pp-view[data-pid]').forEach(function(link){
    link.addEventListener('click',function(){
      try{sessionStorage.setItem('montana_pdp',link.getAttribute('data-pid'));}catch(e){}
    });
  });
  document.addEventListener('lang:changed',function(){
    if(typeof go==='function')go(MontanaCart.getLang());
  });
  var saved=localStorage.getItem('montana_lang');
  if(saved==='ar'||saved==='en')go(saved);
});
</script>
'@
    $content = $content.Replace('<script>`r`nvar _L=', "$shopScripts`r`n<script>`r`nvar _L=")
    $content = $content.Replace("<script>`nvar _L=", "$shopScripts`n<script>`nvar _L=")
}

# ── Sync go() with MontanaCart ──
$content = $content.Replace(
    'function go(lang){`r`n  if(lang===_L)return; _L=lang;',
    "function go(lang){`r`n  if(lang===_L)return; _L=lang;`r`n  try{localStorage.setItem('montana_lang',lang);}catch(e){}`r`n  if(window.MontanaCart)MontanaCart.setLang(lang);"
)
$content = [regex]::Replace(
    $content,
    "  var nls=document\.querySelectorAll\('\.nl'\);\s*\['Collection','Philosophy','Begin'\]\.forEach\(function\(en,j\)\{[^}]+\}\);",
    "  if(window.MontanaShop)MontanaShop.bindNav();`r`n  document.querySelectorAll('.pp-add').forEach(function(b){b.textContent=ar?'\u0636\u064A\u0641\u064A \u0644\u0644\u0634\u0646\u0637\u0629':'Add to Bag';});`r`n  document.querySelectorAll('.pp-view').forEach(function(b){b.textContent=ar?'\u0634\u0648\u0641\u064A \u0627\u0644\u0645\u0646\u062A\u062C':'View';});`r`n  if(typeof updateStoryProgress==='function')updateStoryProgress(typeof currentScene==='number'?currentScene:0);"
)

[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Restored index.html: $($origLen) -> $($content.Length) bytes"
