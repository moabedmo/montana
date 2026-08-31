/** Montana — English locale (premium skincare marketing copy) */

export const CURRENCY = {
  code: 'EGP',
  symbol: 'EGP',
  /** @param {number} n */
  format(n) {
    const num = Math.round(Number(n) || 0);
    return `${num.toLocaleString('en-EG')} EGP`;
  },
};

export const COSMETIC_DISCLAIMER =
  'For cosmetic skincare use only — not intended as medical treatment. Consult a dermatologist when needed.';

export const UI_STRINGS = {
  meta: {
    siteTitle: 'Montana | Luxury Skincare',
    productTitle: 'Montana | Product Details',
  },

  floatingStore: 'Shop',

  hero: {
    chipSub: 'Natural luxury skincare',
    titleBefore: 'Luxury care for ',
    titleEm: 'your skin',
    titleHtml: 'Luxury care for <em>your skin</em>',
    concernsPrefix: 'Ideal for: ',
    discoverCta: 'Discover product',
    addToCart: 'Add to bag',
    scrollLabel: 'Shop by concern',
  },

  bridge: {
    ariaLabel: 'Montana values',
    tagline: 'Crafted with natural actives — visible results from first use',
    trust: ['Certified manufacturing', 'Paraben-free', 'Sensitive-skin friendly'],
  },

  promo: [
    'Shipping from 50 EGP by governorate — free on 3+ products',
    'Exclusive discounts for Montana Rewards members',
  ],

  header: {
    trackOrder: 'Track order',
    customerCare: 'Customer care',
    language: 'English',
    searchPlaceholder: 'Search products, brands, and more…',
    store: 'Shop',
    wishlist: 'Wishlist',
    account: 'Account',
    cart: 'Bag',
  },

  nav: {
    home: 'Home',
    skincare: 'Skincare',
    haircare: 'Hair care',
    health: 'Health & wellness',
    kids: 'Kids',
    therm: 'Therm',
    comingSoon: 'Coming soon',
    offers: 'Offers',
    rewards: 'Montana Rewards',
  },

  features: {
    fastShipping: { title: 'Fast delivery', desc: '24–48 hour shipping' },
    authentic: { title: 'Authentic products', desc: '100% genuine guarantee' },
    easyReturns: { title: 'Easy returns', desc: 'Within 14 days' },
    securePay: { title: 'Secure checkout', desc: 'Multiple payment options' },
  },

  categories: {
    eyebrow: 'Browse',
    title: 'Shop by category',
    subtitle: 'Explore our curated care collection',
    skincare: 'Skincare',
    productCount: '6 products',
    shopNow: 'Shop now',
    comingSoonTitle: 'Coming soon',
    comingSoonDesc: 'New Montana categories on the way',
    roadmap: 'Coming soon: Hair care · Health & wellness · Kids · Therm',
  },

  trending: {
    title: 'Trending now',
    subtitle: 'Our most-loved formulas',
    tabs: { all: 'All', skincare: 'Skin', haircare: 'Hair', health: 'Health', kids: 'Kids', therm: 'Therm' },
    viewAll: 'View all products',
    quickView: 'Quick view',
    addToCart: 'Add to bag',
  },

  newArrivals: {
    title: 'New arrivals',
    subtitle: 'The latest additions to our collection',
    comingSoonTitle: 'Coming soon',
    comingSoonDesc: 'New Montana launches arriving soon',
  },

  beforeAfter: {
    title: 'Results that speak',
    subtitle: 'Drag the slider to compare before and after',
    before: 'Before',
    after: 'After',
    shopProduct: 'Shop product',
  },

  rewards: {
    badge: 'Montana Rewards',
    title: 'Join our rewards program',
    subtitle: 'Earn points with every purchase and redeem for exclusive discounts and complimentary products',
    perks: ['Welcome gift', 'Member-only savings', 'Early access to offers', 'Free shipping'],
    cta: 'Join free',
    cardTier: 'Gold membership',
    cardPoints: '2,450 points',
  },

  shopByConcern: {
    eyebrow: 'Care guide',
    title: 'Shop by concern',
    subtitle: 'Select your concern and discover the right Montaña protocol',
  },

  badges: {
    bestSeller: 'Best seller',
    new: 'New',
    sale: 'Sale',
  },

  cart: {
    title: 'Shopping bag',
    emptyTitle: 'Your bag is empty',
    emptyDesc: 'Add your favourites and start shopping',
    browse: 'Browse products',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    shippingCalc: 'Calculated at checkout',
    total: 'Total',
    checkout: 'Secure checkout',
    addToCart: 'Add to bag',
    remove: 'Remove',
  },

  wishlist: {
    title: 'Wishlist',
    emptyTitle: 'Your wishlist is empty',
    emptyDesc: 'Tap ♡ on any product to save it here',
  },

  offers: {
    title: 'Offers',
    limited: 'Limited offer',
    headline: 'Up to 20% off',
    desc: 'On selected Montana formulas',
    shopNow: 'Shop now',
    todayDeals: "Today's deals",
  },

  app: {
    home: 'Home',
    store: 'Shop',
    offers: 'Offers',
    wishlist: 'Wishlist',
    cart: 'Bag',
    categories: 'Categories',
    rewards: 'Rewards',
    brands: 'Brands',
  },

  modal: {
    addToCart: 'Add to bag',
  },

  footer: {
    tagline:
      'Your destination for premium, authentic skincare in Egypt. World-class formulas at accessible prices.',
    quickLinks: 'Quick links',
    about: 'About us',
    contact: 'Contact',
    faq: 'FAQ',
    privacy: 'Privacy policy',
    terms: 'Terms & conditions',
    customerService: 'Customer service',
    trackOrder: 'Track order',
    returns: 'Return policy',
    shipping: 'Shipping & delivery',
    myAccount: 'My account',
    contactUs: 'Get in touch',
    hours: '9 AM – 11 PM daily',
    copyright: '© 2026 Montana. All rights reserved. Commercial register no. 12345',
  },

  product: {
    loading: 'Loading…',
    details: 'Product details',
    description: 'Description',
    ingredients: 'Key ingredients',
    skinType: 'Skin type',
    reviews: 'Reviews',
    noReviews: 'No reviews yet — be the first!',
    writeReview: 'Submit review',
    reviewThanks: 'Thank you! Your review was submitted ✓',
    reviewError: 'Could not submit review — try again',
    reviewName: 'Your name',
    reviewRating: 'Rating',
    reviewComment: 'Your comment (optional)',
    reviewExcellent: '★★★★★ Excellent',
    reviewVeryGood: '★★★★☆ Very good',
    reviewGood: '★★★☆☆ Good',
    reviewFair: '★★☆☆☆ Fair',
    reviewPoor: '★☆☆☆☆ Poor',
    related: 'You may also like',
    addToBag: 'Add to bag',
    addedToBag: 'Added to bag',
    indications: 'Indications',
    pairsWith: 'Pairs well with:',
    reviewsCount: 'reviews',
  },

  shop: {
    title: 'Skincare',
    wishlist: 'Wishlist',
    wishlistSub: 'Saved favorites — ready when you are',
    shopSub: 'Clinical-grade formulas — Egyptian craft, global standards',
    all: 'All',
    cleanser: 'Cleanser',
    cream: 'Cream',
    serum: 'Serum',
    lotion: 'Lotion',
    loading: 'Loading…',
    sortFeatured: 'Featured',
    sortPriceAsc: 'Price: low to high',
    sortPriceDesc: 'Price: high to low',
    sortRating: 'Top rated',
    products: 'products',
    trustShipping: 'Free shipping on 3+ products',
    trustAuthentic: '100% authentic products',
    trustTested: 'Dermatologically tested',
    trustGlobal: 'Made in Egypt · Global quality',
    emptyWishlist: 'Your wishlist is empty — start saving products you love',
    browseShop: 'Browse the shop',
    emptyCategory: 'No products in this category yet',
    viewAll: 'View all',
    loadError: 'Could not load products — please try again',
    retry: 'Retry',
  },

  search: {
    title: 'Search',
    placeholder: 'Search products, brands…',
    recent: 'Recent searches',
    clearAll: 'Clear all',
    trending: 'Trending searches',
    categories: 'Popular categories',
    results: 'Search results',
    noResults: 'No results found',
    recentTags: {
      acne: 'Acne cleanser',
      cream: 'Brightening cream',
      lotion: 'Body lotion',
      laser: 'Post-laser cream',
    },
    trendingItems: [
      'Brightening & tone-evening cleanser',
      'Brightening cream with Alpha Arbutin',
      'Acne facial cleanser',
      'Anti-scar silicone gel',
      'Hand & body lotion',
    ],
  },

  contact: {
    title: 'Contact us',
    call: 'Call us',
    whatsapp: 'WhatsApp',
    whatsappSub: 'Instant chat',
    email: 'Email',
    hoursTitle: 'Working hours',
    hoursDefault: 'Daily 9 AM – 11 PM',
    formTitle: 'Send us a message',
    name: 'Name',
    namePh: 'Your full name',
    emailLabel: 'Email',
    orderOptional: 'Order number (optional)',
    subject: 'Subject',
    message: 'Message',
    messagePh: 'Write your message here…',
    subjects: [
      'General inquiry',
      'Order issue',
      'Return or exchange',
      'Suggestion or complaint',
      'Business partnership',
    ],
    submit: 'Send message',
    success: 'Message sent — we will get back to you soon ✓',
    error: 'Could not send — please try again',
    location: 'Our location',
    follow: 'Follow us',
  },

  about: {
    title: 'About us',
    tagline: 'Your destination for premium skincare',
    storyTitle: 'Our story',
    story:
      'Montana was founded to bring Egypt the finest skincare formulas — authentic, clinically developed, and fairly priced. We believe everyone deserves luxury care backed by real results.',
    visionTitle: 'Our vision',
    vision:
      'To become the most trusted premium skincare destination in the region, with an exceptional shopping experience at every touchpoint.',
    stats: {
      clients: 'Happy clients',
      products: 'Authentic products',
      brands: 'Global brands',
      rating: 'Customer rating',
    },
    whyTitle: 'Why Montana?',
    features: [
      {
        title: '100% authentic',
        desc: 'Every formula is genuine — sourced and verified to the highest standards.',
      },
      {
        title: 'Fast delivery',
        desc: 'We deliver across Egypt within 24–48 hours.',
      },
      {
        title: 'Premium support',
        desc: 'Our team is available daily from 9 AM to 11 PM to help you.',
      },
      {
        title: 'Flexible returns',
        desc: 'Return or exchange any product within 14 days of delivery.',
      },
    ],
  },

  checkout: {
    title: 'Checkout',
    steps: { address: 'Address', payment: 'Payment', confirm: 'Confirm' },
    deliveryTitle: 'Delivery details',
    fullName: 'Full name',
    fullNamePh: 'Your name',
    phone: 'Phone number',
    emailOptional: 'Email (optional)',
    address: 'Full address',
    addressPh: 'Street, area, building number',
    city: 'City',
    cityPh: 'Cairo',
    deliveryMethod: 'Delivery method',
    loadingGovs: 'Loading governorates…',
    govLoadError: 'Could not load governorates',
    paymentTitle: 'Payment method',
    cod: 'Cash on delivery',
    codSub: 'Pay in cash on delivery — no deposit',
    wallet: 'Mobile wallet / InstaPay',
    walletSub: 'Transfer the full order amount',
    card: 'Credit card / Meeza',
    cardSub: 'Secure payment via Paymob',
    cardSoon: 'Credit card',
    soon: 'Coming soon',
    couponTitle: 'Discount code',
    couponPh: 'Enter discount code',
    apply: 'Apply',
    rewardsTitle: 'Montana Rewards',
    rewardsBalance: 'Your balance: {points} points — every 10 points = 1 EGP off',
    returningCustomer: 'Welcome back{name}! You have ordered {count} time(s) before',
    returningPointsOnly: 'We found a points balance on this number',
    phoneLookupHint: 'Enter your mobile so we can find your orders and points',
    pointsPh: '10, 20, 30…',
    summaryTitle: 'Order summary',
    subtotal: 'Subtotal',
    subtotalItems: 'Subtotal ({count} items)',
    shipping: 'Shipping',
    free: 'Free',
    discount: 'Discount',
    pointsDiscount: 'Points discount',
    total: 'Total',
    qty: 'Qty: {n}',
    removeItem: 'Remove',
    addProducts: 'Add products',
    confirm: 'Place order',
    confirming: 'Placing order…',
    uploading: 'Uploading receipt…',
    depositWallet:
      'Transfer the full order amount ({amount}) to the number below via InstaPay or mobile wallet, then upload a screenshot of the receipt:',
    depositCod: '',
    couponApplied: 'Discount applied ✓',
    couponVerifyError: 'Could not verify code — try again',
    pointsMultiples: 'Use multiples of 10 points',
    pointsInsufficient: 'Insufficient points balance',
    pointsApplied: '{amount} EGP discount applied ✓',
    pointsNone: 'Points cannot be applied to this amount',
    emptyCart: 'Your bag is empty',
    browseProducts: 'Browse products',
    fillRequired: 'Please complete name, phone, address, city, and governorate',
    uploadProof: 'Please upload a transfer receipt',
    productUnavailable: 'Product "{name}" is no longer available',
    stockInsufficient: 'Insufficient stock for "{name}" (available: {stock})',
    paymobError: 'Could not open payment gateway — contact us',
    stockError: 'Requested quantity is not in stock — review your bag',
    itemUnavailable: 'An item in your bag is no longer available',
    pointsError: 'Check the reward points applied',
    priceChanged: 'Prices changed — refresh the page and try again',
    submitError: 'Something went wrong — please try again',
  },

  confirmation: {
    pageTitle: 'Order confirmation',
    noOrderTitle: 'No current order',
    noOrderDesc: 'We could not find a recent order to show in this session.',
    home: 'Back to home',
    successTitle: 'Your order is confirmed!',
    successDesc: 'Thank you for your order. We will send you status updates.',
    bookingConfirmed: 'Order confirmed',
    awaitingBooking: 'Awaiting receipt review',
    awaitingDesc: 'We will review your transfer receipt and confirm your order shortly.',
    orderReceived: 'Order received',
    orderReceivedDesc: 'We will review your order and contact you shortly to confirm delivery.',
    refreshStatus: 'Refresh status',
    refreshing: 'Refreshing…',
    orderNumber: 'Order number',
    orderDate: 'Order date',
    paymentMethod: 'Payment method',
    deliveryMethod: 'Delivery method',
    deliveryExpress: 'Express delivery (24 hours)',
    deliveryStandard: 'Standard delivery (2–3 days)',
    total: 'Total',
    products: 'Products ({count})',
    qty: 'Qty: {n}',
    deliveryAddress: 'Delivery address',
    trackOrder: 'Track order',
    rewardsEarned: 'You earned <strong>{points} points</strong> from Montana Rewards!',
    paymentLabels: { cod: 'Cash on delivery', card: 'Credit card', wallet: 'Mobile wallet' },
  },

  ingredients: {
    pageTitle: 'Ingredient',
    loading: 'Loading…',
    foundIn: 'Found in products',
    noSlug: 'No ingredient selected',
    browse: 'Browse products',
    notFound: 'Ingredient not found',
  },

  common: {
    brand: 'Montaña',
    comingSoon: 'Coming soon',
    shopNow: 'Shop now',
    discoverProduct: 'Discover product',
    learnMore: 'Learn more',
  },
};

