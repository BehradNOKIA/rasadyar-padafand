Rasadyar — Corrected NewsPanel.ts

این فایل کامل بر اساس NewsPanel.ts ارسالی کاربر بازنویسی شده است.

اصلاحات:
- حذف import بلااستفاده openAnalysisWithEvidence
- اتصال خبر متنی به P4 Unified Source Intake
- افزودن دکمه «افزودن به تحلیل» به خبرهای Flat
- افزودن همان دکمه به خبرهای Clustered
- Event delegation واقعی برای .item-analysis-btn
- استفاده از نام newsAnalysisBtn برای جلوگیری از خطای duplicate declaration
- پاک‌سازی HTML Entity و &nbsp; قبل از ورود خبر به مرکز تحلیل
- اصلاح دکمه ترجمه Flat که قبلاً دارای `...` نامعتبر در HTML بود
- حفظ RBAC: superadmin/analyst مجاز، viewer بدون دکمه
- ارسال title/source/url/time/summary و metadata منبع به Source Intake

مسیر جایگزینی:
src/components/NewsPanel.ts

پس از جایگزینی:
npm.cmd run build
npm.cmd run dev

سپس Chrome:
Ctrl + Shift + R

نکته:
پیش‌نیاز این نسخه وجود فایل زیر از P4-Step1 است:
src/features/analysis/sourceIntake.ts
