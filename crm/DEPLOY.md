# Montana CRM — خطوات تفعيل الترقية

> ✅ **كل الخطوات أدناه اتنفذت بالفعل يوم 2026-07-02** — الملف محفوظ كمرجع
> لإعادة النشر مستقبلاً. الـ CLI الآن مسجّل بالحساب الصحيح، وأي تعديل جديد
> على Edge Function ينشر بـ:
> `supabase functions deploy <name> --project-ref ikryeyqrithikabwidov`

---

## 1) تشغيل الـ SQL (الأمان + الميزات) — الأهم

افتح **Supabase Dashboard → SQL Editor** والصق محتوى:

```
supabase/migrations/003_crm_hardening.sql
```

وشغّله. آمن لإعادة التشغيل (idempotent). هذا يفعّل:

- ✅ التحقق من GPS في السيرفر (المتصفح ما يقدر يزوّر `gps_verified`)
- ✅ منع المندوب من اعتماد زياراته بنفسه أو انتحال هوية مندوب آخر
- ✅ عدّاد الزيارات المكتملة atomic (بدون race condition)
- ✅ منع تكرار الزيارات من الـ offline queue (`client_id` فريد)
- ✅ RLS كامل على كل جداول الـ CRM
- ✅ دالة `crm_generate_plan()` للتوليد التلقائي للخطة
- ✅ جدول اشتراكات الإشعارات + عمود صورة الزيارة

**بعد تشغيله، إنشاء المندوبين من لوحة الأدمن يتطلب الخطوة 2** (مسار
الـ signUp القديم يصير مرفوضاً بالـ RLS عمداً).

## 2) نشر الـ Edge Functions

```bash
cd D:\montana2
supabase link --project-ref ikryeyqrithikabwidov
supabase functions deploy admin-users
supabase functions deploy send-daily-reminders
```

`admin-users` يتولى إنشاء/حذف حسابات المندوبين بمفتاح service-role
(بريد مؤكَّد فوراً، وحذف يشمل حساب الدخول نفسه). الواجهة تستدعيه تلقائياً.

## 3) الإشعارات اليومية (Web Push)

### أ) مفاتيح VAPID (مولّدة لك — خاصة بهذا المشروع)

```bash
supabase secrets set VAPID_PUBLIC_KEY=BFWNpQFEVPl1VilxlikRQhrCFLeN51aUpYA6Tzl3YWVikUUTk_LRt5w_THK_bzpBZ4kKCGGcJezdydXqi8MjOYA
supabase secrets set VAPID_PRIVATE_KEY=9_z50ZPu8Qv07tuO90CrcipM-cH5kpmKVy2Y0uMjMsM
supabase secrets set VAPID_SUBJECT=mailto:mo_abed5@icloud.com
```

> 🔒 المفتاح الخاص سرّي — لا ترفع هذا الملف على مستودع عام. المفتاح العام
> نفسه مضمّن في `crm/js/crm-api.js` (`VAPID_PUBLIC_KEY`) — لو ولّدت مفاتيح
> جديدة حدّثه هناك أيضاً.

### ب) جدولة الإرسال الصباحي (6:00 صباحاً بتوقيت القاهرة = 4:00 UTC)

في **SQL Editor** (يتطلب تفعيل امتدادَي `pg_cron` و `pg_net` من
Dashboard → Database → Extensions):

```sql
select cron.schedule(
  'crm-daily-reminders',
  '0 4 * * *',
  $$
  select net.http_post(
    url     := 'https://ikryeyqrithikabwidov.supabase.co/functions/v1/send-daily-reminders',
    headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
  )
  $$
);
```

استبدل `<ANON_KEY>` بالمفتاح الموجود في `crm/js/crm-api.js`.

### ج) من جهة المندوب

في تطبيق المندوب → Profile → زر **"🔔 Enable daily reminders"**.
(يتطلب HTTPS — يعني يشتغل على نطاق Vercel، مش على localhost عادي.)

للاختبار اليدوي فوراً:

```bash
curl -X POST https://ikryeyqrithikabwidov.supabase.co/functions/v1/send-daily-reminders \
     -H "Authorization: Bearer <ANON_KEY>"
```

---

## ملخص الميزات الجديدة في الواجهة (شغّالة بعد الخطوات أعلاه)

| الميزة | مكانها |
|---|---|
| صورة إثبات الزيارة (اختيارية، مضغوطة، تشتغل offline) | تطبيق المندوب → Check-in |
| توليد الخطة تلقائياً من تصنيف الدكاترة (AB1×4 … BB2×1) | تطبيق المندوب → Plan → ⚡ Auto-fill |
| خريطة الدكاترة + الزيارات المشبوهة (Leaflet) | لوحة الأدمن → Territory Map |
| تصدير CSV (زيارات + عينات، يفتح في Excel بالعربي) | لوحة الأدمن → Export |
| اعتماد الزيارات المعلّمة يشتغل فعلياً | لوحة الأدمن → GPS Audit |
| عمود صورة الزيارة في تقارير الزيارات | لوحة الأدمن → Visit Reports |
