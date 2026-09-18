import type { PanelTab, TabsState } from '@/services/tab-store';
import { t } from '@/services/i18n';
import { PanelGateReason } from '@/services/panel-gating';
import { lockSvg, upgradeSvg } from '@/components/gate-icons';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { billingAwareGateCopy, type GateCopy } from '@/components/ExportGateControl';
import { getCurrentUser } from '@/auth/userStore';

export interface PanelTabBarCallbacks {
  onSelect(tabId: string): void;
  onAdd(): void;
  onRename(tabId: string, name: string): void;
  onDelete(tabId: string): void;
}

export type RasadyarNavKey =
  | 'overview'
  | 'global-monitoring'
  | 'smart-analysis'
  | 'alerts'
  | 'infrastructure'
  | 'reports'
  | 'settings'
  | 'latest-version';

interface RasadyarNavItem {
  key: RasadyarNavKey;
  label: string;
}

const RASADYAR_NAV_ITEMS: readonly RasadyarNavItem[] = [
  { key: 'overview', label: 'نمای کلی' },
  { key: 'global-monitoring', label: 'پایش جهانی' },
  { key: 'smart-analysis', label: 'تحلیل هوشمند' },
  { key: 'alerts', label: 'هشدارها' },
  { key: 'infrastructure', label: 'زیرساخت‌ها' },
  { key: 'reports', label: 'گزارش‌ها' },
  { key: 'settings', label: 'تنظیمات' },
  { key: 'latest-version', label: 'آخرین ورژن' },
] as const;

export interface RasadyarNavigateDetail {
  section: RasadyarNavKey;
}

/** Locked state of the "+" control while the dashboard tab cap applies (KTD8). */
export interface TabAddLock {
  /** Copy for the anchored notice — same shape as the export gate's. */
  copy: GateCopy;
  /** Resolved gate action (auth modal, pricing page, billing portal). */
  onAction: () => void;
}

/**
 * Tab-cap copy, shaped exactly like `exportGateCopy` so the two locked
 * surfaces read the same. The billing-aware reasons reuse the shared
 * `components.billingState.*` strings — a customer with paid evidence must
 * never see a fresh upsell. The upgrade CTA stays tier-agnostic ("upgrade for
 * more") because it fires at every rung of the ladder: 3 → Pro, 10 → Pro
 * Business, 25 → Enterprise.
 */
export function tabCapGateCopy(reason: PanelGateReason, cap: number): GateCopy {
  const billing = billingAwareGateCopy(reason);
  if (billing) return billing;
  if (reason === PanelGateReason.ANONYMOUS) {
    return {
      icon: lockSvg,
      desc: t('components.tabCap.signedOutDesc', { cap: String(cap) }),
      cta: t('premium.signIn'),
    };
  }
  return {
    icon: upgradeSvg,
    desc: t('components.tabCap.upgradeDesc', { cap: String(cap) }),
    cta: t('components.tabCap.upgradeCta'),
  };
}

export class PanelTabBar {
  private element: HTMLElement;
  private tablistEl: HTMLElement;
  private getState: () => TabsState;
  private callbacks: PanelTabBarCallbacks;
  private addBtn: HTMLButtonElement | null = null;
  private addLock: TabAddLock | null = null;
  private notice: HTMLElement | null = null;
  private activeRasadyarNav: RasadyarNavKey = 'overview';
  private readonly liveRegion: HTMLElement;
  private readonly onNoticeOutsideClick: (event: MouseEvent) => void;
  private readonly onNoticeKeyDown: (event: KeyboardEvent) => void;

  constructor(getState: () => TabsState, callbacks: PanelTabBarCallbacks) {
    this.getState = getState;
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'dashboard-tabs-bar';

    this.liveRegion = document.createElement('span');
    this.liveRegion.className = 'wm-visually-hidden';
    this.liveRegion.setAttribute('role', 'status');
    this.liveRegion.setAttribute('aria-live', 'polite');

    this.onNoticeOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (this.notice?.contains(target) || target === this.addBtn) return;
      this.closeAddLockNotice();
    };