export const PRODUCT_COPY = {
  'acne-facial-cleanser': {
    name: 'Acne Facial Cleanser',
    shortName: 'Acne Cleanser',
    tagline: 'Gentle, deep cleansing for breakout-prone skin',
    description:
      "Egypt's first cream-to-foam cleanser designed to help prevent dryness and irritation while clearing pores. Ideal for combination to oily skin, blackheads, whiteheads, and mild acne. Visibly clearer skin in as little as 14 days.",
    skinType: 'Combination to oily skin',
    ingredients:
      'Salicylic Acid, Zinc PCA, Niacinamide (Vitamin B3), Argan Oil, Olive Oil, Jojoba Oil',
    concerns: 'Acne · Oily skin · Clogged pores',
    trust: ['★ 4.9', 'Dermatologist-trusted formula', 'Paraben-free', 'Best seller'],
    cartName: 'Acne Facial Cleanser — 200ml',
  },

  'whitening-cleanser': {
    name: 'Brightening & Tone-Evening Cleanser',
    shortName: 'Brightening Cleanser',
    tagline: 'Daily radiance with instant tone refinement',
    description:
      'A face, body, and intimate-area cleanser for dark spots, uneven tone, dullness, hyperpigmentation, and post-acne marks. Restores your natural luminosity with every wash.',
    skinType: 'All skin types',
    ingredients:
      'Licorice Extract, Niacinamide, Salicylic Acid, Zinc PCA, Vitamin C, Tea Tree Oil, Wheat Germ Oil, Almond Oil',
    concerns: 'Uneven tone · Dullness · Dark spots',
    trust: ['★ 4.8', 'Instant brightening', 'Sensitive-skin safe'],
    cartName: 'Brightening & Tone-Evening Cleanser — 200ml',
  },

  'whitening-cream': {
    name: 'Brightening Cream',
    shortName: 'Brightening Cream',
    tagline: 'Visible brightening with all-day hydration',
    description:
      'Targets melasma, post-acne marks, hyperpigmentation, underarm darkness, and sun-induced body discoloration. Delivers brightening and radiance for face and delicate areas. Finally — a cream that reveals your natural glow.',
    skinType: 'Face, neck, underarms, elbows & knees',
    ingredients:
      'Alpha Arbutin, Licorice Extract, Niacinamide, Lactic Acid, Zinc Oxide, Vitamin C, Vitamin E, Rose Oil',
    concerns: 'Hyperpigmentation · Post-acne marks · Sun spots',
    trust: ['★ 4.9', 'Melasma support', 'Alpha Arbutin'],
    cartName: 'Brightening Cream with Alpha Arbutin — 50ml',
  },

  'hand-body-lotion': {
    name: 'Hand & Body Lotion',
    shortName: 'Hand & Body Lotion',
    tagline: 'Silky softness from the very first application',
    description:
      'Up to 72 hours of hydration for all skin types. Perfect for rough, uneven texture and skin exposed to frequent washing. A non-greasy formula that softens, comforts, and supports a healthy skin barrier.',
    skinType: 'All skin types',
    ingredients:
      'Glycerin, Olive Oil, Almond Oil, Jojoba Oil, Coconut Oil, Cocoa Butter, Shea Butter, Beeswax, Vitamin E',
    concerns: 'Dry skin · Rough texture · Dehydration',
    trust: ['★ 4.7', '72-hour hydration', 'Non-greasy'],
    cartName: 'Hand & Body Lotion — 72hr Hydration — 50ml',
  },

  'post-laser-cream': {
    name: 'Post-Laser Recovery Cream',
    shortName: 'Post-Laser Cream',
    tagline: 'Soothe and restore skin after professional treatments',
    description:
      'For irritation and redness after laser sessions — when skin feels burning, stinging, or tight post-procedure. Supports faster recovery and barrier repair while helping reduce post-inflammatory hyperpigmentation. Redness can fade in days, not weeks.',
    skinType: 'Post-procedure & sensitized skin',
    ingredients:
      'Sesame Oil, Panthenol (Vitamin B5), Allantoin, Beeswax, Glycerin, Aloe Vera, Vitamin E, Niacinamide, Green Tea Extract, Lanolin',
    concerns: 'Post-laser · Irritation · Sensitive skin',
    trust: ['★ 4.8', 'Instant soothing', 'Post-treatment care'],
    cartName: 'Post-Laser Recovery Cream with Sesame Oil — 50ml',
  },

  'anti-scar-gel': {
    name: 'Anti-Scar Silicone Gel',
    shortName: 'Scar Gel',
    tagline: 'Improve the appearance of new and old scars',
    description:
      'Medical-grade silicone gel that helps improve the look of raised, thick, and keloid scars — recent or mature, from surgery, burns, or acne. Reduces redness and itching while refining scar texture with consistent use. For fully healed skin only.',
    skinType: 'Raised, thick & keloid scars',
    ingredients: 'Medical-grade Silicone',
    concerns: 'Surgical scars · Acne scars · Stretch marks',
    trust: ['★ 4.9', 'Medical-grade silicone', 'New & old scars'],
    cartName: 'Anti-Scar Silicone Gel — 50ml',
  },
};

