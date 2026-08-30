/**
 * Rasadyar standalone settings window.
 *
 * Loaded when the app is opened with ?settings=1.
 *
 * Design goals:
 * - No WorldMonitor hosted-account UI.
 * - No PRO / Upgrade / API Keys / Sign In surfaces.
 * - Local Rasadyar roles are authoritative.
 * - Only administrators can change system panel configuration.
 * - Panel changes are saved locally and can be applied to the main dashboard
 *   with one explicit "Apply and return" action.
 */

import type { PanelConfig } from '@/types';
import {
  ALL_PANELS,
  DEFAULT_PANELS,
  STORAGE_KEYS,
  VARIANT_DEFAULTS,
  getEffectivePanelConfig,
} from '@/config';
import { SITE_VARIANT } from '@/config/variant';
import { loadFromStorage, saveToStorage } from '@/utils';
import { escapeHtml } from '@/utils/sanitize';
import { isDesktopRuntime } from '@/services/runtime';
import { setTrustedHtml, trustedHtml } from '@/utils/dom-utils';

type RasadyarRole =
  | 'superadmin'
  | 'admin'
  | 'analyst'
  | 'viewer';

interface RasadyarUser {
  name?: string;
  role?: string;
}

function getCurrentRasadyarUser(): RasadyarUser | null {
  try {
    const raw =
      localStorage.getItem('rasadyar_user') ??
      localStorage.getItem('user');

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed as RasadyarUser;
  } catch {
    return null;
  }
}

function normalizeRole(
  role: string | undefined
): RasadyarRole | null {
  if (
    role === 'superadmin' ||
    role === 'admin' ||
    role === 'analyst' ||
    role === 'viewer'
  ) {
    return role;
  }

  return null;
}

function canManageSettings(
  user: RasadyarUser | null
): boolean {
  const role = normalizeRole(user?.role);

  return (
    role === 'superadmin' ||
    role === 'admin'
  );
}

function getRoleLabel(
  role: string | undefined
): string {
  switch (normalizeRole(role)) {
    case 'superadmin':
      return 'مدیر اصلی';

    case 'admin':
      return 'مدیر';

    case 'analyst':
      return 'تحلیلگر';

    case 'viewer':
      return 'مشاهده‌گر';

    default:
      return 'کاربر';
  }
}

function getLocalizedPanelName(
  panelKey: string,
  fallback: string
): string {
  const knownPersianNames: Record<string, string> = {
    'live-news': 'اخبار زنده',
    'live-webcams': 'دوربین‌های زنده',
    'insights': 'بینش‌های هوشمند',
    'forecast': 'پیش‌بینی‌های هوش مصنوعی',
    'cii': 'شاخص بی‌ثباتی کشورها',
    'economic': 'اقتصاد',
    'market': 'بازارها',
    'military': 'تحرکات نظامی',
    'internet-disruptions': 'اختلالات اینترنت',
    'runtime-config': 'تنظیمات اجرای محلی',
  };

  return (
    knownPersianNames[panelKey] ??
    fallback ??
    panelKey
  );
}

function clonePanelConfig(
  config: PanelConfig
): PanelConfig {
  return {
    ...config,
  };
}

function buildInitialPanelSettings():
  Record<string, PanelConfig> {
  const stored =
    loadFromStorage<Record<string, PanelConfig>>(
      STORAGE_KEYS.panels,
      DEFAULT_PANELS
    );

  const result:
    Record<string, PanelConfig> = {};

  /*
   * Preserve stored keys first. This prevents local/custom panel state from
   * being silently discarded by the settings window.
   */
  for (const [key, config] of Object.entries(stored)) {
    result[key] = clonePanelConfig(config);
  }

  const variantDefaults =
    new Set(
      VARIANT_DEFAULTS[SITE_VARIANT] ?? []
    );

  /*
   * Add newly introduced built-in panels without imposing WorldMonitor's
   * hosted-service entitlement / free-panel cap.
   */
  for (const key of Object.keys(ALL_PANELS)) {
    if (key in result) continue;

    const effective =
      getEffectivePanelConfig(
        key,
        SITE_VARIANT
      );

    result[key] = {
      ...effective,
      enabled:
        variantDefaults.has(key),
    };
  }

  return result;
}

