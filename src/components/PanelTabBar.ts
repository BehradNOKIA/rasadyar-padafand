import type { PanelTab, TabsState } from '@/services/tab-store';
import { t } from '@/services/i18n';
import { PanelGateReason } from '@/services/panel-gating';
import { lockSvg, upgradeSvg } from '@/components/gate-icons';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';
import { billingAwareGateCopy, type GateCopy } from '@/components/ExportGateControl';
import { can } from '@/auth/accessControl';
import { getCurrentUser } from '@/auth/userStore';
import type { RasadyarPermission } from '@/auth/permissions';

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
  | 'settings';

interface RasadyarNavItem {
  key: RasadyarNavKey;
  label: string;
  icon: string;
}

const RASADYAR_NAV_ITEMS: readonly RasadyarNavItem[] = [
  {
    key: 'overview',
    label: 'نمای کلی',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  },
  {
    key: 'global-monitoring',
    label: 'پایش جهانی',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.7 5.5 3.7 9S14.4 18.5 12 21M12 3C9.6 5.5 8.3 8.5 8.3 12S9.6 18.5 12 21"/></svg>',
  },
  {
    key: 'smart-analysis',
    label: 'تحلیل هوشمند',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M3 19h18"/><path d="m4 8 5-4 5 5 6-6"/><path d="M17.5 3H20v2.5"/></svg>',
  },
  {
    key: 'alerts',
    label: 'هشدارها',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>',
  },
  {
    key: 'infrastructure',
    label: 'زیرساخت‌ها',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V8l7-4 7 4v13"/><path d="M9 21v-5h6v5M8 10h.01M12 10h.01M16 10h.01M8 13h.01M12 13h.01M16 13h.01"/></svg>',
  },
  {
    key: 'reports',
    label: 'گزارش‌ها',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 13h6M9 17h6M9 9h2"/></svg>',
  },
  {
    key: 'settings',
    label: 'تنظیمات',
    icon:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1.03-1.56V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.56 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"/></svg>',
  },
] as const;

const RASADYAR_NAV_PERMISSIONS: Partial<
  Record<RasadyarNavKey, RasadyarPermission>
> = {
  overview: 'dashboard.view',
  'global-monitoring': 'map.view',
  'smart-analysis': 'analysis.view',
  alerts: 'dashboard.view',
  infrastructure: 'map.view',
  reports: 'report.view',
  settings: 'system.settings',
};

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

/**
 * Horizontal tab strip for dashboard workspaces. Pure DOM construction
 * (no innerHTML) so user-supplied tab names need no sanitization.
 *
 * Interactions: click switches tabs, double-click renames inline,
 * the per-tab close button deletes (hidden when only one tab remains),
 * and the trailing "+" creates a new tab with the default panels.
 *
 * The "+" can be CAP-LOCKED (KTD8). It stays visually unchanged at rest — a
 * one-glyph button has no room for a lock badge with copy — and only its
 * aria-label changes; clicking it opens an anchored notice with the reason and
 * a CTA. Existing tabs are never touched: the cap blocks creation only.
 */
export class PanelTabBar {
  private element: HTMLElement;
  private tablistEl: HTMLElement;
  private getState: () => TabsState;
  private callbacks: PanelTabBarCallbacks;
  private addBtn: HTMLButtonElement | null = null;
  private addLock: TabAddLock | null = null;
  private notice: HTMLElement | null = null;
  private activeRasadyarNav: RasadyarNavKey = 'overview';
  private sidebarCollapsed = false;
  private collapseBtn: HTMLButtonElement | null = null;
  private readonly liveRegion: HTMLElement;
  private readonly onNoticeOutsideClick: (event: MouseEvent) => void;
  private readonly onNoticeKeyDown: (event: KeyboardEvent) => void;