/** Hero carousel slides — matches hero-showcase.js BASE_PRODUCTS shape */
export const HERO_SLIDES = [
  {
    img: 'images/p1.webp',
    en: 'ACNE FACIAL CLEANSER',
    name: PRODUCT_COPY['acne-facial-cleanser'].name,
    tag: PRODUCT_COPY['acne-facial-cleanser'].tagline,
    price: 329,
    mood: '#453f64',
    scale: 1.16,
    slug: 'acne-facial-cleanser',
  },
  {
    img: 'images/p2.webp',
    en: 'BRIGHTENING CLEANSER',
    name: PRODUCT_COPY['whitening-cleanser'].name,
    tag: PRODUCT_COPY['whitening-cleanser'].tagline,
    price: 299,
    mood: '#4f3f5c',
    scale: 1.16,
    slug: 'whitening-cleanser',
  },
  {
    img: 'images/p3.webp',
    en: 'BRIGHTENING CREAM',
    name: PRODUCT_COPY['whitening-cream'].name,
    tag: PRODUCT_COPY['whitening-cream'].tagline,
    price: 249,
    mood: '#543d67',
    slug: 'whitening-cream',
  },
  {
    img: 'images/p4.webp',
    en: 'HAND & BODY LOTION',
    name: PRODUCT_COPY['hand-body-lotion'].name,
    tag: PRODUCT_COPY['hand-body-lotion'].tagline,
    price: 229,
    mood: '#503f60',
    slug: 'hand-body-lotion',
  },
  {
    img: 'images/p5.webp',
    en: 'POST-LASER CREAM',
    name: PRODUCT_COPY['post-laser-cream'].name,
    tag: PRODUCT_COPY['post-laser-cream'].tagline,
    price: 369,
    mood: '#5a4358',
    slug: 'post-laser-cream',
  },
  {
    img: 'images/p6.webp',
    en: 'ANTI-SCAR SILICONE GEL',
    name: PRODUCT_COPY['anti-scar-gel'].name,
    tag: PRODUCT_COPY['anti-scar-gel'].tagline,
    price: 950,
    mood: '#493d58',
    slug: 'anti-scar-gel',
  },
];

