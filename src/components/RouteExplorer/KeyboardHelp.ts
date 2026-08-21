import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
/**
 * `?` cheat-sheet overlay for the Route Explorer keyboard bindings.
 */

export interface KeyboardHelpOptions {
  onClose: () => void;
}

const BINDINGS: ReadonlyArray<readonly [string, string]> = [
  ['Esc', 'بستن انتخاب‌گر و سپس پنل'],
  ['Tab / Shift+Tab', 'حرکت بین پنل و نقشه'],
  ['F', 'رفتن به انتخاب‌گر مبدأ'],
  ['T', 'رفتن به انتخاب‌گر مقصد'],
  ['P', 'رفتن به انتخاب‌گر محصول'],
  ['S', 'جابه‌جایی مبدأ ↔ مقصد'],
  ['1 – 4', 'تعویض زبانه‌ها (فعلی / جایگزین / زمینی / اثرگذاری)'],
  ['↑ / ↓', 'حرکت در فهرست رتبه‌بندی‌شده'],
  ['Enter', 'تأیید انتخاب'],
  ['Cmd+,', 'کپی پیوند قابل اشتراک'],
  ['?', 'نمایش این راهنما'],
];

export class KeyboardHelp {
  public readonly element: HTMLDivElement;

  constructor(opts: KeyboardHelpOptions) {
    this.element = document.createElement('div');
    this.element.className = 're-help';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-label', 'میانبرهای صفحه‌کلید کاوشگر مسیر');

    const header = document.createElement('div');
    header.className = 're-help__header';
    setTrustedHtml(header, trustedHtml('<span class="re-help__title">میانبرهای صفحه‌کلید</span>' +
      '<button class="re-help__close" aria-label="بستن راهنما">×</button>', "legacy direct innerHTML migration"));

    const list = document.createElement('table');
    list.className = 're-help__table';
    for (const [key, label] of BINDINGS) {
      const row = document.createElement('tr');
      setTrustedHtml(row, trustedHtml(`<td class="re-help__key"><kbd>${escapeHtml(key)}</kbd></td><td class="re-help__label">${escapeHtml(label)}</td>`, "legacy direct innerHTML migration"));
      list.append(row);
    }

    this.element.append(header, list);

    header.querySelector('.re-help__close')?.addEventListener('click', () => opts.onClose());
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}