  constructor(getState: () => TabsState, callbacks: PanelTabBarCallbacks) {
    this.getState = getState;
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'dashboard-tabs-bar';

    try {
      this.sidebarCollapsed = window.localStorage.getItem('rasadyar.sidebarCollapsed') === '1';
    } catch {
      this.sidebarCollapsed = false;
    }
    this.element.classList.toggle('rasadyar-sidebar-collapsed', this.sidebarCollapsed);
    document.documentElement.classList.toggle('rasadyar-sidebar-collapsed', this.sidebarCollapsed);

    // Created up front and empty: an aria-live region only announces content
    // injected AFTER it is in the accessibility tree.
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

    // ARIA: a role="tablist" may only own role="tab"/"presentation" children.
    // The trailing "+" button is an action, not a tab, so the tablist is an
    // inner element holding ONLY the tabs and the add button sits beside it in
    // the bar (see render()). This clears the aria-required-children violation.
    this.tablistEl = document.createElement('div');
    this.tablistEl.className = 'dashboard-tablist';
    this.tablistEl.setAttribute('role', 'tablist');
    this.tablistEl.setAttribute('aria-label', t('dashboardTabs.ariaLabel'));
    this.tablistEl.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Delegate dblclick at the tablist (attached ONCE, survives re-renders).
    // A per-label listener breaks for inactive tabs: the first click switches
    // tabs → render() → replaceChildren() swaps out the label node, so the two
    // clicks land on different elements and the browser dispatches dblclick on
    // their common ancestor (this container) rather than the new label.
    // Resolving the tab from the DOM here makes rename work on any tab.
    this.tablistEl.addEventListener('dblclick', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.dashboard-tab-close')) return; // don't rename on delete dblclick
      const tabEl = (target.closest('.dashboard-tab') ??
        document.elementFromPoint(e.clientX, e.clientY)?.closest('.dashboard-tab')) as HTMLElement | null;
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
    document.documentElement.classList.remove('rasadyar-sidebar-collapsed');
    this.element.remove();
  }

  /**
   * Apply (or clear) the tab cap's locked state. Called on every auth and
   * entitlement emission, so a snapshot that arrives late — or a mid-session
   * upgrade — flips the control without a reload.
   */
  setAddLock(lock: TabAddLock | null): void {
    const wasLocked = this.addLock !== null;
    // Change-detection guard: gating re-fires on every auth/entitlement/
    // subscription emission, most with an unchanged verdict (same pattern as
    // Panel.showGatedCta's repeat-verdict skip).
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
      // Locked → locked with different copy (e.g. anonymous → signed-in
      // free): the open notice carries the OLD reason and the OLD onAction
      // closure. Close it; the next "+" click rebuilds from the new lock.
      this.closeAddLockNotice();
    }
  }

  /**
   * Open the anchored locked notice (icon + reason + CTA) for a click on a
   * capped "+". No-op when the control is not locked.
   */
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
    // The reason travels with the focused button, so a screen-reader user who
    // clicks a locked "+" hears why before the CTA name.
    cta.setAttribute('aria-describedby', desc.id);
    cta.addEventListener('click', () => {
      this.closeAddLockNotice();
      lock.onAction();
    });

    const notice = document.createElement('div');
    notice.className = 'tab-cap-notice';
    notice.append(icon, desc, cta);

