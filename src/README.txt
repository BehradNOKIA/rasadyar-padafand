Rasadyar — NewsPanel duplicate analysisBtn fix

خطای مورد اصلاح:
The symbol "analysisBtn" has already been declared

علت:
NewsPanel.ts از قبل یک متغیر با نام analysisBtn داشته و Patch قبلی
در همان scope یک analysisBtn دوم ایجاد کرده است.

اصلاح:
فقط متغیر بلوک جدید «افزودن خبر به تحلیل» از:
analysisBtn
به:
newsAnalysisBtn
تغییر نام می‌کند.

روش اجرا:
1) فایل fix-news-panel-duplicate-analysisbtn.mjs را در ریشه پروژه قرار بده.
2) اجرا:
node .\fix-news-panel-duplicate-analysisbtn.mjs
3) سپس:
npm.cmd run build
npm.cmd run dev
4) Chrome:
Ctrl+Shift+R

Backup:
src/components/NewsPanel.ts.bak-before-duplicate-analysisbtn-fix