/** Shop-by-concern cards — 9 items with slug labels for product chips */
export const CONCERNS = [
  {
    id: 'acne',
    icon: 'fa-droplet',
    title: 'Acne & breakouts',
    indication:
      'Helps cleanse oily, breakout-prone skin, remove excess sebum, and maintain a clearer-looking complexion.',
    products: ['acne-facial-cleanser', 'whitening-cream', 'anti-scar-gel'],
    labels: {
      'acne-facial-cleanser': 'Acne Cleanser',
      'whitening-cream': 'Brightening Cream',
      'anti-scar-gel': 'Scar Gel',
    },
  },
  {
    id: 'pih',
    icon: 'fa-circle-half-stroke',
    title: 'Post-acne marks',
    indication:
      'Helps improve the appearance of discoloration, post-acne marks, and uneven skin tone.',
    products: ['acne-facial-cleanser', 'whitening-cream', 'anti-scar-gel'],
    labels: {
      'acne-facial-cleanser': 'Acne Cleanser',
      'whitening-cream': 'Brightening Cream',
      'anti-scar-gel': 'Scar Gel',
    },
  },
  {
    id: 'uneven-tone',
    icon: 'fa-sun',
    title: 'Uneven tone',
    indication: 'Helps brighten dull skin and promote a more even, refined complexion.',
    products: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
    labels: {
      'whitening-cleanser': 'Brightening Cleanser',
      'whitening-cream': 'Brightening Cream',
      'hand-body-lotion': 'Hand & Body Lotion',
    },
  },
  {
    id: 'hyperpigmentation',
    icon: 'fa-moon',
    title: 'Dark spots & hyperpigmentation',
    indication: 'Helps reduce the appearance of dark spots and localized hyperpigmentation.',
    products: ['whitening-cleanser', 'whitening-cream', 'post-laser-cream'],
    labels: {
      'whitening-cleanser': 'Brightening Cleanser',
      'whitening-cream': 'Brightening Cream',
      'post-laser-cream': 'Post-Laser Cream',
    },
  },
  {
    id: 'melasma',
    icon: 'fa-cloud-sun',
    title: 'Melasma support',
    indication: 'Helps improve the appearance of melasma-affected skin and support tone uniformity.',
    products: ['whitening-cleanser', 'whitening-cream', 'post-laser-cream'],
    labels: {
      'whitening-cleanser': 'Brightening Cleanser',
      'whitening-cream': 'Brightening Cream',
      'post-laser-cream': 'Post-Laser Cream',
    },
  },
  {
    id: 'post-laser',
    icon: 'fa-wand-magic-sparkles',
    title: 'Post-laser care',
    indication:
      'Helps soothe, hydrate, and support skin recovery after cosmetic laser procedures.',
    products: ['post-laser-cream', 'hand-body-lotion', 'anti-scar-gel'],
    labels: {
      'post-laser-cream': 'Post-Laser Cream',
      'hand-body-lotion': 'Hand & Body Lotion',
      'anti-scar-gel': 'Scar Gel',
    },
  },
  {
    id: 'dry-skin',
    icon: 'fa-hand-sparkles',
    title: 'Dryness & hydration',
    indication: 'Helps restore moisture and improve skin softness and comfort.',
    products: ['whitening-cleanser', 'hand-body-lotion', 'post-laser-cream'],
    labels: {
      'whitening-cleanser': 'Brightening Cleanser',
      'hand-body-lotion': 'Hand & Body Lotion',
      'post-laser-cream': 'Post-Laser Cream',
    },
  },
  {
    id: 'scars',
    icon: 'fa-bandage',
    title: 'Scars',
    indication:
      'Helps improve the appearance of surgical scars, burn scars, and stretch marks.',
    products: ['anti-scar-gel', 'post-laser-cream', 'hand-body-lotion'],
    labels: {
      'anti-scar-gel': 'Scar Gel',
      'post-laser-cream': 'Post-Laser Cream',
      'hand-body-lotion': 'Hand & Body Lotion',
    },
  },
  {
    id: 'body-dark',
    icon: 'fa-person',
    title: 'Body dark areas',
    indication:
      'Helps reduce the appearance of darkened areas (underarms, knees, elbows) and improve overall tone uniformity.',
    products: ['whitening-cleanser', 'whitening-cream', 'hand-body-lotion'],
    labels: {
      'whitening-cleanser': 'Brightening Cleanser',
      'whitening-cream': 'Brightening Cream',
      'hand-body-lotion': 'Hand & Body Lotion',
    },
  },
];

