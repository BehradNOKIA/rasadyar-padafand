export type AppRole = 'superadmin' | 'analyst' | 'viewer';

export const ROLE_LABELS: Record<AppRole, string> = {
  superadmin: 'مدیر اصلی',
  analyst: 'تحلیلگر',
  viewer: 'مشاهده‌گر',
};

/**
 * منوی کنار نام کاربر فقط برای عملیات حساب/مدیریت نگه داشته می‌شود.
 *
 * ناوبری اصلی سامانه (نمای کلی، تحلیل، گزارش‌ها، تنظیمات و ...)
 * اکنون از سایدبار راست انجام می‌شود؛ بنابراین موارد تکراری از این منو حذف شده‌اند.
 *
 * «ویرایش پروفایل» و «خروج» در رندر منوی کاربر به‌صورت مستقل اضافه می‌شوند
 * و نیازی نیست در ROLE_MENU تکرار شوند.
 */
export const ROLE_MENU: Record<
  AppRole,
  Array<{ title: string; event?: string }>
> = {
  superadmin: [
    {
      title: 'مدیریت کاربران',
      event: 'rasadyar:open-user-management',
    },
  ],

  analyst: [],

  viewer: [],
};
