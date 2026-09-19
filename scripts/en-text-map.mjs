/**
 * Build-time Arabic → English replacements for /en/ HTML pages.
 * Sorted longest-first when applying.
 */
export const EN_TEXT_PAIRS = [
  // ── Titles & meta ──
  ['Montana | العناية الفاخرة', 'Montana | Luxury Skincare'],
  ['Montana | تفاصيل المنتج', 'Montana | Product Details'],
  ['Montana | إتمام الطلب', 'Montana | Checkout'],
  ['Montana | تواصل معنا', 'Montana | Contact us'],
  ['Montana | من نحن', 'Montana | About us'],
  ['Montana | البحث', 'Montana | Search'],
  ['Montana | المتجر', 'Montana | Shop'],

  // ── Hero & homepage meta (full strings before partial word swaps) ──
  ['Montana | غسول حب الشباب وكريم تفتيح — عناية بالبشرة مصر', 'Montana | Acne Cleanser & Brightening Cream — Luxury Skincare Egypt'],
  ['Montana مصر — غسول حب الشباب، كريم تفتيح البشرة، وعناية ما بعد الليزر. منتجات طبيعية فاخرة مع شحن سريع لكل المحافظات.', 'Montana Egypt — acne cleanser, brightening cream, and post-laser care. Premium natural formulas with fast nationwide shipping.'],
  ['Montana مصر — غسول حب الشباب، كريم تفتيح البشرة، وعناية ما بعد الليزر. شحن لكل مصر.', 'Montana Egypt — acne cleanser, brightening cream, and post-laser care. Fast shipping across Egypt.'],
  ['Montana, عناية بالبشرة, غسول حب الشباب, كريم تفتيح, مصر, skincare Egypt', 'Montana, skincare Egypt, acne cleanser, brightening cream, luxury skincare'],
  ['عناية بالبشرة الفاخرة لمشكلتك — غسول حب الشباب وكريمات تفتيح طبيعية بنتائج ملموسة', 'Luxury skincare for your concern — acne cleansers and brightening creams with visible results'],
  ['تركيبات Montaña — غسول حب الشباب وكريمات تفتيح بنتائج واضحة من أول استخدام', 'Crafted with natural actives — visible results from first use'],
  ['عناية بالبشرة الفاخرة <em>لمشكلتك</em>', 'Luxury care for <em>your skin</em>'],
  ['بروتوكول عناية راقٍ <em>لبشرتك</em>', 'Luxury care for <em>your skin</em>'],
  ['عناية استثنائية <em>مصمّمة لكِ</em>', 'Luxury care for <em>your skin</em>'],
  ['منتجات Montaña للعناية بالبشرة — غسول التفتيح، كريم التفتيح، غسول حب الشباب، لوشن اليدين والجسم، وكريم ما بعد الليزر',
   'Montana skincare range — Whitening Cleanser, Whitening Cream, Acne Facial Cleanser, Hand & Body Lotion and Post Laser Cream'],
  ['عناية طبيعية · نتائج حقيقية', 'Natural Care · Real Results'],
  ['بشرة صحية', 'Healthy Skin'],
  ['وأنتِ أسعد', 'Happier You'],
  ['خمس تركيبات للوش والجسم — غسول لحب الشباب، غسول وكريم للتفتيح، لوشن ترطيب، وكريم عناية بعد الليزر.', 'Five formulas for face and body — an acne cleanser, a brightening cleanser and cream, a hydrating lotion, and a post-laser cream.'],
  ['🚚 شحن من 50 ج.م حسب المحافظة — مجاني من 3 منتجات', '🚚 Shipping from EGP 50 by governorate — free on 3 products'],
  ['كل أوردر بيكسبك نقاط — من غير تسجيل ولا اشتراك. بنعرفك برقم موبايلك، وتستبدلي نقاطك خصم على أي أوردر جاي.', 'Every order earns points — no sign-up, no subscription. We know you by your phone number, and your points come off any future order.'],
  ['روتينات كاملة بسعر أوفر — نفس عروض البندلات على الموقع', 'Complete routines — the same bundles offered on the site'],
  ['من غير تسجيل — برقم موبايلك', 'No sign-up — just your phone number'],
  ['نقاطك بتتجمّع لوحدها', 'Your points add up on their own'],
  ['١٠ نقاط = ١ ج.م خصم', '10 points = EGP 1 off'],
  ['نقطة لكل ١٠ ج.م', '1 point per EGP 10'],
  ['بتتحسب عند الاستلام', 'Credited on delivery'],
  ['شحن لكل المحافظات', 'Delivery nationwide'],
  ['ابدئي أوردرك', 'Start your order'],
  ['رصيد نقاطك', 'Your points balance'],
  ['تسوّقي الآن', 'Shop Now'],
  ['شوفي العروض', 'See the Offers'],
  ['تسوق المنتج', 'Shop the product'],
  ['الأقسام', 'Categories'],
  ['المفضلة', 'Wishlist'],
  ['سلة التسوق', 'Shopping Cart'],
  ['عروض البندلات', 'Bundle Offers'],
  ['عروض اليوم', "Today's Offers"],
  ['نصائح', 'Tips'],
  ['صحتك', 'Your Skin'],
  ['العناية', 'Care'],
  ['تسوق Montana — غسول حب الشباب، كريم تفتيح، ومنتجات عناية بالبشرة الطبيعية. شحن لكل مصر.', 'Shop Montana — acne cleanser, brightening cream and natural skincare. Delivery across Egypt.'],
  ['المنتجات المحفوظة لم تعد متاحة', 'The saved products are no longer available'],
  ['جارٍ تحميل المنتجات…', 'Loading products…'],
  ['شحن مجاني من 3 منتجات', 'Free shipping on 3 products'],
  ['${list.length} منتجات', '${list.length} products'],
  ['مشاركة', 'Share'],
  ['السلة', 'Cart'],
  ['بحث', 'Search'],
  ['تعذّر العثور على هذا المكوّن', 'This ingredient could not be found'],
  ['لم يتم تحديد مكوّن', 'No ingredient selected'],
  ['موجود في منتجات', 'Found in products'],
  ['0 منتجات', '0 products'],
  ['المكون', 'Ingredient'],
  ['نفذت الكمية', 'Out of stock'],
  ['المكونات', 'Ingredients'],
  ['كاش عند الاستلام — بدون مقدّم', 'Cash on delivery — no deposit'],
  ['شكراً لثقتك في Montana — هنراجع الطلب ونكلّمك قريب لتأكيد التوصيل.', 'Thank you for trusting Montana — we will review the order and call you shortly to confirm delivery.'],
  ['تم إرسال طلبك بنجاح', 'Your order has been sent'],
  ['عرض تفاصيل الطلب', 'View order details'],
  ['شحن مجاني (من 3 منتجات) 🎁', 'Free shipping (3+ products) 🎁'],
  ['شحن مجاني (عرض روتين) 🎁', 'Free shipping (routine offer) 🎁'],
  ['رقم الطلب: ${num}', 'Order number: ${num}'],
  ['Montana | تسجيل الدخول', 'Montana | Sign In'],
  ['تم إنشاء الحساب — تحقق من بريدك إن طُلب تأكيد، ثم سجّل الدخول', 'Account created — check your email if confirmation is required, then sign in'],
  ['تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك', 'A password reset link has been sent to your email'],
  ['أدخل بريدك الإلكتروني أولاً', 'Enter your email address first'],
  ['كلمتا المرور غير متطابقتين', 'The two passwords do not match'],
  ['أكمل البيانات المطلوبة', 'Please complete the required fields'],
  ['يجب الموافقة على الشروط', 'You must accept the terms'],
  ['بيانات الدخول غير صحيحة', 'Incorrect sign-in details'],
  ['أدخل البريد وكلمة المرور', 'Enter your email and password'],
  ['أعد إدخال كلمة المرور', 'Re-enter the password'],
  ['المتابعة بحساب Google', 'Continue with Google'],
  ['المتابعة بحساب Facebook', 'Continue with Facebook'],
  ['المتابعة بحساب Apple', 'Continue with Apple'],
  ['التسجيل بحساب Google', 'Sign up with Google'],
  ['نسيت كلمة المرور؟', 'Forgot your password?'],
  ['تأكيد كلمة المرور', 'Confirm password'],
  ['من لوحة Supabase أولاً', 'from the Supabase dashboard first'],
  ['6 أحرف على الأقل', 'At least 6 characters'],
  ['تسجيل الدخول', 'Sign In'],
  ['إنشاء حساب', 'Create account'],
  ['الاسم الكامل', 'Full name'],
  ['حساب جديد', 'New account'],
  ['أدخل اسمك', 'Enter your name'],
  ['كلمة المرور', 'Password'],
  ['أوافق على', 'I agree to'],
  ['تذكرني', 'Remember me'],
  ['فعّل مزود', 'Enable the provider'],
  ['عضوية برونزية', 'Bronze membership'],
  ['عضوية فضية', 'Silver membership'],
  ['عضوية بلاتينية', 'Platinum membership'],
  ['أعلى مستوى عضوية 🎉', 'Top membership tier 🎉'],
  ['لا توجد طلبات بعد — ', 'No orders yet — '],
  ['تتبع طلب برقم الطلب', 'Track an order by its number'],
  ['كلمة مرور جديدة (6+ أحرف)', 'New password (6+ characters)'],
  ['تم تغيير كلمة المرور ✓', 'Password changed ✓'],
  ['تغيير كلمة المرور', 'Change password'],
  ['تم حفظ البيانات ✓', 'Details saved ✓'],
  ['حفظ البيانات', 'Save details'],
  ['تعذّر الحفظ', 'Could not save'],
  ['تسجيل الخروج', 'Sign out'],
  ['جاري التجهيز', 'Being prepared'],
  ['قيد الانتظار', 'Pending'],
  ['تم التوصيل', 'Delivered'],
  ['تم الشحن — في الطريق', 'Shipped — on the way'],
  ['تم الشحن', 'Shipped'],
  ['مؤكد', 'Confirmed'],
  ['ملغي', 'Cancelled'],
  ['<h3>طلباتي</h3>', '<h3>My orders</h3>'],
  ['<h3>حسابي</h3>', '<h3>My account</h3>'],
  ['<h3>تعديل البيانات</h3>', '<h3>Edit details</h3>'],
  ['<h3>المساعدة</h3>', '<h3>Help</h3>'],
  ['<span class="acc-stat-label">طلب</span>', '<span class="acc-stat-label">Orders</span>'],
  ['<span class="acc-stat-label">المفضلة</span>', '<span class="acc-stat-label">Wishlist</span>'],
  ['<span class="acc-stat-label">نقطة</span>', '<span class="acc-stat-label">Points</span>'],
  ['placeholder="الاسم"', 'placeholder="Name"'],
  ['} نقطة</h3>', '} points</h3>'],
  ['Montana | تم تأكيد الطلب', 'Montana | Order Confirmed'],
  ['لم نجد أي طلب حديث لعرضه في هذه الجلسة.', 'We could not find a recent order to show in this session.'],
  ['شكراً لك على طلبك. سنرسل لك تحديثات عن حالة الطلب.', 'Thank you for your order. We will send you updates on its status.'],
  ['هنراجع إيصال التحويل ونأكد طلبك، عادةً خلال وقت قصير.', 'We will review the transfer receipt and confirm your order, usually within a short time.'],
  ['هنراجع الطلب ونكلمك قريب لتأكيد التوصيل.', 'We will review the order and call you shortly to confirm delivery.'],
  ['لقد كسبت <strong>{points} نقطة</strong> من Montana Rewards!', 'You earned <strong>{points} points</strong> with Montana Rewards!'],
  ['بانتظار مراجعة الإيصال', 'Awaiting receipt review'],
  ['تم تأكيد طلبك بنجاح!', 'Your order is confirmed!'],
  ['توصيل سريع (24 ساعة)', 'Express delivery (24 hours)'],
  ['توصيل عادي (2-3 أيام)', 'Standard delivery (2-3 days)'],
  ['لا يوجد طلب حالي', 'No current order'],
  ['العودة للرئيسية', 'Back to home'],
  ['محفظة إلكترونية', 'E-wallet'],
  ['عنوان التوصيل', 'Delivery address'],
  ['تاريخ الطلب', 'Order date'],
  ['تحديث الحالة', 'Refresh status'],
  ['جارٍ التحديث…', 'Refreshing…'],
  ['طلبك اتسجّل', 'Your order is registered'],
  ['المنتجات ({count})', 'Products ({count})'],
  ['الكمية: {n}', 'Quantity: {n}'],
  ['الإجمالي', 'Total'],
  ['لسه محولتيش مقدّم الحجز؟ ارفعي صورة الإيصال هنا وهنراجعها 💜', 'Not transferred the deposit yet? Upload a photo of the receipt here and we will review it 💜'],
  ['لم نجد طلباً بهذا الرقم والهاتف. تأكد من البيانات.', 'We could not find an order with that number and phone. Please check the details.'],
  ['الصورة كبيرة أوي، جرّبي صورة أصغر من 4 ميجا', 'That image is too large — try one under 4 MB'],
  ['تمام! ✅ استلمنا الصورة وهنراجعها قريب', 'Got it! ✅ We have the image and will review it shortly'],
  ['تعذّر رفع الصورة، حاولي تاني', 'Could not upload the image, please try again'],
  ['هل تحتاج مساعدة؟ تواصل معنا', 'Need help? Get in touch'],
  ['رقم الهاتف المستخدم في الطلب', 'Phone number used on the order'],
  ['حصلت مشكلة، حاولي تاني 🙏', 'Something went wrong, please try again 🙏'],
  ['الاتصال بطيء، حاولي تاني', 'Slow connection, please try again'],
  ['تعذّر البحث، حاول مرة أخرى', 'Search failed, please try again'],
  ['رقم الطلب (MON-XXXXX)', 'Order number (MON-XXXXX)'],
  ['تم إلغاء هذا الطلب', 'This order was cancelled'],
  ['جاري تجهيز الطلب', 'Preparing your order'],
  ['تم تأكيد الطلب', 'Order confirmed'],
  ['تم تأكيد الحجز', 'Reservation confirmed'],
  ['محفظة / إنستاباي', 'Wallet / InstaPay'],
  ['بانتظار الدفع', 'Awaiting payment'],
  ['عرض حالة الطلب', 'View order status'],
  ['تفاصيل التوصيل', 'Delivery details'],
  ['بترفع الصورة...', 'Uploading…'],
  ['ارفعي صورة الإيصال', 'Upload the receipt photo'],
  ['لا توجد تفاصيل', 'No details'],
  ['آخر تحديث: ', 'Last update: '],
  ['المنتجات (', 'Products ('],
  ['رقم الطلب', 'Order number'],
  ['البريد الإلكتروني أو رقم الهاتف', 'Email or phone number'],
  ['<span>أو</span>', '<span>or</span>'],
  ['</a> و<a href="terms.html">', '</a> and <a href="terms.html">'],
  ['<h1>تأكيد الطلب</h1>', '<h1>Order Confirmed</h1>'],
  ["'، '", "', '"],
  ['} نقطة للوصول للمستوى التالي', '} points to the next tier'],
  ["pageTitle: 'تأكيد الطلب'", "pageTitle: 'Order Confirmed'"],
  ["'عضو'", "'Member'"],
  ['غسول الوجه لعلاج حب الشباب - 200مل', 'Acne Facial Cleanser — 200ml'],
  ['غسول الوجه لعلاج حب الشباب', 'Acne Facial Cleanser'],
  ['تنظيف لطيف وعميق للبشرة المعرضة للحبوب', 'Gentle, deep cleansing for breakout-prone skin'],
  ['مناسب لـ: حب الشباب · البشرة الدهنية · انسداد المسام', 'Ideal for: Acne · Oily skin · Clogged pores'],
  ['مناسب لـ: ', 'Ideal for: '],
  ['عناية طبيعية فاخرة', 'Natural luxury skincare'],
  ['اكتشف المنتج', 'Discover product'],
  ['أضف للسلة', 'Add to bag'],
  ['تسوق حسب مشكلتك', 'Shop by concern'],
  ['<small>ج.م</small>', '<small>EGP</small>'],
  ['alt="منتج مونتانا"', 'alt="Montana product"'],
  ['aria-label="قيم Montana"', 'aria-label="Montana values"'],

  // ── Bridge & promo ──
  ['صُنعت بمكونات طبيعية — نتائج ملموسة من أول استخدام', 'Crafted with natural actives — visible results from first use'],
  ['مصنع معتمد', 'Certified manufacturing'],
  ['خالي من البارابين', 'Paraben-free'],
  ['مناسب للبشرة الحساسة', 'Sensitive-skin friendly'],
  ['🎁 اشتري قطعتين واحصل على الثالثة مجاناً', '🎁 Buy 2, get the 3rd free'],
  ['🚚 شحن مجاني للطلبات فوق 500 جنيه', '🚚 Free shipping on orders over 500 EGP'],
  ['✨ خصومات حصرية لأعضاء Montana Rewards', '✨ Exclusive discounts for Montana Rewards members'],

  // ── Header & nav ──
  ['<i class="fas fa-store"></i> المتجر', '<i class="fas fa-store"></i> Shop'],
  ['تتبع طلبك', 'Track order'],
  ['خدمة العملاء', 'Customer care'],
  ['placeholder="ابحث عن منتجات، ماركات، وأكثر..."', 'placeholder="Search products, brands, and more…"'],
  ['placeholder="ابحث عن منتجات، ماركات..."', 'placeholder="Search products, brands…"'],
  ['<small>المتجر</small>', '<small>Shop</small>'],
  ['<small>المفضلة</small>', '<small>Wishlist</small>'],
  ['<small>حسابي</small>', '<small>Account</small>'],
  ['<small>السلة</small>', '<small>Bag</small>'],
  ['<i class="fas fa-home"></i> الرئيسية', '<i class="fas fa-home"></i> Home'],
  ['<i class="fas fa-spa"></i> العناية بالبشرة', '<i class="fas fa-spa"></i> Skincare'],
  ['<i class="fas fa-pump-soap"></i> العناية بالشعر <small>(قريباً)</small>', '<i class="fas fa-pump-soap"></i> Hair care <small>(Coming soon)</small>'],
  ['<i class="fas fa-heartbeat"></i> الصحة والتغذية <small>(قريباً)</small>', '<i class="fas fa-heartbeat"></i> Health & wellness <small>(Coming soon)</small>'],
  ['<i class="fas fa-baby"></i> الأطفال <small>(قريباً)</small>', '<i class="fas fa-baby"></i> Kids <small>(Coming soon)</small>'],
  ['<i class="fas fa-temperature-low"></i> الثيرم <small>(قريباً)</small>', '<i class="fas fa-temperature-low"></i> Therm <small>(Coming soon)</small>'],
  ['<i class="fas fa-fire"></i> العروض', '<i class="fas fa-fire"></i> Offers'],
  ['title="قريباً"', 'title="Coming soon"'],
  ['(قريباً)', '(Coming soon)'],
  ['قريباً', 'Coming soon'],
  ['العناية بالبشرة', 'Skincare'],
  ['العناية بالشعر', 'Hair care'],
  ['الصحة والتغذية', 'Health & wellness'],
  ['الأطفال', 'Kids'],
  ['الثيرم', 'Therm'],
  ['العروض', 'Offers'],

  // ── App stories / chips ──
  ['alt="عروض اليوم"', 'alt="Today\'s deals"'],
  ['<span>عروض اليوم</span>', '<span>Today\'s deals</span>'],
  ['alt="جديد"', 'alt="New"'],
  ['<span>جديد</span>', '<span>New</span>'],
  ['alt="العناية"', 'alt="Skincare"'],
  ['<span>العناية</span>', '<span>Skincare</span>'],
  ['alt="الأكثر مبيعاً"', 'alt="Best seller"'],
  ['<span>الأكثر مبيعاً</span>', '<span>Best seller</span>'],
  ['alt="نصائح"', 'alt="Tips"'],
  ['<span>نصائح</span>', '<span>Tips</span>'],
  ['alt="صحتك"', 'alt="Wellness"'],
  ['<span>صحتك</span>', '<span>Wellness</span>'],
  ['<span>البشرة</span>', '<span>Skin</span>'],
  ['<span>الشعر</span>', '<span>Hair</span>'],
  ['<span>الصحة</span>', '<span>Health</span>'],
  ['<span>المكافآت</span>', '<span>Rewards</span>'],
  ['<span>الماركات</span>', '<span>Brands</span>'],

  // ── Features bar ──
  ['<h4>شحن سريع</h4>', '<h4>Fast delivery</h4>'],
  ['<p>توصيل خلال 24-48 ساعة</p>', '<p>24–48 hour shipping</p>'],
  ['<h4>منتجات أصلية</h4>', '<h4>Authentic products</h4>'],
  ['<p>ضمان 100% أصلي</p>', '<p>100% genuine guarantee</p>'],
  ['<h4>إرجاع سهل</h4>', '<h4>Easy returns</h4>'],
  ['<p>خلال 14 يوم</p>', '<p>Within 14 days</p>'],
  ['<h4>دفع آمن</h4>', '<h4>Secure checkout</h4>'],
  ['<p>طرق دفع متعددة</p>', '<p>Multiple payment options</p>'],

  // ── Brand story ──
  ['alt="منتجات Montana"', 'alt="Montana products"'],
  ['<span class="lux-eyebrow">قصة Montana</span>', '<span class="lux-eyebrow">The Montana story</span>'],
  ['<h2>أول تركيبة غسول كريمي في مصر — عناية فاخرة بثقة علمية</h2>', '<h2>Egypt\'s first cream-to-foam cleanser — luxury care backed by science</h2>'],
  ['<span class="lux-stat-label">منتجات متخصصة</span>', '<span class="lux-stat-label">Specialist formulas</span>'],
  ['<span class="lux-stat-label">يوم لنتائج ملحوظة</span>', '<span class="lux-stat-label">Days to visible results</span>'],
  ['<span class="lux-stat-label">منتجات أصلية</span>', '<span class="lux-stat-label">Authentic products</span>'],

  // ── Ritual ──
  ['<span class="lux-eyebrow">روتين مونتانا</span>', '<span class="lux-eyebrow">The Montana ritual</span>'],
  ['<h2>ثلاث خطوات — بشرة تلمع</h2>', '<h2>Three steps — skin that glows</h2>'],
  ['<p>نظام عناية متكامل: تنظيف، علاج، وحماية — مصمم ليعمل معاً</p>', '<p>A complete care system: cleanse, treat, and protect — designed to work in harmony</p>'],
  ['<div class="lux-ritual-num">٠١ — تنظيف</div>', '<div class="lux-ritual-num">01 — Cleanse</div>'],
  ['<div class="lux-ritual-num">٠٢ — علاج</div>', '<div class="lux-ritual-num">02 — Treat</div>'],
  ['<div class="lux-ritual-num">٠٣ — حماية</div>', '<div class="lux-ritual-num">03 — Protect</div>'],
  ['<h3>غسول الوجه</h3>', '<h3>Facial Cleanser</h3>'],
  ['<h3>كريم التفتيح</h3>', '<h3>Brightening Cream</h3>'],
  ['<h3>كريم ما بعد الليزر</h3>', '<h3>Post-Laser Cream</h3>'],
  ['alt="غسول الوجه"', 'alt="Facial cleanser"'],
  ['alt="كريم التفتيح"', 'alt="Brightening cream"'],
  ['alt="كريم ما بعد الليزر"', 'alt="Post-laser cream"'],

  // ── Ingredients ──
  ['<span class="lux-eyebrow lux-eyebrow--accent">مكونات فعّالة</span>', '<span class="lux-eyebrow lux-eyebrow--accent">Active ingredients</span>'],
  ['<h2>العلم وراء كل منتج</h2>', '<h2>The science behind every formula</h2>'],
  ['<p>مكونات طبيعية مختارة بعناية — مدعومة بتركيبات مثبتة</p>', '<p>Carefully selected natural actives — supported by proven compositions</p>'],
  ['<div class="lux-ing-product">غسول حب الشباب</div>', '<div class="lux-ing-product">Acne Cleanser</div>'],
  ['<div class="lux-ing-product">غسول التفتيح</div>', '<div class="lux-ing-product">Brightening Cleanser</div>'],
  ['<div class="lux-ing-product">كريم التفتيح</div>', '<div class="lux-ing-product">Brightening Cream</div>'],
  ['alt="غسول التفتيح والتوحيد"', 'alt="Brightening Cleanser"'],

  // ── Shop by concern headers ──
  ['<span class="lux-eyebrow">دليل العناية</span>', '<span class="lux-eyebrow">Care guide</span>'],
  ['<h2>تسوق حسب المشكلة</h2>', '<h2>Shop by concern</h2>'],
  ['<p>اختر مشكلتك واكتشفي البروتوكول المناسب من منتجات Montaña</p>', '<p>Select your concern and discover the right Montaña protocol</p>'],
  ['دواعي استعمال تجميلية للعناية بالبشرة — وليست ادعاءات علاجية. استشيري طبيب الجلدية عند الحاجة.', 'For cosmetic skincare use only — not intended as medical treatment. Consult a dermatologist when needed.'],

  // ── Categories & trending ──
  ['<h2>تسوق حسب الفئة</h2>', '<h2>Shop by category</h2>'],
  ['<p>اكتشف مجموعتنا المتنوعة من منتجات العناية</p>', '<p>Explore our curated care collection</p>'],
  ['<span class="lux-eyebrow">تصفح</span>', '<span class="lux-eyebrow">Browse</span>'],
  ['6 منتجات', '6 products'],
  ['تسوق الآن', 'Shop now'],
  ['<h2>الأكثر رواجاً</h2>', '<h2>Trending now</h2>'],
  ['<p>منتجاتنا الأكثر طلباً</p>', '<p>Our most-loved formulas</p>'],
  ['<h2>وصل حديثاً</h2>', '<h2>New arrivals</h2>'],
  ['<p>أحدث الإضافات لمجموعتنا</p>', '<p>The latest additions to our collection</p>'],
  ['عرض كل المنتجات', 'View all products'],
  ['نظرة سريعة', 'Quick view'],
  ['الكل', 'All'],
  ['<span>البشرة</span>', '<span>Skin</span>'],
  ['<button class="tab-btn" data-tab="skincare">بشرة</button>', '<button class="tab-btn" data-tab="skincare">Skin</button>'],
  ['الشعر', 'Hair'],
  ['الصحة', 'Health'],

  // ── Before/after & reviews ──
  ['<h2>نتائج تتحدث</h2>', '<h2>Results that speak</h2>'],
  ['<p>اسحب الشريط لمقارنة قبل وبعد</p>', '<p>Drag the slider to compare before and after</p>'],
  ['<span class="ba-label ba-before">قبل</span>', '<span class="ba-label ba-before">Before</span>'],
  ['<span class="ba-label ba-after">بعد</span>', '<span class="ba-label ba-after">After</span>'],
  ['<span class="lux-eyebrow lux-eyebrow--accent">آراء العملاء</span>', '<span class="lux-eyebrow lux-eyebrow--accent">Client voices</span>'],
  ['<h2>آراء عملائنا</h2>', '<h2>What our clients say</h2>'],
  ['<div class="lux-reviews-count">من أكثر من 1,200+ تقييم حقيقي</div>', '<div class="lux-reviews-count">From 1,200+ verified reviews</div>'],

  // ── Rewards & newsletter ──
  ['<h2>انضم لبرنامج المكافآت</h2>', '<h2>Join our rewards program</h2>'],
  ['<h2>اشترك في نشرتنا البريدية</h2>', '<h2>Join our newsletter</h2>'],
  ['placeholder="أدخل بريدك الإلكتروني"', 'placeholder="Enter your email address"'],
  ['<button type="submit">اشترك الآن</button>', '<button type="submit">Subscribe</button>'],
  ['عضوية ذهبية', 'Gold membership'],
  ['2,450 نقطة', '2,450 points'],

  // ── Footer ──
  ['وجهتك الأولى لمنتجات العناية الفاخرة والأصلية في مصر. نوفر لك أفضل الماركات العالمية بأسعار منافسة.', 'Your destination for premium, authentic skincare in Egypt. World-class formulas at accessible prices.'],
  ['<h3>روابط سريعة</h3>', '<h3>Quick links</h3>'],
  ['<h3>خدمة العملاء</h3>', '<h3>Customer service</h3>'],
  ['<h3>تواصل معنا</h3>', '<h3>Get in touch</h3>'],
  ['من نحن', 'About us'],
  ['تواصل معنا', 'Contact us'],
  ['الأسئلة الشائعة', 'FAQ'],
  ['سياسة الخصوصية', 'Privacy policy'],
  ['الشروط والأحكام', 'Terms & conditions'],
  ['تتبع الطلب', 'Track order'],
  ['سياسة الإرجاع', 'Return policy'],
  ['الإرجاع والاستبدال', 'Return policy'],
  ['الشحن والتوصيل', 'Shipping & delivery'],
  ['حسابي', 'My account'],
  ['القاهرة، مصر', 'Cairo, Egypt'],
  ['9 ص - 11 م يومياً', '9 AM – 11 PM daily'],
  ['© 2026 Montana. جميع الحقوق محفوظة.', '© 2026 Montana. All rights reserved. Commercial register no. 12345'],

  // ── Mobile app screens ──
  ['<h2>الأقسام</h2>', '<h2>Categories</h2>'],
  ['<h2>المفضلة</h2>', '<h2>Wishlist</h2>'],
  ['<h2>سلة التسوق</h2>', '<h2>Shopping bag</h2>'],
  ['<span>الرئيسية</span>', '<span>Home</span>'],
  ['<span>المتجر</span>', '<span>Shop</span>'],
  ['<span>المفضلة</span>', '<span>Wishlist</span>'],
  ['<span>السلة</span>', '<span>Bag</span>'],
  ['قائمة المفضلة فارغة', 'Your wishlist is empty'],
  ['اضغط على ♡ في أي منتج لإضافته هنا', 'Tap ♡ on any product to save it here'],
  ['تصفح المنتجات', 'Browse products'],
  ['السلة فارغة', 'Your bag is empty'],
  ['أضف منتجاتك المفضلة وابدأ التسوق', 'Add your favourites and start shopping'],
  ['<i class="fas fa-shopping-bag"></i> أضف للسلة', '<i class="fas fa-shopping-bag"></i> Add to bag'],
  ['<i class="fas fa-lock"></i> إتمام الطلب', '<i class="fas fa-lock"></i> Secure checkout'],
  ['المجموع الفرعي', 'Subtotal'],
  ['<span>الشحن</span>', '<span>Shipping</span>'],
  ['يُحسب عند الدفع', 'Calculated at checkout'],
  ['<span>الإجمالي</span>', '<span>Total</span>'],
  ['عرض محدود', 'Limited offer'],
  ['خصومات حتى 20%', 'Up to 20% off'],
  ['على منتجات مونتانا المختارة', 'On selected Montana formulas'],
  ['<h3>عروض اليوم</h3>', '<h3>Today\'s deals</h3>'],
  ['أقسام وماركات جديدة في الطريق إليكم', 'New Montana categories on the way'],

  // ── Product names (cards) ──
  ['كريم التفتيح بالألفا أربوتين', 'Brightening Cream with Alpha Arbutin'],
  ['غسول التفتيح والتوحيد', 'Brightening & Tone-Evening Cleanser'],
  ['غسول حب الشباب', 'Acne Facial Cleanser'],
  ['كريم ما بعد الليزر بزيت السمسم', 'Post-Laser Recovery Cream with Sesame Oil'],
  ['جل السيليكون لعلاج الندبات', 'Anti-Scar Silicone Gel'],
  ['جل علاج الندبات', 'Anti-Scar Silicone Gel'],
  ['لوشن اليدين والجسم', 'Hand & Body Lotion'],
  ['لوشن الجسم', 'Hand & Body Lotion'],
  ['كريم تفتيح', 'Brightening Cream'],
  ['كريم الليزر', 'Post-Laser Cream'],
  ['كريم تفتيح', 'Brightening Cream'],

  // ── Shop page ──
  ['تركيبات طبية فاخرة — معايير عالمية، صُنعت بعناية في مصر', 'Clinical-grade formulas — Egyptian craft, global standards'],
  ['شحن مجاني فوق 500 ج.م', 'Free shipping over 500 EGP'],
  ['منتجات أصلية 100%', '100% authentic products'],
  ['غسول', 'Cleanser'],
  ['سيروم', 'Serum'],
  ['لوشن', 'Lotion'],
  ['title="بحث"', 'title="Search"'],
  ['aria-label="ترتيب المنتجات"', 'aria-label="Sort products"'],
  ['الترتيب الافتراضي', 'Featured'],
  ['السعر: من الأقل', 'Price: low to high'],
  ['السعر: من الأعلى', 'Price: high to low'],
  ['الأعلى تقييماً', 'Top rated'],
  ['جارٍ التحميل…', 'Loading…'],
  ['الأكثر مبيعاً', 'Best seller'],
  ['جديد', 'New'],
  ['خصم', 'Sale'],
  ['تفاصيل المنتج', 'Product details'],
  ['وصف المنتج', 'Description'],
  ['<h3>المكونات</h3>', '<h3>Key ingredients</h3>'],
  ['التقييمات', 'Reviews'],
  ['إرسال التقييم', 'Submit review'],
  ['تعليقك (اختياري)', 'Your comment (optional)'],
  ['اسمك', 'Your name'],
  ['منتجات مشابهة', 'You may also like'],
  ['تمت الإضافة للسلة', 'Added to bag'],
  ['تعذّر العثور على هذا المنتج', 'Product not found'],
  ['تصفّح المنتجات', 'Browse products'],
  ['لم يتم تحديد منتج', 'No product selected'],

  // ── Checkout ──
  ['إتمام الطلب', 'Checkout'],
  ['<span>1</span> العنوان', '<span>1</span> Address'],
  ['<span>2</span> الدفع', '<span>2</span> Payment'],
  ['<span>3</span> التأكيد', '<span>3</span> Confirm'],
  ['بيانات التوصيل', 'Delivery details'],
  ['الاسم بالكامل', 'Full name'],
  ['placeholder="اسمك"', 'placeholder="Your name"'],
  ['رقم الهاتف', 'Phone number'],
  ['البريد الإلكتروني (اختياري)', 'Email (optional)'],
  ['العنوان بالتفصيل', 'Full address'],
  ['placeholder="الشارع، الحي، رقم العقار"', 'placeholder="Street, area, building number"'],
  ['المدينة', 'City'],
  ['placeholder="القاهرة"', 'placeholder="Cairo"'],
  ['طريقة التوصيل', 'Delivery method'],
  ['جارٍ تحميل المحافظات…', 'Loading governorates…'],
  ['طريقة الدفع', 'Payment method'],
  ['الدفع عند الاستلام', 'Cash on delivery'],
  ['200 ج.م مقدم + الباقي كاش عند الاستلام', '200 EGP deposit + remainder in cash on delivery'],
  ['محفظة إلكترونية / إنستاباي', 'Mobile wallet / InstaPay'],
  ['تحويل قيمة الأوردر كاملة', 'Transfer the full order amount'],
  ['بطاقة ائتمان / Meeza', 'Credit card / Meeza'],
  ['دفع آمن عبر Paymob', 'Secure payment via Paymob'],
  ['بطاقة ائتمان', 'Credit card'],
  ['كود خصم', 'Discount code'],
  ['placeholder="أدخل كود الخصم"', 'placeholder="Enter discount code"'],
  ['تطبيق', 'Apply'],
  ['نقطة — كل 10 نقاط = 1 ج.م خصم', 'points — every 10 points = 1 EGP off'],
  ['ملخص الطلب', 'Order summary'],
  ['<span>الخصم</span>', '<span>Discount</span>'],
  ['خصم النقاط', 'Points discount'],
  ['<span>الإجمالي</span>', '<span>Total</span>'],
  ['<i class="fas fa-check"></i> تأكيد الطلب', '<i class="fas fa-check"></i> Place order'],
  ['مجاني', 'Free'],
  ['0 ج.م', '0 EGP'],
  ['- 0 ج.م', '- 0 EGP'],
  ['ج.م', 'EGP'],

  // ── Contact ──
  ['اتصل بنا', 'Call us'],
  ['واتساب', 'WhatsApp'],
  ['محادثة فورية', 'Instant chat'],
  ['البريد', 'Email'],
  ['ساعات العمل', 'Working hours'],
  ['يومياً من 9 صباحاً حتى 11 مساءً', 'Daily 9 AM – 11 PM'],
  ['أرسل لنا رسالة', 'Send us a message'],
  ['الاسم', 'Name'],
  ['placeholder="أدخل اسمك الكامل"', 'placeholder="Your full name"'],
  ['البريد الإلكتروني', 'Email'],
  ['رقم الطلب (اختياري)', 'Order number (optional)'],
  ['الموضوع', 'Subject'],
  ['<option>استفسار عام</option>', '<option>General inquiry</option>'],
  ['<option>مشكلة في الطلب</option>', '<option>Order issue</option>'],
  ['<option>إرجاع أو استبدال</option>', '<option>Return or exchange</option>'],
  ['<option>اقتراح أو شكوى</option>', '<option>Suggestion or complaint</option>'],
  ['<option>شراكات تجارية</option>', '<option>Business partnership</option>'],
  ['الرسالة', 'Message'],
  ['placeholder="اكتب رسالتك هنا..."', 'placeholder="Write your message here…"'],
  ['<i class="fas fa-paper-plane"></i> إرسال الرسالة', '<i class="fas fa-paper-plane"></i> Send message'],
  ['<i class="fas fa-map-marker-alt"></i> موقعنا', '<i class="fas fa-map-marker-alt"></i> Our location'],
  ['تابعنا', 'Follow us'],

  // ── About ──
  ['وجهتك الأولى للعناية الفاخرة', 'Your destination for premium skincare'],
  ['<h3>قصتنا</h3>', '<h3>Our story</h3>'],
  ['<h3>رؤيتنا</h3>', '<h3>Our vision</h3>'],
  ['<span>عميل سعيد</span>', '<span>Happy clients</span>'],
  ['<span>منتج أصلي</span>', '<span>Authentic products</span>'],
  ['<span>ماركة عالمية</span>', '<span>Global brands</span>'],
  ['<span>تقييم العملاء</span>', '<span>Customer rating</span>'],
  ['<h3>لماذا Montana؟</h3>', '<h3>Why Montana?</h3>'],
  ['<h4>منتجات أصلية 100%</h4>', '<h4>100% authentic</h4>'],
  ['<h4>توصيل سريع</h4>', '<h4>Fast delivery</h4>'],
  ['<h4>خدمة عملاء متميزة</h4>', '<h4>Premium support</h4>'],
  ['<h4>سياسة إرجاع مرنة</h4>', '<h4>Flexible returns</h4>'],

  // ── Search ──
  ['البحث', 'Search'],
  ['عمليات بحث سابقة', 'Recent searches'],
  ['مسح الكل', 'Clear all'],
  ['الأكثر بحثاً', 'Trending searches'],
  ['أقسام شائعة', 'Popular categories'],
  ['نتائج البحث', 'Search results'],
  ['لا توجد نتائج', 'No results found'],
  ['<i class="fas fa-spa"></i> العناية بالبشرة', '<i class="fas fa-spa"></i> Skincare'],
  ['<i class="fas fa-pump-soap"></i> العناية بالشعر (قريباً)', '<i class="fas fa-pump-soap"></i> Hair care (Coming soon)'],
  ['<i class="fas fa-heartbeat"></i> الصحة والتغذية (قريباً)', '<i class="fas fa-heartbeat"></i> Health & wellness (Coming soon)'],
  ['<i class="fas fa-baby"></i> الأطفال (قريباً)', '<i class="fas fa-baby"></i> Kids (Coming soon)'],
  ['<i class="fas fa-temperature-low"></i> الثيرم (قريباً)', '<i class="fas fa-temperature-low"></i> Therm (Coming soon)'],

  // ── Brand story paragraphs ──
  ['<p>منذ البداية، Montana صممت منتجات تجمع بين المكونات الطبيعية الفعّالة والتركيبات المطورة سريرياً — بدون compromis على الجودة أو الأناقة.</p>', '<p>From the start, Montana has crafted formulas that unite potent natural actives with clinically developed compositions — without compromise on quality or elegance.</p>'],
  ['<p>كل منتج يمر بمراحل اختبار دقيقة ليمنح بشرتك نتائج ملموسة: تنظيف عميق، تفتيح موحّد، وترميم — في روتين يومي بسيط.</p>', '<p>Every product undergoes rigorous testing to deliver tangible results: deep cleansing, even brightening, and barrier repair — in a simple daily ritual.</p>'],

  // ── Ritual step descriptions ──
  ['<p>تنظيف لطيف وعميق — بداية كل روتين ناجح</p>', '<p>Gentle, deep cleansing — the foundation of every successful routine</p>'],
  ['<p>توحيد اللون وإشراقة يومية للبشرة</p>', '<p>Even tone and daily radiance for your complexion</p>'],
  ['<p>تهدئة وترميم — حماية بعد الإجراءات</p>', '<p>Soothe and restore — protection after professional treatments</p>'],

  // ── Ingredient list items ──
  ['<li><span class="lux-ing-dot"></span>حمض الساليسيليك</li>', '<li><span class="lux-ing-dot"></span>Salicylic Acid</li>'],
  ['<li><span class="lux-ing-dot"></span>نياسيناميد (B3)</li>', '<li><span class="lux-ing-dot"></span>Niacinamide (B3)</li>'],
  ['<li><span class="lux-ing-dot"></span>زيت الأرجان، زيت الجوجوبا</li>', '<li><span class="lux-ing-dot"></span>Argan Oil, Jojoba Oil</li>'],
  ['<li><span class="lux-ing-dot"></span>خلاصة العرقسوس</li>', '<li><span class="lux-ing-dot"></span>Licorice Extract</li>'],
  ['<li><span class="lux-ing-dot"></span>فيتامين C</li>', '<li><span class="lux-ing-dot"></span>Vitamin C</li>'],
  ['<li><span class="lux-ing-dot"></span>ألفا أربوتين</li>', '<li><span class="lux-ing-dot"></span>Alpha Arbutin</li>'],
  ['<li><span class="lux-ing-dot"></span>فيتامين C &amp; E</li>', '<li><span class="lux-ing-dot"></span>Vitamins C &amp; E</li>'],
  ['<a href="product.html?slug=acne-facial-cleanser" class="lux-ing-link">اكتشف المنتج <i class="fas fa-arrow-left"></i></a>', '<a href="product.html?slug=acne-facial-cleanser" class="lux-ing-link">Discover product <i class="fas fa-arrow-left"></i></a>'],
  ['<a href="product.html?slug=whitening-cleanser" class="lux-ing-link">اكتشف المنتج <i class="fas fa-arrow-left"></i></a>', '<a href="product.html?slug=whitening-cleanser" class="lux-ing-link">Discover product <i class="fas fa-arrow-left"></i></a>'],
  ['<a href="product.html?slug=whitening-cream" class="lux-ing-link">اكتشف المنتج <i class="fas fa-arrow-left"></i></a>', '<a href="product.html?slug=whitening-cream" class="lux-ing-link">Discover product <i class="fas fa-arrow-left"></i></a>'],

  // ── Categories & roadmap ──
  ['<p>أقسام جديدة من منتجات مونتانا في الطريق إليكم</p>', '<p>New Montana categories on the way</p>'],
  ['<p><strong>قريباً:</strong> العناية بالشعر · الصحة والتغذية · منتجات الأطفال · الثيرم</p>', '<p><strong>Coming soon:</strong> Hair care · Health & wellness · Kids · Therm</p>'],
  ['<img src="../images/category-skincare.png" alt="العناية بالبشرة">', '<img src="../images/category-skincare.png" alt="Skincare">'],

  // ── Trending tabs & footer ──
  ['<button class="tab-btn active" data-tab="all">الكل</button>', '<button class="tab-btn active" data-tab="all">All</button>'],
  ['<button class="tab-btn" data-tab="skincare">بشرة</button>', '<button class="tab-btn" data-tab="skincare">Skin</button>'],
  ['<button class="tab-btn" data-tab="haircare">شعر</button>', '<button class="tab-btn" data-tab="haircare">Hair</button>'],
  ['<button class="tab-btn" data-tab="health">صحة</button>', '<button class="tab-btn" data-tab="health">Health</button>'],
  ['<button class="tab-btn" data-tab="kids">أطفال</button>', '<button class="tab-btn" data-tab="kids">Kids</button>'],
  ['<button class="tab-btn" data-tab="therm">ثيرم</button>', '<button class="tab-btn" data-tab="therm">Therm</button>'],
  ['<p>المنتجات الأكثر طلباً من عملائنا</p>', '<p>Our most-loved formulas</p>'],
  ['<a href="category.html" class="btn-outline">عرض جميع المنتجات <i class="fas fa-arrow-left"></i></a>', '<a href="category.html" class="btn-outline">View all products <i class="fas fa-arrow-left"></i></a>'],
  ['<span class="badge-best">الأكثر مبيعاً</span>', '<span class="badge-best">Best seller</span>'],
  ['<span class="badge-new">جديد</span>', '<span class="badge-new">New</span>'],

  // ── Product card names (with sizes) ──
  ['منتجات Montaña للعناية بالبشرة — غسول التفتيح، كريم التفتيح، غسول حب الشباب، لوشن اليدين والجسم، وكريم ما بعد الليزر',
   'Montana skincare range — Whitening Cleanser, Whitening Cream, Acne Facial Cleanser, Hand & Body Lotion and Post Laser Cream'],
  ['عناية طبيعية · نتائج حقيقية', 'Natural Care · Real Results'],
  ['بشرة صحية', 'Healthy Skin'],
  ['وأنتِ أسعد', 'Happier You'],
  ['غسول الوجه لعلاج حب الشباب - 200مل', 'Acne Facial Cleanser — 200ml'],
  ['غسول التفتيح والتوحيد - 200مل', 'Brightening & Tone-Evening Cleanser — 200ml'],
  ['كريم التفتيح بالألفا أربوتين - 50مل', 'Brightening Cream with Alpha Arbutin — 50ml'],
  ['لوشن اليدين والجسم - ترطيب 72 ساعة - 50مل', 'Hand & Body Lotion — 72hr Hydration — 50ml'],
  ['كريم ما بعد الليزر بزيت السمسم - 50مل', 'Post-Laser Recovery Cream with Sesame Oil — 50ml'],
  ['جل السيليكون لعلاج الندبات - 50مل', 'Anti-Scar Silicone Gel — 50ml'],
  ['- 200مل', '— 200ml'],
  ['- 50مل', '— 50ml'],
  ['285 ج.م', '285 EGP'],
  ['350 ج.م', '350 EGP'],
  ['310 ج.م', '310 EGP'],
  ['240 ج.م', '240 EGP'],
  ['300 ج.م', '300 EGP'],
  ['195 ج.م', '195 EGP'],
  ['265 ج.م', '265 EGP'],
  ['320 ج.م', '320 EGP'],
  ['340 ج.م', '340 EGP'],
  ['400 ج.م', '400 EGP'],

  // ── New arrivals ──
  ['<p>أحدث المنتجات المضافة لمتجرنا</p>', '<p>The latest additions to our collection</p>'],
  ['<p>منتجات جديدة من مونتانا في الطريق إليكم</p>', '<p>New Montana launches arriving soon</p>'],

  // ── Before & after ──
  ['<h2>النتائج تتحدث</h2>', '<h2>Results that speak</h2>'],
  ['<p>شاهد الفرق بنفسك — اسحب المؤشر لمقارنة قبل وبعد الاستخدام</p>', '<p>See the difference yourself — drag the slider to compare before and after</p>'],
  ['alt="بعد"', 'alt="After"'],
  ['alt="قبل"', 'alt="Before"'],
  ['<span class="ba-label ba-label-after">بعد</span>', '<span class="ba-label ba-label-after">After</span>'],
  ['<span class="ba-label ba-label-before">قبل</span>', '<span class="ba-label ba-label-before">Before</span>'],
  ['<span class="ba-product-tag">علاج حب الشباب</span>', '<span class="ba-product-tag">Acne care</span>'],
  ['<span class="ba-product-tag">التفتيح والتوحيد</span>', '<span class="ba-product-tag">Brightening</span>'],
  ['<span class="ba-product-tag">ما بعد الليزر</span>', '<span class="ba-product-tag">Post-laser</span>'],
  ['<h3>غسول التفتيح والتوحيد</h3>', '<h3>Brightening & Tone-Evening Cleanser</h3>'],
  ['<h3>كريم ما بعد الليزر</h3>', '<h3>Post-Laser Recovery Cream</h3>'],
  ['<p>بشرة نظيفة وصافية خلال 14 يوم من الاستخدام</p>', '<p>Clearer, cleaner skin in as little as 14 days</p>'],
  ['<p>بشرة موحدة ومشرقة - تفتيح البقع الداكنة والتصبغات</p>', '<p>Even, radiant skin — helps fade dark spots and discoloration</p>'],
  ['<p>يهدئ ويعالج ويصلح البشرة - الاحمرار يروح في يومين</p>', '<p>Soothes, repairs, and restores — redness can fade in days</p>'],
  ['<a href="product.html" class="btn-primary">تسوق المنتج</a>', '<a href="product.html" class="btn-primary">Shop product</a>'],

  // ── Rewards ──
  ['<p>اكسب نقاط مع كل عملية شراء واستبدلها بخصومات حصرية ومنتجات مجانية</p>', '<p>Earn points with every purchase and redeem for exclusive discounts and complimentary products</p>'],
  ['<span>هدية ترحيبية</span>', '<span>Welcome gift</span>'],
  ['<span>خصومات حصرية</span>', '<span>Member-only savings</span>'],
  ['<span>وصول مبكر للعروض</span>', '<span>Early access to offers</span>'],
  ['<span>شحن مجاني</span>', '<span>Free shipping</span>'],
  ['<a href="account.html" class="btn-primary btn-lg">سجل الآن مجاناً</a>', '<a href="account.html" class="btn-primary btn-lg">Join free</a>'],

  // ── Homepage reviews ──
  ['<p class="lux-review-text">«غسول حب الشباب غيّر بشرتي خلال أسبوعين — بشرة أنظف وأقل حبوب. رائحة هادية ومش جافة خالص.»</p>', '<p class="lux-review-text">"The Acne Cleanser transformed my skin in two weeks — clearer, fewer breakouts. Gentle scent and never drying."</p>'],
  ['<div class="lux-review-avatar">س</div>', '<div class="lux-review-avatar">S</div>'],
  ['<div class="lux-review-name">سارة م.</div>', '<div class="lux-review-name">Sarah M.</div>'],
  ['<div class="lux-review-meta">غسول الوجه لعلاج حب الشباب</div>', '<div class="lux-review-meta">Acne Facial Cleanser</div>'],
  ['<p class="lux-review-text">«غسول التفتيح فعلاً بيوحّد لون البشرة — استخدمته 3 أسابيع والبقع بدأت تخف. التغليف شيك جداً.»</p>', '<p class="lux-review-text">"The Brightening Cleanser genuinely evens my tone — three weeks in and spots are fading. The packaging feels so luxe."</p>'],
  ['<div class="lux-review-avatar">ن</div>', '<div class="lux-review-avatar">N</div>'],
  ['<div class="lux-review-name">نورهان أ.</div>', '<div class="lux-review-name">Norhan A.</div>'],
  ['<div class="lux-review-meta">غسول التفتيح والتوحيد</div>', '<div class="lux-review-meta">Brightening Cleanser</div>'],
  ['<p class="lux-review-text">«كريم ما بعد الليزر أنقذ بشرتي بعد الجلسة — الاحمرار راح في يومين. Montana بقت ماركة ثقة عندي.»</p>', '<p class="lux-review-text">"Post-Laser Cream saved my skin after treatment — redness gone in two days. Montana is a brand I trust now."</p>'],
  ['<div class="lux-review-avatar">م</div>', '<div class="lux-review-avatar">M</div>'],
  ['<div class="lux-review-name">مريم ك.</div>', '<div class="lux-review-name">Mariam K.</div>'],
  ['<div class="lux-review-meta">كريم ما بعد الليزر بزيت السمسم</div>', '<div class="lux-review-meta">Post-Laser Recovery Cream</div>'],
  ['<div class="lux-review-meta">كريم ما بعد الليزر</div>', '<div class="lux-review-meta">Post-Laser Recovery Cream</div>'],

  // ── About page body ──
  ['<h2>من نحن</h2>', '<h2>About us</h2>'],
  ['<p>Montana تأسست بهدف توفير أفضل منتجات العناية بالبشرة والشعر والصحة في مصر. نؤمن بأن كل شخص يستحق الحصول على منتجات أصلية وعالية الجودة بأسعار منافسة.</p>', '<p>Montana was founded to bring Egypt the finest skincare, hair, and wellness products. We believe everyone deserves authentic, premium formulas at fair prices.</p>'],
  ['<p>أن نكون المنصة الأولى والأكثر ثقة لمنتجات العناية في المنطقة العربية، مع التزامنا بتقديم تجربة تسوق استثنائية.</p>', '<p>To be the most trusted destination for premium care across the region — with an exceptional shopping experience at every touchpoint.</p>'],
  ['<p>نضمن أصالة جميع المنتجات بشهادات رسمية من الوكلاء المعتمدين.</p>', '<p>We guarantee authenticity with official certificates from authorized distributors.</p>'],
  ['<p>نوصل طلبك خلال 24-48 ساعة لأي مكان في مصر.</p>', '<p>We deliver anywhere in Egypt within 24–48 hours.</p>'],
  ['<p>فريقنا متاح يومياً من 9 صباحاً حتى 11 مساءً للرد على استفساراتك.</p>', '<p>Our team is available daily, 9 AM to 11 PM, to answer your questions.</p>'],
  ['<p>يمكنك إرجاع أو استبدال أي منتج خلال 14 يوم من الاستلام.</p>', '<p>Return or exchange any product within 14 days of delivery.</p>'],

  // ── Shop page filters & trust ──
  ['<button type="button" class="cat-sub active" data-filter="all">الكل</button>', '<button type="button" class="cat-sub active" data-filter="all">All</button>'],
  ['<button type="button" class="cat-sub" data-filter="cleanser">غسول</button>', '<button type="button" class="cat-sub" data-filter="cleanser">Cleanser</button>'],
  ['<button type="button" class="cat-sub" data-filter="cream">كريم</button>', '<button type="button" class="cat-sub" data-filter="cream">Cream</button>'],
  ['<button type="button" class="cat-sub" data-filter="serum">سيروم</button>', '<button type="button" class="cat-sub" data-filter="serum">Serum</button>'],
  ['<button type="button" class="cat-sub" data-filter="lotion">لوشن</button>', '<button type="button" class="cat-sub" data-filter="lotion">Lotion</button>'],
  ['<span>تركيبات dermatologically tested</span>', '<span>Dermatologically tested formulas</span>'],
  ['<h2 id="shopPageTitle">العناية بالبشرة</h2>', '<h2 id="shopPageTitle">Skincare</h2>'],
  ['<h1 class="shop-title" id="shopHeroTitle">العناية بالبشرة</h1>', '<h1 class="shop-title" id="shopHeroTitle">Skincare</h1>'],

  // ── Checkout ──
  ['رصيدك:', 'Your balance:'],

  // ── Concern cards (fallback if grid not cleared) ──
  ['<h3>حب الشباب</h3>', '<h3>Acne</h3>'],
  ['<h3>آثار الحبوب</h3>', '<h3>Post-acne marks</h3>'],
  ['<h3>عدم توحيد اللون</h3>', '<h3>Uneven tone</h3>'],
  ['<h3>التصبغات والبقع</h3>', '<h3>Dark spots</h3>'],
  ['<h3>دعم الكلف</h3>', '<h3>Melasma support</h3>'],
  ['<h3>ما بعد الليزر</h3>', '<h3>Post-laser</h3>'],
  ['<h3>الجفاف والترطيب</h3>', '<h3>Dryness & hydration</h3>'],
  ['<h3>الندبات</h3>', '<h3>Scars</h3>'],
  ['<h3>مناطق داكنة بالجسم</h3>', '<h3>Body dark areas</h3>'],
  ['<a href="product.html?slug=anti-scar-gel" class="lux-concern-chip">جل السيليكون</a>', '<a href="product.html?slug=anti-scar-gel" class="lux-concern-chip">Scar Gel</a>'],

  // ── Newsletter & footer (full strings — avoid partial word replacement) ──
  ['<p>احصل على أحدث العروض والخصومات مباشرة في بريدك الإلكتروني</p>', '<p>Receive the latest offers and exclusive savings straight to your inbox</p>'],
  ['<p>&copy; 2026 Montana. جميع الحقوق محفوظة. سجل تجاري رقم: 12345</p>', '<p>&copy; 2026 Montana. All rights reserved. Commercial register no. 12345</p>'],
  ['<!-- Slider 2 - غسول التفتيح -->', '<!-- Slider 2 - Brightening Cleanser -->'],
  ['Cream ما بعد الليزر', 'Post-Laser Recovery Cream'],

  // ── Order confirmation (static shell) ──
  ['<title>Montana | تم تأكيد الطلب</title>', '<title>Montana | Order confirmed</title>'],
  ['<h2 id="confPageTitle">تأكيد الطلب</h2>', '<h2 id="confPageTitle">Order confirmation</h2>'],
  ['<span id="ingLoading">جارٍ التحميل…</span>', '<span id="ingLoading">Loading…</span>'],
  ['<h2 id="ingPageTitle">المكون</h2>', '<h2 id="ingPageTitle">Ingredient</h2>'],
  ['<title>Montana | المكونات</title>', '<title>Montana | Ingredients</title>'],

  // ── Icons ──
  ['fa-arrow-right', 'fa-arrow-left'],
];