export const HOME_SECTIONS = {
  bridge: {
    tagline: UI_STRINGS.bridge.tagline,
    trust: UI_STRINGS.bridge.trust,
  },

  brandStory: {
    eyebrow: 'The Montana story',
    title: "Egypt's first cream-to-foam cleanser — luxury care backed by science",
    paragraphs: [
      'From the start, Montana has crafted formulas that unite potent natural actives with clinically developed compositions — without compromise on quality or elegance.',
      'Every product undergoes rigorous testing to deliver tangible results: deep cleansing, even brightening, and barrier repair — in a simple daily ritual.',
    ],
    stats: [
      { num: '6', label: 'Specialist formulas' },
      { num: '14', label: 'Days to visible results' },
      { num: '100%', label: 'Authentic products' },
    ],
  },

  ritual: {
    eyebrow: 'The Montana ritual',
    title: 'Three steps — skin that glows',
    subtitle: 'A complete care system: cleanse, treat, and protect — designed to work in harmony',
    steps: [
      {
        num: '01 — Cleanse',
        title: 'Facial Cleanser',
        desc: 'Gentle, deep cleansing — the foundation of every successful routine',
        imgAlt: 'Facial cleanser',
        slug: 'acne-facial-cleanser',
      },
      {
        num: '02 — Treat',
        title: 'Brightening Cream',
        desc: 'Even tone and daily radiance for your complexion',
        imgAlt: 'Brightening cream',
        slug: 'whitening-cream',
      },
      {
        num: '03 — Protect',
        title: 'Post-Laser Cream',
        desc: 'Soothe and restore — protection after professional treatments',
        imgAlt: 'Post-laser cream',
        slug: 'post-laser-cream',
      },
    ],
  },

  ingredients: {
    eyebrow: 'Active ingredients',
    title: 'The science behind every formula',
    subtitle: 'Carefully selected natural actives — supported by proven compositions',
    discover: 'Discover product',
    cards: [
      {
        product: 'Acne Cleanser',
        slug: 'acne-facial-cleanser',
        items: ['Salicylic Acid', 'Niacinamide (B3)', 'Argan Oil, Jojoba Oil'],
        imgAlt: 'Acne Facial Cleanser',
      },
      {
        product: 'Brightening Cleanser',
        slug: 'whitening-cleanser',
        items: ['Licorice Extract', 'Vitamin C', 'Zinc PCA & Niacinamide'],
        imgAlt: 'Brightening Cleanser',
      },
      {
        product: 'Brightening Cream',
        slug: 'whitening-cream',
        items: ['Alpha Arbutin', 'Vitamins C & E', 'Licorice Extract'],
        imgAlt: 'Brightening Cream',
      },
    ],
  },

  reviews: {
    eyebrow: 'Client voices',
    title: 'What our clients say',
    score: '4.8',
    scoreMax: '/5',
    count: 'From 1,200+ verified reviews',
    items: [
      {
        stars: '★★★★★',
        text: '"The Acne Cleanser transformed my skin in two weeks — clearer, fewer breakouts. Gentle scent and never drying."',
        initial: 'S',
        name: 'Sarah M.',
        product: 'Acne Facial Cleanser',
      },
      {
        stars: '★★★★★',
        text: '"The Brightening Cleanser genuinely evens my tone — three weeks in and spots are fading. The packaging feels so luxe."',
        initial: 'N',
        name: 'Norhan A.',
        product: 'Brightening Cleanser',
      },
      {
        stars: '★★★★☆',
        text: '"Post-Laser Cream saved my skin after treatment — redness gone in two days. Montana is a brand I trust now."',
        initial: 'M',
        name: 'Mariam K.',
        product: 'Post-Laser Recovery Cream',
      },
    ],
  },

  newsletter: {
    title: 'Join our newsletter',
    subtitle: 'Receive the latest offers and exclusive savings straight to your inbox',
    placeholder: 'Enter your email address',
    cta: 'Subscribe',
    success: 'Thank you — you are subscribed.',
    error: 'Please enter a valid email address.',
  },
};
