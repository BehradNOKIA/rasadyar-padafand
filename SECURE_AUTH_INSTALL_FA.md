# ارتقای امنیت واقعی رمز عبور رصدیار

این بسته، احراز هویت محلی مبتنی بر `localStorage` و رمز عبور Plain Text را به احراز هویت سمت سرور تبدیل می‌کند.

## فایل‌هایی که باید جایگزین شوند

- `vite.config.ts`
- `src/auth/userStore.ts`
- `src/auth/login-gate.ts`
- `src/auth/AuthProvider.tsx`
- `src/auth/UserManagement.tsx`
- `src/auth/users.json`
- `src/auth/admin-user-panel.ts`
- `src/components/AuthHeaderWidget.ts`

## فایل‌های جدید

- `server/rasadyar-auth/store.ts`
- `server/rasadyar-auth/vite-plugin.ts`
- `.rasadyar/.gitignore`

## بعد از جایگزینی

1. سرور توسعه را کاملاً متوقف کنید.
2. دوباره اجرا کنید:

```bash
npm run dev
```

3. از همان رایانه و از آدرس `http://localhost:3001` وارد شوید.
4. در اولین اجرا، فهرست قدیمی `rasadyar_users` فقط یک بار به Backend فرستاده می‌شود.
5. Backend رمزها را با `scrypt` و Salt تصادفی Hash می‌کند و سپس نسخه Plain Text مرورگر حذف می‌شود.
6. دوباره با همان نام کاربری و رمز قبلی وارد شوید.

## محل جدید کاربران

در حالت پیش‌فرض:

```text
<project-root>/.rasadyar/auth-store.json
```

این فایل شامل `passwordHash` و `passwordSalt` است و رمز اصلی در آن ذخیره نمی‌شود.
فایل توسط `.rasadyar/.gitignore` از Git خارج نگه داشته می‌شود.

## کنترل نهایی

در DevTools مرورگر:

- `localStorage["rasadyar_users"]` نباید باقی مانده باشد.
- `localStorage["rasadyar_user"]` فقط پروفایل عمومی کاربر را دارد و نباید `password` داشته باشد.
- Session در Cookie با نام `rasadyar_session` و ویژگی `HttpOnly` نگهداری می‌شود.
- `document.cookie` نباید بتواند Session را بخواند.

در فایل `.rasadyar/auth-store.json`:

- `passwordHash` وجود دارد.
- `passwordSalt` وجود دارد.
- رمز واقعی کاربر وجود ندارد.

## نکته استقرار روی سرور

این پیاده‌سازی برای یک سرور Node/Vite تک‌نمونه‌ای، ذخیره پایدار فایل را فراهم می‌کند. هنگام انتقال پروژه به سرور، فایل `.rasadyar/auth-store.json` نیز باید به‌صورت محرمانه و خارج از Git به سرور منتقل و Backup شود.

برای استقرار چندسروری، Serverless یا چند Instance، همین API باید در مرحله بعد به PostgreSQL/SQLite/یک دیتابیس مشترک منتقل شود؛ فایل محلی برای آن معماری مناسب نیست.

## کنترل‌های امنیتی فعال

- Hash سمت سرور با `scrypt`
- Salt تصادفی مستقل برای هر کاربر
- مقایسه Hash با `timingSafeEqual`
- Session تصادفی با ذخیره فقط SHA-256 Token در سرور
- Cookie با `HttpOnly` و `SameSite=Strict`
- `Secure` به‌صورت خودکار روی HTTPS
- انقضای Session پس از ۱۲ ساعت
- ابطال Session پس از تغییر نقش، غیرفعال‌سازی یا Reset Password
- Rate Limit ورود: حداکثر ۵ خطای ورود در بازه ۱۵ دقیقه
- کنترل Origin / Same-Origin روی درخواست‌های تغییردهنده
- مدیریت کاربران با Authorization سمت سرور
- جلوگیری از تغییر/حذف حساب `superadmin`
- عدم ذخیره رمز، Hash یا Token در LocalStorage