/** Allowed Arabic on EN pages (language switcher label) */
export const EN_ARABIC_ALLOW = ['العربية', 'Arabic'];

export function applyEnText(html) {
  const pairs = [...EN_TEXT_PAIRS].sort((a, b) => b[0].length - a[0].length);
  let out = html;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return postProcessEnHtml(out);
}

/** Strip Arabic from inline scripts and fix partial replacements on EN pages */
export function postProcessEnHtml(html) {
  let out = html;

  out = out.replace(/(\d+)مل/g, '$1ml');
  out = out.replace(/عرض All/g, 'View all');
  out = out.replace(/Newة/g, 'New');
  out = out.replace(/عناية بSkin/g, 'Luxury skincare');
  out = out.replace(/بSkin/g, ' skincare');
  out = out.replace(/Skin Skin/g, 'skin');
  out = out.replace(/Key ingredients الطبيعية/g, 'potent natural actives');
  out = out.replace(/L\(\)\?\.ingredients \|\| 'المكونات'/g, "L()?.ingredients || 'Key ingredients'");
  out = out.replace(/<!--([^-][\s\S]*?)-->/g, (m, body) => {
    if (/[\u0600-\u06FF]/.test(body)) return '';
    return m;
  });

  out = out.replace(
    /function shopCopy\(\) \{[\s\S]*?\n\}/,
    'function shopCopy() { return UI_STRINGS.shop; }'
  );
  out = out.replace(
    /function badgeLabels\(\) \{[\s\S]*?\n\}/,
    'function badgeLabels() { return UI_STRINGS.badges; }'
  );
  out = out.replace(/const BADGE_LABEL_AR = \{[\s\S]*?\};\r?\n/, '');
  out = out.replace(
    /return getLocale\(\) === 'en' \? `\$\{n\} products` : `\$\{n\} \$\{s\.products\}`;/,
    'return `${n} products`;',
  );

  out = out.replace(
    /\['', 'التقييم'\],[\s\S]*?\['1', '★☆☆☆☆ ضعيف'\]/,
    "['', 'Rating'], ['5', '★★★★★ Excellent'], ['4', '★★★★☆ Very good'], ['3', '★★★☆☆ Good'], ['2', '★★☆☆☆ Fair'], ['1', '★☆☆☆☆ Poor']",
  );
  out = out.replace(
    /L\(\)\?\.noReviews \|\| '[^']*'/g,
    "L()?.noReviews || 'No reviews yet — be the first!'",
  );
  out = out.replace(
    /`<p class="pd-indication-combo"><strong>يُكمّل مع:<\/strong>/g,
    '`<p class="pd-indication-combo"><strong>Pairs well with:</strong>',
  );
  out = out.replace(/<h3>دواعي الاستعمال<\/h3>/g, '<h3>Indications</h3>');
  out = out.replace(/getLocale\(\) === 'en' \? ',' : '،'/g, "','");
  out = out.replace(
    /getLocale\(\) === 'en' \? UI_STRINGS\.product\.reviewsCount : 'تقييم'/g,
    'UI_STRINGS.product.reviewsCount',
  );
  out = out.replace(
    /getLocale\(\) === 'en' \? UI_STRINGS\.product\.reviewThanks : '[^']*'/g,
    'UI_STRINGS.product.reviewThanks',
  );
  out = out.replace(
    /getLocale\(\) === 'en' \? UI_STRINGS\.product\.reviewError : '[^']*'/g,
    'UI_STRINGS.product.reviewError',
  );

  out = out.replace(
    /const CONTACT_MSG = \{[\s\S]*?\};\r?\n\r?\n/,
    `const CONTACT_MSG = UI_STRINGS.contact;\n\n`,
  );
  out = out.replace(
    /const msgs = getLocale\(\) === 'en' \? CONTACT_MSG\.en : CONTACT_MSG\.ar;/,
    'const msgs = CONTACT_MSG;',
  );

  return out;
}

export function findRemainingArabic(html, file = '') {
  const re = /[\u0600-\u06FF]+/g;
  const found = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const word = m[0];
    if (!EN_ARABIC_ALLOW.some((a) => word.includes(a))) found.add(word);
  }
  return [...found];
}