    this.onNoticeKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeAddLockNotice(true);
    };

    this.tablistEl = document.createElement('div');
    this.tablistEl.className = 'dashboard-tablist';
    this.tablistEl.setAttribute('role', 'tablist');
    this.tablistEl.setAttribute('aria-label', t('dashboardTabs.ariaLabel'));
    this.tablistEl.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.tablistEl.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.dashboard-tab-close')) return;

      const tabEl = (
        target.closest('.dashboard-tab') ??
        document.elementFromPoint(e.clientX, e.clientY)?.closest('.dashboard-tab')
      ) as HTMLElement | null;

      if (!tabEl) return;

      const tabId = tabEl.dataset.tabId;
      if (!tabId) return;

      const tab = this.getState().tabs.find((tb) => tb.id === tabId);
      if (tab) this.startRename(tabEl, tab);
    });

    this.render();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  refresh(): void {
    this.render();
  }

  destroy(): void {
    this.closeAddLockNotice();
    this.element.remove();
  }

  setAddLock(lock: TabAddLock | null): void {
    const wasLocked = this.addLock !== null;

    if (
      wasLocked === (lock !== null) &&
      lock?.copy.desc === this.addLock?.copy.desc &&
      lock?.copy.cta === this.addLock?.copy.cta
    ) {
      this.addLock = lock;
      return;
    }

    this.addLock = lock;
    this.applyAddLock();

    if (wasLocked && lock === null) {
      this.closeAddLockNotice();
      this.liveRegion.textContent = t('components.tabCap.unlockedAnnouncement');
    } else if (this.notice) {
      this.closeAddLockNotice();
    }
  }

  showAddLockNotice(): void {
    const lock = this.addLock;
    if (!lock || !this.addBtn) return;

    this.closeAddLockNotice();

    const icon = document.createElement('div');
    icon.className = 'tab-cap-notice-icon';
    setTrustedHtml(icon, trustedHtml(lock.copy.icon, 'static inline icon markup'));

    const desc = document.createElement('p');
    desc.className = 'tab-cap-notice-desc';
    desc.id = 'tab-cap-notice-desc';
    desc.textContent = lock.copy.desc;

    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'tab-cap-notice-cta';
    cta.textContent = lock.copy.cta;
    cta.setAttribute('aria-describedby', desc.id);

    cta.addEventListener('click', () => {
      this.closeAddLockNotice();
      lock.onAction();
    });

    const notice = document.createElement('div');
    notice.className = 'tab-cap-notice';
    notice.append(icon, desc, cta);

    document.body.appendChild(notice);

    const rect = this.addBtn.getBoundingClientRect();
    notice.style.top = `${rect.bottom + 6}px`;
    notice.style.left = `${Math.max(
      8,
      Math.min(rect.left, window.innerWidth - notice.offsetWidth - 8),
    )}px`;

    this.notice = notice;
    document.addEventListener('mousedown', this.onNoticeOutsideClick);
    document.addEventListener('keydown', this.onNoticeKeyDown);
    cta.focus();
  }

  private closeAddLockNotice(restoreFocus = false): void {
    if (!this.notice) return;

    document.removeEventListener('mousedown', this.onNoticeOutsideClick);
    document.removeEventListener('keydown', this.onNoticeKeyDown);

    this.notice.remove();
    this.notice = null;

    if (restoreFocus) this.addBtn?.focus();
  }

  private applyAddLock(): void {
    if (!this.addBtn) return;

    this.addBtn.setAttribute(
      'aria-label',
      this.addLock
        ? t('components.tabCap.lockedAriaLabel', { reason: this.addLock.copy.desc })
        : t('dashboardTabs.addTab'),
    );
  }

  private isSuperAdmin(): boolean {
    try {
      return getCurrentUser()?.role === 'superadmin';
    } catch {
      return false;
    }
  }

  private async requestLatestVersion(): Promise<void> {
    if (!this.isSuperAdmin()) {
      window.alert('فقط مدیر اصلی اجازه بروزرسانی سامانه را دارد.');
      return;
    }

    const confirmed = window.confirm(
      'آخرین نسخه شاخه main از مخزن رسمی رصدیار دریافت و روی سرور نصب شود؟\n\n' +
        'در زمان بروزرسانی ممکن است سامانه برای مدت کوتاهی در دسترس نباشد.',
    );

    if (!confirmed) return;

    const button = this.tablistEl.querySelector<HTMLButtonElement>(
      '[data-rasadyar-section="latest-version"].rasadyar-nav-button',
    );

    const oldText = button?.textContent ?? 'آخرین ورژن';

    if (button) {
      button.disabled = true;
      button.textContent = 'در حال بروزرسانی...';
    }

    try {
      const response = await fetch('/api/rasadyar-auth/system/update', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository: 'https://github.com/BehradNOKIA/rasadyar-padafand.git',
          branch: 'main',
        }),
      });

      let result: {
        ok?: boolean;
        message?: string;
        code?: string;
        latestVersion?: string;
      } = {};

      try {
        result = (await response.json()) as typeof result;
      } catch {
        result = {};
      }

      if (!response.ok || result.ok === false) {
        if (response.status === 401) {
          throw new Error('نشست مدیریتی معتبر نیست. دوباره وارد سامانه شوید.');
        }

        if (response.status === 403) {
          throw new Error('فقط مدیر اصلی اجازه بروزرسانی سامانه را دارد.');
        }

        if (response.status === 404) {
          throw new Error('سرویس بروزرسانی سمت سرور هنوز فعال نشده است.');
        }

        throw new Error(result.message || result.code || 'شروع بروزرسانی ناموفق بود.');
      }

      window.alert(
        result.message ||
          (result.latestVersion
            ? `بروزرسانی نسخه ${result.latestVersion} با موفقیت آغاز شد.`
            : 'فرآیند دریافت و نصب آخرین نسخه با موفقیت آغاز شد.'),
      );
    } catch (error) {
      console.error('Unable to start Rasadyar update:', error);

      window.alert(
        error instanceof Error
          ? error.message
          : 'خطا در شروع بروزرسانی سامانه.',
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }

  private render(): void {
    this.tablistEl.replaceChildren();

    const { tabs, activeTabId } = this.getState();
    const primaryTab = tabs[0];

    for (const item of RASADYAR_NAV_ITEMS) {
      if (item.key === 'latest-version' && !this.isSuperAdmin()) {
        continue;
      }

      this.tablistEl.appendChild(
        this.renderRasadyarNavItem(item, primaryTab?.id),
      );
    }

    for (const [index, tab] of tabs.entries()) {
      this.tablistEl.appendChild(
        this.renderTab(
          tab,
          tab.id === activeTabId,
          tabs.length > 1,
          index === 0,
        ),
      );
    }

    this.updateControlledPanel(activeTabId);

    const addBtn = document.createElement('button');
    addBtn.className = 'dashboard-tab-add';
    addBtn.title = t('dashboardTabs.addTabTitle');
    addBtn.textContent = '+';

    addBtn.addEventListener('click', () => this.callbacks.onAdd());

    this.addBtn = addBtn;
    this.applyAddLock();

    this.element.replaceChildren(this.tablistEl, addBtn, this.liveRegion);
  }

  private renderRasadyarNavItem(
    item: RasadyarNavItem,
    primaryTabId?: string,
  ): HTMLElement {
    const wrapper = document.createElement('div');

    wrapper.className = `dashboard-tab rasadyar-nav-item${
      this.activeRasadyarNav === item.key ? ' active' : ''
    }`;

    wrapper.setAttribute('role', 'presentation');
    wrapper.dataset.rasadyarSection = item.key;

    if (item.key === 'latest-version') {
      wrapper.classList.add('rasadyar-latest-version-item');
    }

    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'dashboard-tab-label rasadyar-nav-button';
    button.id = `rasadyar-nav-${item.key}`;
    button.textContent = item.label;
    button.dataset.rasadyarSection = item.key;
    button.setAttribute('aria-label', item.label);

    if (item.key === 'latest-version') {
      button.title = 'دریافت و نصب آخرین نسخه از GitHub';
    }

    if (this.activeRasadyarNav === item.key) {
      button.setAttribute('aria-current', 'page');
    }

    button.addEventListener('click', () => {
      if (item.key === 'latest-version') {
        void this.requestLatestVersion();
        return;
      }

      this.activeRasadyarNav = item.key;

      if (item.key === 'overview' && primaryTabId) {
        if (this.getState().activeTabId !== primaryTabId) {
          this.callbacks.onSelect(primaryTabId);
        }
      }

      this.updateRasadyarNavState();

      const directEventBySection: Partial<Record<RasadyarNavKey, string>> = {
        'smart-analysis': 'rasadyar:open-analysis-center',
        reports: 'rasadyar:open-report-center',
        settings: 'rasadyar:open-system-settings',
      };

      const directEvent = directEventBySection[item.key];

      if (directEvent) {
        window.dispatchEvent(
          new CustomEvent(directEvent),
        );

        return;
      }

      window.dispatchEvent(
        new CustomEvent<RasadyarNavigateDetail>('rasadyar:navigate', {
          detail: { section: item.key },
        }),
      );
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  private updateRasadyarNavState(): void {
    const items =
      this.tablistEl.querySelectorAll<HTMLElement>('.rasadyar-nav-item');

    for (const item of items) {
      const key =
        item.dataset.rasadyarSection as RasadyarNavKey | undefined;

      const isActive = key === this.activeRasadyarNav;

      item.classList.toggle('active', isActive);

      const button =
        item.querySelector<HTMLButtonElement>('.rasadyar-nav-button');

      if (!button) continue;

      if (isActive) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    }
  }

  private renderTab(
    tab: PanelTab,
    isActive: boolean,
    canDelete: boolean,
    isPrimaryWorkspace = false,
  ): HTMLElement {
    const el = document.createElement('div');

    el.className = `dashboard-tab${isActive ? ' active' : ''}${
      isPrimaryWorkspace ? ' rasadyar-primary-workspace-tab' : ''
    }`;

    el.dataset.tabId = tab.id;

    if (isPrimaryWorkspace) {
      el.hidden = true;
    }

    const label = document.createElement('button');

    label.className = 'dashboard-tab-label';
    label.id = this.getTabButtonId(tab.id);
    label.setAttribute('role', 'tab');
    label.setAttribute('aria-selected', String(isActive));
    label.tabIndex = isActive ? 0 : -1;
    label.setAttribute('aria-controls', 'panelsGrid');
    label.textContent = tab.name;
    label.title = t('dashboardTabs.renameHint', { name: tab.name });

    label.addEventListener('click', () => {
      if (!isActive) this.callbacks.onSelect(tab.id);
    });

    el.appendChild(label);

    if (canDelete) {
      const close = document.createElement('button');

      close.className = 'dashboard-tab-close';
      close.setAttribute(
        'aria-label',
        t('dashboardTabs.deleteTabAria', { name: tab.name }),
      );
      close.title = t('dashboardTabs.deleteTab');
      close.textContent = '×';

      close.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onDelete(tab.id);
      });

      el.appendChild(close);
    }

    return el;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!(e.target instanceof HTMLElement)) return;
    if (e.target.classList.contains('dashboard-tab-rename')) return;

    const tabs = this.getTabButtons();

    const currentIndex = tabs.indexOf(
      e.target.closest('[role="tab"]') as HTMLButtonElement,
    );

    if (currentIndex === -1) return;

    let nextIndex: number | null = null;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();

    const next = tabs[nextIndex];
    const tabId =
      next?.closest('.dashboard-tab')?.getAttribute('data-tab-id');

    if (!next || !tabId) return;

    if (tabId !== this.getState().activeTabId) {
      this.callbacks.onSelect(tabId);

      requestAnimationFrame(() =>
        document.getElementById(this.getTabButtonId(tabId))?.focus(),
      );

      return;
    }

    next.focus();
  }

  private getTabButtons(): HTMLButtonElement[] {
    return Array.from(
      this.element.querySelectorAll<HTMLButtonElement>(
        '.dashboard-tab-label[role="tab"]',
      ),
    );
  }

  private getTabButtonId(tabId: string): string {
    return `dashboard-tab-${tabId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  }

  private updateControlledPanel(activeTabId: string): void {
    const panel = document.getElementById('panelsGrid');
    if (!panel) return;

    const primaryTabId = this.getState().tabs[0]?.id;

    const labelledBy =
      activeTabId === primaryTabId
        ? 'rasadyar-nav-overview'
        : this.getTabButtonId(activeTabId);

    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', labelledBy);
  }

  private startRename(tabEl: HTMLElement, tab: PanelTab): void {
    const labelBtn = tabEl.querySelector('.dashboard-tab-label');

    if (!labelBtn || tabEl.querySelector('.dashboard-tab-rename')) return;

    const input = document.createElement('input');

    input.type = 'text';
    input.className = 'dashboard-tab-rename';
    input.value = tab.name;
    input.maxLength = 40;
    input.setAttribute('aria-label', t('dashboardTabs.tabNameAria'));

    let done = false;

    const commit = () => {
      if (done) return;

      done = true;

      const name = input.value.trim();

      if (name && name !== tab.name) {
        this.callbacks.onRename(tab.id, name);
      } else {
        this.render();
      }
    };

    const cancel = () => {
      if (done) return;

      done = true;
      this.render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commit();
      } else if (e.key === 'Escape') {
        cancel();
      }

      e.stopPropagation();
    });

    input.addEventListener('blur', commit);

    labelBtn.replaceWith(input);
    input.focus();
    input.select();
  }
}