function safeCloseWindow(): void {
  try {
    window.close();
  } catch {
    // Closing is best-effort.
  }
}

export function initSettingsWindow(): void {
  const appEl =
    document.getElementById('app');

  if (!appEl) return;

  const rootEl: HTMLElement = appEl;

  document.documentElement.lang = 'fa';
  document.documentElement.dir = 'rtl';
  document.body.dir = 'rtl';

  document.title =
    'تنظیمات رصدیار پدافند';

  const currentUser =
    getCurrentRasadyarUser();

  if (!canManageSettings(currentUser)) {
    setTrustedHtml(
      appEl,
      trustedHtml(
        `
          <style>
            html,
            body {
              margin: 0;
              min-height: 100%;
              background: #050b08;
              color: #eef8f2;
              font-family:
                "Vazirmatn Variable",
                "Vazirmatn",
                Tahoma,
                Arial,
                sans-serif;
            }

            .rs-access-shell {
              min-height: 100vh;
              display: grid;
              place-items: center;
              padding: 24px;
              box-sizing: border-box;
            }

            .rs-access-card {
              width: min(480px, 100%);
              padding: 28px;
              box-sizing: border-box;
              text-align: center;
              border: 1px solid rgba(52, 211, 153, 0.18);
              border-radius: 16px;
              background: rgba(6, 22, 15, 0.92);
            }

            .rs-access-card h1 {
              margin: 0 0 12px;
              font-size: 20px;
            }

            .rs-access-card p {
              margin: 0 0 20px;
              color: rgba(228, 244, 235, 0.62);
              line-height: 1.9;
              font-size: 13px;
            }

            .rs-access-card button {
              min-height: 38px;
              padding: 0 18px;
              border: 1px solid rgba(52, 211, 153, 0.35);
              border-radius: 8px;
              background: #0d6b3b;
              color: #fff;
              font-family: inherit;
              cursor: pointer;
            }
          </style>

          <main class="rs-access-shell">
            <section class="rs-access-card">
              <h1>دسترسی به تنظیمات مجاز نیست</h1>

              <p>
                مدیریت تنظیمات سامانه فقط برای مدیر اصلی در دسترس است.
              </p>

              <button
                type="button"
                id="rasadyarSettingsDeniedClose"
              >
                بستن
              </button>
            </section>
          </main>
        `,
        'Rasadyar settings access denied screen'
      )
    );

    document
      .getElementById(
        'rasadyarSettingsDeniedClose'
      )
      ?.addEventListener(
        'click',
        safeCloseWindow
      );

    return;
  }

  let panelSettings =
    buildInitialPanelSettings();

  const isDesktopApp =
    isDesktopRuntime();

  let searchQuery = '';

  const getVisiblePanelEntries = () => {
    const normalizedQuery =
      searchQuery.trim().toLocaleLowerCase('fa');

    return Object.entries(panelSettings)
      .filter(([key]) => {
        if (
          key === 'runtime-config' &&
          !isDesktopApp
        ) {
          return false;
        }

        return true;
      })
      .filter(([key, panel]) => {
        if (!normalizedQuery) return true;

        const resolvedPanel =
          ALL_PANELS[key]
            ? getEffectivePanelConfig(
                key,
                SITE_VARIANT
              )
            : panel;

        const name =
          getLocalizedPanelName(
            key,
            resolvedPanel.name ??
              panel.name ??
              key
          );

        const haystack =
          `${key} ${name}`
            .toLocaleLowerCase('fa');

        return haystack.includes(
          normalizedQuery
        );
      })
      .sort(([keyA, panelA], [keyB, panelB]) => {
        const resolvedA =
          ALL_PANELS[keyA]
            ? getEffectivePanelConfig(
                keyA,
                SITE_VARIANT
              )
            : panelA;

        const resolvedB =
          ALL_PANELS[keyB]
            ? getEffectivePanelConfig(
                keyB,
                SITE_VARIANT
              )
            : panelB;

        const nameA =
          getLocalizedPanelName(
            keyA,
            resolvedA.name ??
              panelA.name ??
              keyA
          );

        const nameB =
          getLocalizedPanelName(
            keyB,
            resolvedB.name ??
              panelB.name ??
              keyB
          );

        return nameA.localeCompare(
          nameB,
          'fa'
        );
      });
  };

  const save = (): void => {
    saveToStorage(
      STORAGE_KEYS.panels,
      panelSettings
    );
  };

  const resetToDefaults = (): void => {
    const variantDefaults =
      new Set(
        VARIANT_DEFAULTS[SITE_VARIANT] ?? []
      );

    const next:
      Record<string, PanelConfig> = {};

    for (const key of Object.keys(ALL_PANELS)) {
      const config =
        getEffectivePanelConfig(
          key,
          SITE_VARIANT
        );

      next[key] = {
        ...config,
        enabled:
          variantDefaults.has(key),
      };
    }

    /*
     * Keep explicitly local/custom panel definitions that are not part of
     * ALL_PANELS. Resetting built-ins must not destroy local extensions.
     */
    for (const [key, config] of Object.entries(panelSettings)) {
      if (!(key in ALL_PANELS)) {
        next[key] = {
          ...config,
        };
      }
    }

    panelSettings = next;
    save();
    render();
  };

  const setAllVisible = (
    enabled: boolean
  ): void => {
    for (const [key] of getVisiblePanelEntries()) {
      const config =
        panelSettings[key];

      if (!config) continue;

      config.enabled = enabled;
    }

    save();
    render();
  };

  const applyAndReturn = (): void => {
    save();

    try {
      if (
        window.opener &&
        !window.opener.closed
      ) {
        window.opener.location.reload();
      }
    } catch {
      // Same-origin opener reload is best-effort.
    }

    safeCloseWindow();
  };

  function renderPanelGrid(): void {
    const grid =
      document.getElementById(
        'rasadyarPanelToggles'
      );

    const countEl =
      document.getElementById(
        'rasadyarPanelCount'
      );

    if (!grid) return;

    const entries =
      getVisiblePanelEntries();

    const total =
      Object.entries(panelSettings).filter(
        ([key]) =>
          !(
            key === 'runtime-config' &&
            !isDesktopApp
          )
      ).length;

    const enabledCount =
      Object.entries(panelSettings).filter(
        ([key, panel]) =>
          panel.enabled &&
          !(
            key === 'runtime-config' &&
            !isDesktopApp
          )
      ).length;

    if (countEl) {
      countEl.textContent =
        `${enabledCount} از ${total} پنل فعال`;
    }

    if (entries.length === 0) {
      setTrustedHtml(
        grid,
        trustedHtml(
          `
            <div class="rs-settings-empty">
              پنلی مطابق جستجوی شما پیدا نشد.
            </div>
          `,
          'Rasadyar empty panel search state'
        )
      );

      return;
    }

    const html = entries
      .map(([key, panel]) => {
        const resolvedPanel =
          ALL_PANELS[key]
            ? getEffectivePanelConfig(
                key,
                SITE_VARIANT
              )
            : panel;

        const name =
          getLocalizedPanelName(
            key,
            resolvedPanel.name ??
              panel.name ??
              key
          );

        const enabled =
          panel.enabled === true;

        return `
          <button
            type="button"
            class="rs-panel-toggle ${
              enabled
                ? 'is-enabled'
                : ''
            }"
            data-panel="${escapeHtml(key)}"
            aria-pressed="${
              enabled
                ? 'true'
                : 'false'
            }"
          >
            <span
              class="rs-panel-toggle-indicator"
              aria-hidden="true"
            >
              ${enabled ? '✓' : ''}
            </span>

            <span class="rs-panel-toggle-text">
              <strong>
                ${escapeHtml(name)}
              </strong>

              <small dir="ltr">
                ${escapeHtml(key)}
              </small>
            </span>

            <span
              class="rs-panel-toggle-state"
            >
              ${
                enabled
                  ? 'فعال'
                  : 'غیرفعال'
              }
            </span>
          </button>
        `;
      })
      .join('');

    setTrustedHtml(
      grid,
      trustedHtml(
        html,
        'Rasadyar panel settings list'
      )
    );

    grid
      .querySelectorAll<HTMLElement>(
        '.rs-panel-toggle'
      )
      .forEach((item) => {
        item.addEventListener(
          'click',
          () => {
            const panelKey =
              item.dataset.panel;

            if (!panelKey) return;

            const config =
              panelSettings[panelKey];

            if (!config) return;

            /*
             * Rasadyar runs in full professional mode:
             * no hosted-service entitlement checks and no free panel cap.
             */
            config.enabled =
              !config.enabled;

            save();
            renderPanelGrid();
          }
        );
      });
  }

  function render(): void {
    const userName =
      currentUser?.name?.trim() ||
      'مدیر اصلی';

    const roleLabel =
      getRoleLabel(currentUser?.role);

    setTrustedHtml(
      rootEl,
      trustedHtml(
        `
          <style>
            :root {
              color-scheme: dark;
            }

            html,
            body {
              margin: 0;
              min-height: 100%;
              background: #050b08;
              color: #edf7f1;
              font-family:
                "Vazirmatn Variable",
                "Vazirmatn",
                Tahoma,
                Arial,
                sans-serif;
            }

            body {
              min-width: 720px;
            }

            button,
            input {
              font-family: inherit;
            }

            .rs-settings-shell {
              min-height: 100vh;
              box-sizing: border-box;
              padding: 22px;
              background:
                radial-gradient(
                  circle at 85% 0%,
                  rgba(52, 211, 153, 0.055),
                  transparent 30%
                ),
                #050b08;
            }

            .rs-settings-card {
              width: min(980px, 100%);
              margin: 0 auto;
              border: 1px solid rgba(52, 211, 153, 0.16);
              border-radius: 14px;
              background: rgba(5, 18, 12, 0.94);
              box-shadow: 0 20px 55px rgba(0, 0, 0, 0.28);
              overflow: hidden;
            }

            .rs-settings-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 18px;
              padding: 18px 20px;
              border-bottom: 1px solid rgba(52, 211, 153, 0.12);
              background: rgba(4, 22, 14, 0.76);
            }

            .rs-settings-heading {
              min-width: 0;
            }

            .rs-settings-heading h1 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              color: #ffffff;
            }

            .rs-settings-heading p {
              margin: 6px 0 0;
              color: rgba(218, 239, 227, 0.58);
              font-size: 11px;
              line-height: 1.8;
            }

            .rs-settings-close {
              width: 36px;
              height: 36px;
              flex: 0 0 36px;
              border: 1px solid rgba(52, 211, 153, 0.14);
              border-radius: 8px;
              background: rgba(5, 18, 12, 0.72);
              color: rgba(235, 249, 241, 0.72);
              font-size: 20px;
              cursor: pointer;
            }

            .rs-settings-close:hover {
              color: #ffffff;
              border-color: rgba(52, 211, 153, 0.28);
              background: rgba(13, 53, 34, 0.62);
            }

            .rs-settings-meta {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 11px 20px;
              border-bottom: 1px solid rgba(52, 211, 153, 0.08);
              color: rgba(218, 239, 227, 0.56);
              font-size: 10px;
            }

            .rs-settings-user {
              display: inline-flex;
              align-items: center;
              gap: 7px;
            }

            .rs-settings-role {
              padding: 3px 8px;
              border: 1px solid rgba(52, 211, 153, 0.16);
              border-radius: 999px;
              background: rgba(52, 211, 153, 0.05);
              color: rgba(167, 243, 208, 0.84);
            }

            .rs-settings-toolbar {
              display: grid;
              grid-template-columns:
                minmax(220px, 1fr)
                auto
                auto
                auto;
              gap: 8px;
              align-items: center;
              padding: 14px 20px;
              border-bottom: 1px solid rgba(52, 211, 153, 0.08);
            }

            .rs-settings-search {
              height: 38px;
              box-sizing: border-box;
              padding: 0 12px;
              border: 1px solid rgba(52, 211, 153, 0.13);
              border-radius: 8px;
              outline: none;
              background: rgba(2, 12, 8, 0.82);
              color: #ffffff;
              direction: rtl;
              text-align: right;
            }

            .rs-settings-search:focus {
              border-color: rgba(52, 211, 153, 0.34);
              box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.05);
            }

            .rs-settings-search::placeholder {
              color: rgba(220, 238, 228, 0.32);
            }

            .rs-settings-action {
              min-height: 38px;
              padding: 0 11px;
              border: 1px solid rgba(52, 211, 153, 0.13);
              border-radius: 8px;
              background: rgba(6, 26, 17, 0.66);
              color: rgba(235, 249, 241, 0.74);
              font-size: 10px;
              cursor: pointer;
              white-space: nowrap;
            }

            .rs-settings-action:hover {
              color: #ffffff;
              border-color: rgba(52, 211, 153, 0.27);
              background: rgba(13, 53, 34, 0.58);
            }

            .rs-settings-summary {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              padding: 11px 20px 8px;
            }

            .rs-settings-section-title {
              font-size: 13px;
              font-weight: 700;
              color: rgba(244, 252, 248, 0.90);
            }

            .rs-settings-count {
              font-size: 10px;
              color: rgba(167, 243, 208, 0.66);
            }

            .rs-panel-grid {
              display: grid;
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
              gap: 8px;
              max-height: 470px;
              overflow: auto;
              padding: 10px 20px 18px;
              scrollbar-width: thin;
            }

            .rs-panel-toggle {
              min-width: 0;
              min-height: 58px;
              display: grid;
              grid-template-columns:
                26px
                minmax(0, 1fr)
                auto;
              gap: 10px;
              align-items: center;
              padding: 8px 10px;
              border: 1px solid rgba(104, 135, 119, 0.16);
              border-radius: 9px;
              background: rgba(3, 13, 9, 0.72);
              color: rgba(226, 240, 232, 0.66);
              text-align: right;
              cursor: pointer;
            }

            .rs-panel-toggle:hover {
              border-color: rgba(52, 211, 153, 0.22);
              background: rgba(7, 29, 19, 0.68);
            }

            .rs-panel-toggle.is-enabled {
              border-color: rgba(52, 211, 153, 0.22);
              background: rgba(8, 39, 25, 0.54);
              color: #edf9f2;
            }

            .rs-panel-toggle-indicator {
              width: 24px;
              height: 24px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border: 1px solid rgba(112, 143, 127, 0.22);
              border-radius: 6px;
              color: transparent;
              background: rgba(0, 0, 0, 0.18);
            }

            .rs-panel-toggle.is-enabled
            .rs-panel-toggle-indicator {
              color: #052214;
              border-color: #34d399;
              background: #34d399;
              font-weight: 900;
            }

            .rs-panel-toggle-text {
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 3px;
            }

            .rs-panel-toggle-text strong {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: 11px;
              font-weight: 600;
            }

            .rs-panel-toggle-text small {
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              font-size: 8px;
              font-weight: 400;
              color: rgba(195, 214, 204, 0.30);
            }

            .rs-panel-toggle-state {
              font-size: 9px;
              color: rgba(200, 220, 209, 0.40);
            }

            .rs-panel-toggle.is-enabled
            .rs-panel-toggle-state {
              color: rgba(110, 231, 183, 0.78);
            }

            .rs-settings-empty {
              grid-column: 1 / -1;
              padding: 40px 16px;
              text-align: center;
              color: rgba(223, 239, 231, 0.44);
              font-size: 12px;
            }

            .rs-settings-note {
              margin: 0 20px 16px;
              padding: 10px 12px;
              border: 1px solid rgba(52, 211, 153, 0.09);
              border-radius: 8px;
              background: rgba(52, 211, 153, 0.025);
              color: rgba(218, 239, 227, 0.48);
              font-size: 10px;
              line-height: 1.9;
            }

            .rs-settings-footer {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 10px;
              padding: 14px 20px;
              border-top: 1px solid rgba(52, 211, 153, 0.10);
              background: rgba(2, 12, 8, 0.68);
            }

            .rs-settings-footer-copy {
              color: rgba(208, 229, 218, 0.38);
              font-size: 9px;
            }

            .rs-settings-apply {
              min-height: 40px;
              padding: 0 18px;
              border: 1px solid rgba(52, 211, 153, 0.34);
              border-radius: 8px;
              background: #0b6a3a;
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
            }

            .rs-settings-apply:hover {
              background: #0d7841;
              border-color: rgba(74, 222, 128, 0.52);
            }

            @media (max-width: 820px) {
              body {
                min-width: 0;
              }

              .rs-settings-shell {
                padding: 10px;
              }

              .rs-settings-toolbar {
                grid-template-columns:
                  1fr 1fr;
              }

              .rs-settings-search {
                grid-column: 1 / -1;
              }

              .rs-panel-grid {
                grid-template-columns: 1fr;
              }
            }
          </style>

          <main class="rs-settings-shell">
            <section
              class="rs-settings-card"
              aria-labelledby="rasadyarSettingsTitle"
            >
              <header class="rs-settings-header">
                <div class="rs-settings-heading">
                  <h1 id="rasadyarSettingsTitle">
                    تنظیمات رصدیار پدافند
                  </h1>

                  <p>
                    مدیریت پنل‌های داشبورد و تنظیمات نمایش سامانه
                  </p>
                </div>

                <button
                  type="button"
                  class="rs-settings-close"
                  id="rasadyarSettingsClose"
                  aria-label="بستن تنظیمات"
                  title="بستن"
                >
                  ×
                </button>
              </header>

              <div class="rs-settings-meta">
                <span class="rs-settings-user">
                  <span>
                    ${escapeHtml(userName)}
                  </span>

                  <span class="rs-settings-role">
                    ${escapeHtml(roleLabel)}
                  </span>
                </span>

                <span>
                  حالت حرفه‌ای رصدیار فعال است
                </span>
              </div>

              <div class="rs-settings-toolbar">
                <input
                  type="search"
                  class="rs-settings-search"
                  id="rasadyarPanelSearch"
                  placeholder="جستجوی پنل‌ها..."
                  autocomplete="off"
                />

                <button
                  type="button"
                  class="rs-settings-action"
                  id="rasadyarEnableAll"
                >
                  فعال‌سازی همه
                </button>

                <button
                  type="button"
                  class="rs-settings-action"
                  id="rasadyarDisableAll"
                >
                  غیرفعال‌سازی همه
                </button>

                <button
                  type="button"
                  class="rs-settings-action"
                  id="rasadyarResetPanels"
                >
                  بازنشانی پیش‌فرض
                </button>
              </div>

              <div class="rs-settings-summary">
                <span class="rs-settings-section-title">
                  مدیریت پنل‌ها
                </span>

                <span
                  class="rs-settings-count"
                  id="rasadyarPanelCount"
                ></span>
              </div>

              <div
                class="rs-panel-grid"
                id="rasadyarPanelToggles"
              ></div>

              <p class="rs-settings-note">
                در رصدیار پدافند محدودیت PRO، قفل API Keys و ورود مجدد
                WorldMonitor حذف شده است. تغییرات پنل‌ها به‌صورت محلی ذخیره
                می‌شوند و با «اعمال و بازگشت» روی داشبورد اصلی اعمال خواهند شد.
              </p>

              <footer class="rs-settings-footer">
                <span class="rs-settings-footer-copy">
                  تنظیمات محلی رصدیار پدافند
                </span>

                <button
                  type="button"
                  class="rs-settings-apply"
                  id="rasadyarApplySettings"
                >
                  اعمال و بازگشت
                </button>
              </footer>
            </section>
          </main>
        `,
        'Rasadyar standalone settings window'
      )
    );

    const searchInput =
      document.getElementById(
        'rasadyarPanelSearch'
      ) as HTMLInputElement | null;

    searchInput?.addEventListener(
      'input',
      () => {
        searchQuery =
          searchInput.value;

        renderPanelGrid();
      }
    );

    document
      .getElementById(
        'rasadyarEnableAll'
      )
      ?.addEventListener(
        'click',
        () => setAllVisible(true)
      );

    document
      .getElementById(
        'rasadyarDisableAll'
      )
      ?.addEventListener(
        'click',
        () => setAllVisible(false)
      );

    document
      .getElementById(
        'rasadyarResetPanels'
      )
      ?.addEventListener(
        'click',
        resetToDefaults
      );

    document
      .getElementById(
        'rasadyarApplySettings'
      )
      ?.addEventListener(
        'click',
        applyAndReturn
      );

    document
      .getElementById(
        'rasadyarSettingsClose'
      )
      ?.addEventListener(
        'click',
        safeCloseWindow
      );

    renderPanelGrid();
  }

  render();
}
