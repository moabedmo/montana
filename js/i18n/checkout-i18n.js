/** Checkout UI strings — Arabic default, English from en.js */
import { getLocale } from './locale.js';
import { UI_STRINGS as EN } from './en.js';

const AR = {
  title: 'إتمام الطلب',
  steps: { address: 'العنوان', payment: 'الدفع', confirm: 'التأكيد' },
  deliveryTitle: 'بيانات التوصيل',
  fullName: 'الاسم بالكامل',
  fullNamePh: 'اسمك',
  phone: 'رقم الهاتف',
  emailOptional: 'البريد الإلكتروني (اختياري)',
  address: 'العنوان بالتفصيل',
  addressPh: 'الشارع، الحي، رقم العقار',
  city: 'المدينة',
  cityPh: 'القاهرة',
  deliveryMethod: 'طريقة التوصيل',
  loadingGovs: 'جارٍ تحميل المحافظات…',
  govLoadError: 'تعذّر تحميل المحافظات',
  paymentTitle: 'طريقة الدفع',
  cod: 'الدفع عند الاستلام',
  codSub: '200 ج.م مقدم + الباقي كاش عند الاستلام',
  wallet: 'محفظة إلكترونية / إنستاباي',
  walletSub: 'تحويل قيمة الأوردر كاملة',
  card: 'بطاقة ائتمان / Meeza',
  cardSub: 'دفع آمن عبر Paymob',
  cardSoon: 'بطاقة ائتمان',
  soon: 'قريباً',
  couponTitle: 'كود خصم',
  couponPh: 'أدخل كود الخصم',
  apply: 'تطبيق',
  rewardsTitle: 'Montana Rewards',
  rewardsBalance: 'رصيدك: {points} نقطة — كل 10 نقاط = 1 ج.م خصم',
  pointsPh: '10, 20, 30…',
  summaryTitle: 'ملخص الطلب',
  subtotal: 'المجموع الفرعي',
  subtotalItems: 'المجموع الفرعي ({count} منتج)',
  shipping: 'الشحن',
  free: 'مجاني',
  discount: 'الخصم',
  pointsDiscount: 'خصم النقاط',
  total: 'الإجمالي',
  qty: 'الكمية: {n}',
  confirm: 'تأكيد الطلب',
  confirming: 'جارٍ تأكيد الطلب…',
  uploading: 'جارٍ رفع الإيصال…',
  depositWallet:
    'حوّل قيمة الأوردر كاملة ({amount}) على الرقم التالي عبر إنستاباي أو المحفظة، وارفع صورة إيصال التحويل:',
  depositCod:
    'حوّل {amount} ج.م مقدّم كتأكيد للحجز عبر إنستاباي أو المحفظة، وارفع صورة إيصال التحويل (الباقي كاش عند الاستلام):',
  couponApplied: 'تم تطبيق الخصم ✓',
  couponVerifyError: 'تعذّر التحقق من الكود، حاول مرة أخرى',
  pointsMultiples: 'استخدم مضاعفات 10 نقاط',
  pointsInsufficient: 'رصيد النقاط غير كافٍ',
  pointsApplied: 'خصم {amount} ج.م ✓',
  pointsNone: 'لا يمكن تطبيق نقاط على هذا المبلغ',
  emptyCart: 'السلة فارغة حاليًا',
  browseProducts: 'تصفّح المنتجات',
  fillRequired: 'من فضلك أكمل الاسم والهاتف والعنوان والمدينة والمحافظة',
  uploadProof: 'من فضلك ارفع صورة إيصال التحويل لتأكيد الحجز',
  productUnavailable: 'المنتج "{name}" لم يعد متاحاً',
  stockInsufficient: 'الكمية المتوفرة من "{name}" غير كافية (المتوفر: {stock})',
  paymobError: 'تعذّر فتح بوابة الدفع — تواصل معنا',
  stockError: 'الكمية المطلوبة غير متوفرة في المخزون — راجع السلة',
  itemUnavailable: 'أحد المنتجات في سلتك لم يعد متاحاً',
  pointsError: 'تحقق من نقاط المكافآت المستخدمة',
  priceChanged: 'تغيّر السعر — حدّث الصفحة وحاول مجدداً',
  submitError: 'حصلت مشكلة أثناء تأكيد الطلب، حاول مرة أخرى',
};

export function getCheckoutStrings() {
  return getLocale() === 'en' ? EN.checkout : AR;
}

/** @param {number} n */
export function formatMoney(n) {
  const num = Math.round(Number(n) || 0);
  return getLocale() === 'en'
    ? `${num.toLocaleString('en-EG')} EGP`
    : `${num.toLocaleString('ar-EG')} ج.م`;
}

/** @param {string} template @param {Record<string, string|number>} vars */
export function fmt(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
