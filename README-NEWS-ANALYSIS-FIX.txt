Rasadyar — NewsPanel Analysis Button Fix

هدف:
اضافه‌کردن گزینه «+ تحلیل» به خبرهای متنی NewsPanel.

چرا Patch Script؟
فایل NewsPanel.ts فعلی پروژه در این گفتگو آپلود نشده است.
این اسکریپت به‌جای حدس‌زدن نسخه فایل، روی همان فایل واقعی پروژه شما
به‌صورت in-place Patch اعمال می‌شود و قبل از تغییر Backup می‌سازد.

فایل هدف:
src/components/NewsPanel.ts

پیش‌نیاز:
P4-Step1 نصب شده باشد و فایل زیر وجود داشته باشد:
src/features/analysis/sourceIntake.ts

روش اجرا:
1) فایل apply-news-panel-analysis-fix.mjs را در ریشه پروژه کپی کنید.
2) در PowerShell از ریشه پروژه اجرا کنید:

node .\apply-news-panel-analysis-fix.mjs

3) سپس:
npm.cmd run build
npm.cmd run dev

4) مرورگر:
Ctrl+Shift+R

خروجی مورد انتظار:
- روی خبرهای متنی دکمه «+ تحلیل» دیده شود.
- superadmin و analyst دکمه را ببینند.
- viewer دکمه را نبیند.
- کلیک روی دکمه خبر را به مرکز تحلیل بفرستد.
- خبر بتواند به پرونده جدید یا موجود وارد شود.
- &nbsp; و HTML Entityهای رایج قبل از ورود به مرکز تحلیل پاک شوند.
- خبر از Unified Source Intake عبور کند.

Backup:
اسکریپت قبل از اولین تغییر فایل زیر را می‌سازد:
src/components/NewsPanel.ts.bak-before-news-analysis

برای بازگردانی:
copy ".\src\components\NewsPanel.ts.bak-before-news-analysis" ".\src\components\NewsPanel.ts"