    // The bar scrolls horizontally (overflow-x: auto), so an in-flow popover
    // would be clipped by it. The notice is body-anchored and positioned from
    // the button's viewport rect instead.
    document.body.appendChild(notice);
    const rect = this.addBtn.getBoundingClientRect();
    notice.style.top = `${rect.bottom + 6}px`;
    notice.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - notice.offsetWidth - 8))}px`;

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

  private render(): void {
    this.tablistEl.replaceChildren();

    const { tabs, activeTabId } = this.getState();
    const primaryTab = tabs[0];

    for (const item of RASADYAR_NAV_ITEMS) {
      if (!this.canAccessRasadyarNav(item.key)) {
        continue;
      }

      this.tablistEl.appendChild(
        this.renderRasadyarNavItem(
          item,
          primaryTab?.id,
        ),
      );
    }

    // Keep the original workspace system alive. The first/default workspace is
    // represented by the permanent "نمای کلی" item so its duplicate chip is
    // hidden; any additional user-created workspaces still render normally.
    for (const [index, tab] of tabs.entries()) {
      this.tablistEl.appendChild(
        this.renderTab(tab, tab.id === activeTabId, tabs.length > 1, index === 0),
      );
    }

    this.updateControlledPanel(activeTabId);

    const sidebarHeader = document.createElement('div');
    sidebarHeader.className = 'rasadyar-sidebar-header';

    const sidebarTitle = document.createElement('span');
    sidebarTitle.className = 'rasadyar-sidebar-title';
    sidebarTitle.textContent = 'رصدیار پدافند';

    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'rasadyar-sidebar-toggle';
    collapseBtn.addEventListener('click', () => this.toggleSidebar());
    this.collapseBtn = collapseBtn;
    this.updateSidebarToggle();

    sidebarHeader.append(sidebarTitle, collapseBtn);

    const addBtn = document.createElement('button');
    addBtn.className = 'dashboard-tab-add';
    addBtn.title = t('dashboardTabs.addTabTitle');
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => this.callbacks.onAdd());
    this.addBtn = addBtn;
    this.applyAddLock();

    const status = document.createElement('div');
    status.className = 'rasadyar-sidebar-status';

    const statusDot = document.createElement('span');
    statusDot.className = 'rasadyar-sidebar-status-dot';
    statusDot.setAttribute('aria-hidden', 'true');

    const statusText = document.createElement('span');
    statusText.className = 'rasadyar-sidebar-status-text';
    statusText.textContent = 'سامانه فعال';

    status.append(statusDot, statusText);

    this.element.replaceChildren(
      sidebarHeader,
      this.tablistEl,
      addBtn,
      status,
      this.liveRegion,
    );
  }

  private toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.element.classList.toggle('rasadyar-sidebar-collapsed', this.sidebarCollapsed);
    document.documentElement.classList.toggle('rasadyar-sidebar-collapsed', this.sidebarCollapsed);

    try {
      window.localStorage.setItem(
        'rasadyar.sidebarCollapsed',
        this.sidebarCollapsed ? '1' : '0',
      );
    } catch {
      // Persistence is optional; the visual toggle must still work.
    }

    this.updateSidebarToggle();
  }

  private updateSidebarToggle(): void {
    if (!this.collapseBtn) return;

    this.collapseBtn.textContent = this.sidebarCollapsed ? '‹' : '›';
    this.collapseBtn.title = this.sidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو';
    this.collapseBtn.setAttribute(
      'aria-label',
      this.sidebarCollapsed ? 'باز کردن منوی رصدیار' : 'جمع کردن منوی رصدیار',
    );
    this.collapseBtn.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
  }

  private renderRasadyarNavItem(item: RasadyarNavItem, primaryTabId?: string): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `dashboard-tab rasadyar-nav-item${
      this.activeRasadyarNav === item.key ? ' active' : ''
    }`;
    wrapper.setAttribute('role', 'presentation');
    wrapper.dataset.rasadyarSection = item.key;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dashboard-tab-label rasadyar-nav-button';
    button.id = `rasadyar-nav-${item.key}`;
    button.dataset.rasadyarSection = item.key;
    button.setAttribute('aria-label', item.label);
    button.title = item.label;

    const icon = document.createElement('span');
    icon.className = 'rasadyar-nav-icon';
    icon.setAttribute('aria-hidden', 'true');
    setTrustedHtml(icon, trustedHtml(item.icon, 'static Rasadyar navigation SVG'));

    const text = document.createElement('span');
    text.className = 'rasadyar-nav-label';
    text.textContent = item.label;

    button.append(icon, text);

    if (this.activeRasadyarNav === item.key) {
      button.setAttribute('aria-current', 'page');
    }

    button.addEventListener('click', () => {
      this.activeRasadyarNav = item.key;
      this.updateRasadyarNavState();

      this.runRasadyarNavigation(item.key, primaryTabId);

      // Keep one stable public event for future integrations/plugins.
      window.dispatchEvent(
        new CustomEvent<RasadyarNavigateDetail>('rasadyar:navigate', {
          detail: { section: item.key },
        }),
      );
    });

    wrapper.appendChild(button);
    return wrapper;
  }

  private runRasadyarNavigation(section: RasadyarNavKey, primaryTabId?: string): void {
    switch (section) {
      case 'overview': {
        if (primaryTabId && this.getState().activeTabId !== primaryTabId) {
          this.callbacks.onSelect(primaryTabId);
        }

        this.scrollToDashboardTop();
        return;
      }

      case 'global-monitoring': {
        this.activateGlobalMonitoring();
        return;
      }

      case 'smart-analysis': {
        if (!this.canUseAnalysisTools()) {
          this.showRasadyarToast('مرکز تحلیل برای نقش مشاهده‌گر در دسترس نیست.');
          return;
        }

        window.dispatchEvent(new CustomEvent('rasadyar:open-analysis-center'));
        return;
      }

      case 'alerts': {
        window.dispatchEvent(new CustomEvent('rasadyar:open-alerts'));

        /*
         * StrategicRiskPanel is the current operational alert surface.
         * Panel.ts exposes panel identity through data-panel, not data-panel-id.
         */
        const focused = this.focusFirstAvailable([
          '[data-panel="strategic-risk"]',
          '.strategic-risk-panel',
          '[class*="strategic-risk"]',
          '[class*="risk-alerts"]',
          '[class*="breaking-news"]',
          '[class*="alert-panel"]',
        ]);

        if (!focused) {
          this.scrollToDashboardTop();
          this.showRasadyarToast(
            'بخش هشدارها فعال شد؛ پنل هشدار راهبردی در این نما پیدا نشد.'
          );
        }

        return;
      }

      case 'infrastructure': {
        window.dispatchEvent(new CustomEvent('rasadyar:open-infrastructure'));

        const focused = this.focusFirstAvailable([
          '[data-panel-id="infrastructure"]',
          '[data-panel-key="infrastructure"]',
          '[data-panel-id="cii"]',
          '[data-panel-key="cii"]',
          '#cii',
          '.layers-panel',
          '.layer-control',
          '[class*="layer-control"]',
          '[class*="layers-panel"]',
        ]);

        if (!focused) {
          this.scrollToDashboardTop();
          this.showRasadyarToast('نمای زیرساخت‌ها فعال شد.');
        }

        return;
      }

      case 'reports': {
        window.dispatchEvent(new CustomEvent('rasadyar:open-report-center'));
        return;
      }

      case 'settings': {
        if (!this.canManageSettings()) {
          this.showRasadyarToast('تنظیمات سامانه فقط برای مدیر اصلی در دسترس است.');
          return;
        }

        /*
         * Rasadyar deliberately bypasses WorldMonitor's legacy Settings modal.
         * That modal contains hosted-service account surfaces such as PRO,
         * API Keys and Sign In which do not belong to Rasadyar's local
         * Admin / Analyst / Viewer authentication model.
         *
         * The standalone ?settings=1 route is owned by our Rasadyar-specific
         * settings-window.ts and contains only local system/panel controls.
         */
        const settingsUrl = new URL(window.location.href);
        settingsUrl.search = '';
        settingsUrl.hash = '';
        settingsUrl.searchParams.set('settings', '1');

        const opened = window.open(
          settingsUrl.toString(),
          'rasadyar-settings',
          'width=1040,height=760,resizable=yes,scrollbars=yes',
        );

        if (!opened) {
          this.showRasadyarToast('مرورگر پنجره تنظیمات رصدیار را مسدود کرد.');
        }

        return;
      }
    }
  }

  private activateGlobalMonitoring(): void {
    // Prefer the application's own region/view controls whenever available.
    const select = document.querySelector<HTMLSelectElement>(
      'select.region-selector, .region-selector select',
    );

    if (select) {
      const globalOption = Array.from(select.options).find((option) => {
        const value = option.value.trim().toLowerCase();
        const label = option.textContent?.trim() ?? '';
        return value === 'global' || label.includes('جهانی') || label.toLowerCase().includes('global');
      });

      if (globalOption) {
        select.value = globalOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      const globalControl = document.querySelector<HTMLElement>(
        '[data-view="global"], [data-region="global"], [data-value="global"]',
      );
      globalControl?.click();
    }

    // Keep URL intent consistent without forcing a reload.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'global');
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // URL synchronization is best-effort.
    }

    const focused = this.focusFirstAvailable([
      '#map',
      '.map-container',
      '.map-panel',
      '.map-section',
      '[data-panel-id="map"]',
      '[data-panel-key="map"]',
      '.maplibregl-map',
      '.mapboxgl-map',
    ]);

    if (!focused) {
      this.scrollToDashboardTop();
    }
  }

  private scrollToDashboardTop(): void {
    const target =
      document.querySelector<HTMLElement>('.main-content') ??
      document.getElementById('panelsGrid');

    target?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  }

  private focusFirstAvailable(selectors: readonly string[]): boolean {
    for (const selector of selectors) {
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) continue;

      target.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
      });

      target.classList.add('rasadyar-nav-focus');

      window.setTimeout(() => {
        target.classList.remove('rasadyar-nav-focus');
      }, 1600);

      return true;
    }

    return false;
  }

  private canAccessRasadyarNav(
    section: RasadyarNavKey,
  ): boolean {
    const permission =
      RASADYAR_NAV_PERMISSIONS[section];

    if (!permission) {
      return true;
    }

    return can(
      getCurrentUser(),
      permission,
    );
  }

  private canUseAnalysisTools(): boolean {
    return can(
      getCurrentUser(),
      'analysis.view',
    );
  }

  private canManageSettings(): boolean {
    return can(
      getCurrentUser(),
      'system.settings',
    );
  }

  private showRasadyarToast(message: string): void {
    document.querySelector('.rasadyar-nav-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'rasadyar-nav-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  private updateRasadyarNavState(): void {
    const items = this.tablistEl.querySelectorAll<HTMLElement>('.rasadyar-nav-item');

    for (const item of items) {
      const key = item.dataset.rasadyarSection as RasadyarNavKey | undefined;
      const isActive = key === this.activeRasadyarNav;
      item.classList.toggle('active', isActive);

      const button = item.querySelector<HTMLButtonElement>('.rasadyar-nav-button');
      if (!button) continue;

      if (isActive) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
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
      // The permanent "نمای کلی" item above represents this workspace.
      // Hidden keeps the original tab/store fully alive without duplicating it
      // in the Rasadyar sidebar.
      el.hidden = true;
    }

    const label = document.createElement('button');
    label.className = 'dashboard-tab-label';
    label.id = this.getTabButtonId(tab.id);
    label.setAttribute('role', 'tab');
    label.setAttribute('aria-selected', String(isActive));
    label.tabIndex = isActive ? 0 : -1;
    // ARIA tab contract: a role="tab" must point at the tabpanel it controls.
    // All tabs drive the same panel grid (only its contents swap on switch).
    label.setAttribute('aria-controls', 'panelsGrid');
    label.textContent = tab.name;
    label.title = t('dashboardTabs.renameHint', { name: tab.name });
    label.addEventListener('click', () => {
      if (!isActive) this.callbacks.onSelect(tab.id);
    });
    // dblclick-to-rename is handled by the container-level delegate in the
    // constructor so it works for inactive tabs too (see note there).
    el.appendChild(label);

    if (canDelete) {
      const close = document.createElement('button');
      close.className = 'dashboard-tab-close';
      close.setAttribute('aria-label', t('dashboardTabs.deleteTabAria', { name: tab.name }));
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
    const currentIndex = tabs.indexOf(e.target.closest('[role="tab"]') as HTMLButtonElement);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;
    else return;

    e.preventDefault();
    const next = tabs[nextIndex];
    const tabId = next?.closest('.dashboard-tab')?.getAttribute('data-tab-id');
    if (!next || !tabId) return;

    if (tabId !== this.getState().activeTabId) {
      this.callbacks.onSelect(tabId);
      requestAnimationFrame(() => document.getElementById(this.getTabButtonId(tabId))?.focus());
      return;
    }
    next.focus();
  }

  private getTabButtons(): HTMLButtonElement[] {
    return Array.from(this.element.querySelectorAll<HTMLButtonElement>('.dashboard-tab-label[role="tab"]'));
  }

  private getTabButtonId(tabId: string): string {
    return `dashboard-tab-${tabId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  }

  private updateControlledPanel(activeTabId: string): void {
    const panel = document.getElementById('panelsGrid');
    if (!panel) return;

    const primaryTabId = this.getState().tabs[0]?.id;
    const labelledBy =
      activeTabId === primaryTabId ? 'rasadyar-nav-overview' : this.getTabButtonId(activeTabId);

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

    // `done` guards the blur that fires when commit/cancel re-renders the bar.
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (name && name !== tab.name) this.callbacks.onRename(tab.id, name);
      else this.render();
    };
    const cancel = () => {
      if (done) return;
      done = true;
      this.render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      else if (e.key === 'Escape') cancel();
      e.stopPropagation();
    });
    input.addEventListener('blur', commit);

    labelBtn.replaceWith(input);
    input.focus();
    input.select();
  }
}
