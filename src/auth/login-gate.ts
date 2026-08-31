import "@fontsource-variable/vazirmatn/wght.css";

import {
  authenticate,
  getCurrentUser,
} from "./userStore";

const LOGIN_ROOT_ID = "rasadyar-login-gate";
const LOGIN_BACKGROUND_IMAGE = "/branding/login-right-panel.png";

let previousBodyOverflow = "";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function lockBodyScroll(): void {
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll(): void {
  document.body.style.overflow = previousBodyOverflow || "";
}

function getLoginBranding() {
  const defaults = {
    systemName: "رصدیار پدافند",
    systemSubtitle: "سامانه هوشمند رصد و تحلیل",
    organizationName: "",
  };

  try {
    const raw = localStorage.getItem("rasadyar_system_settings");

    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);

    return {
      systemName:
        typeof parsed?.systemName === "string" && parsed.systemName.trim()
          ? parsed.systemName.trim()
          : defaults.systemName,

      systemSubtitle:
        typeof parsed?.systemSubtitle === "string" &&
        parsed.systemSubtitle.trim()
          ? parsed.systemSubtitle.trim()
          : defaults.systemSubtitle,

      organizationName:
        typeof parsed?.organizationName === "string"
          ? parsed.organizationName.trim()
          : defaults.organizationName,
    };
  } catch {
    return defaults;
  }
}

function removeLoginGate(): void {
  document.getElementById(LOGIN_ROOT_ID)?.remove();
  unlockBodyScroll();
}

function renderLoginGate(): void {
  removeLoginGate();
  lockBodyScroll();

  const branding = getLoginBranding();
  const root = document.createElement("div");

  root.id = LOGIN_ROOT_ID;

  root.innerHTML = `
    <style>
      #${LOGIN_ROOT_ID} {
        --rs-green: #34d399;
        --rs-green-2: #10b981;
        --rs-green-bright: #4ade80;
        --rs-text: #ffffff;
        --rs-text-dim: rgba(255,255,255,.46);
        --rs-border: rgba(255,255,255,.10);
        --rs-input-bg: rgba(3,10,8,.58);
        --rs-input-border: rgba(107,139,126,.24);

        position: fixed;
        inset: 0;
        z-index: 2147483647;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        direction: rtl;
        color: var(--rs-text);
        font-family:
          "Vazirmatn Variable",
          "Vazirmatn",
          Tahoma,
          Arial,
          sans-serif;

        background:
          linear-gradient(
            180deg,
            rgba(0,0,0,.42),
            rgba(0,0,0,.54)
          ),
          radial-gradient(
            circle at 50% 50%,
            rgba(52,211,153,.06),
            transparent 48%
          ),
          url('${LOGIN_BACKGROUND_IMAGE}');

        background-position: center center;
        background-size: cover;
        background-repeat: no-repeat;
      }

      #${LOGIN_ROOT_ID},
      #${LOGIN_ROOT_ID} * {
        box-sizing: border-box;
      }

      #${LOGIN_ROOT_ID}::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(
            90deg,
            rgba(2,6,5,.48) 0%,
            rgba(2,7,6,.28) 30%,
            rgba(2,7,6,.22) 55%,
            rgba(2,6,5,.42) 100%
          );
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID}::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(52,211,153,.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(52,211,153,.04) 1px, transparent 1px);
        background-size: 48px 48px;
        mask-image:
          radial-gradient(circle at center, #000 22%, transparent 90%);
        opacity: .35;
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-shell {
        position: relative;
        z-index: 2;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        direction: ltr;
        padding: 32px 2vw;
      }

      #${LOGIN_ROOT_ID} .rs-card {
        position: relative;
        overflow: hidden;
        direction: rtl;
        width: min(420px, calc(100vw - 32px));
        padding: 18px 26px;
        border: 1px solid var(--rs-border);
        border-radius: 24px;
        background:
          linear-gradient(
            180deg,
            rgba(9,20,17,.64),
            rgba(5,11,10,.52)
          );
        box-shadow:
          0 24px 90px rgba(0,0,0,.48),
          inset 0 1px 0 rgba(255,255,255,.05);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
      }

      #${LOGIN_ROOT_ID} .rs-card::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(
            circle at top center,
            rgba(52,211,153,.10),
            transparent 38%
          );
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-status {
        position: relative;
        z-index: 1;
        display: flex;
        width: fit-content;
        align-items: center;
        gap: 8px;
        margin: 0 0 18px auto;
        padding: 6px 12px;
        border: 1px solid rgba(52,211,153,.22);
        border-radius: 999px;
        background: rgba(52,211,153,.07);
        color: #a7f3d0;
        font-size: 12px;
        font-weight: 600;
        direction: rtl;
      }

      #${LOGIN_ROOT_ID} .rs-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--rs-green);
        box-shadow: 0 0 12px var(--rs-green);
      }

      #${LOGIN_ROOT_ID} .rs-header {
        position: relative;
        z-index: 1;
        margin-bottom: 22px;
        text-align: center;
      }

      #${LOGIN_ROOT_ID} .rs-title {
        margin: 0;
        color: #fff;
        font-size: 48px;
        font-weight: 800;
        line-height: 1.35;
        letter-spacing: -1px;
      }

      #${LOGIN_ROOT_ID} .rs-subtitle {
        margin: 10px 0 0;
        color: rgba(230,255,244,.92);
        font-size: 17px;
        font-weight: 500;
        line-height: 1.9;
      }

      #${LOGIN_ROOT_ID} .rs-organization {
        margin-top: 8px;
        color: rgba(167,243,208,.72);
        font-size: 13px;
      }

      #${LOGIN_ROOT_ID} .rs-form {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 14px;
      }

      #${LOGIN_ROOT_ID} .rs-field {
        position: relative;
      }

      #${LOGIN_ROOT_ID} .rs-label {
        display: block;
        width: 100%;
        margin: 0 2px 9px 0;
        direction: rtl;
        text-align: right;
        color: rgba(245,255,250,.88);
        font-size: 13px;
        font-weight: 500;
      }

      #${LOGIN_ROOT_ID} .rs-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      #${LOGIN_ROOT_ID} .rs-input-icon {
        position: absolute;
        right: 16px;
        display: flex;
        width: 20px;
        height: 20px;
        align-items: center;
        justify-content: center;
        color: rgba(191,215,205,.72);
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-input-icon svg,
      #${LOGIN_ROOT_ID} .rs-password-toggle svg {
        width: 18px;
        height: 18px;
      }

      #${LOGIN_ROOT_ID} input {
        width: 100%;
        height: 56px;
        padding: 0 46px;
        border: 1px solid var(--rs-input-border);
        border-radius: 14px;
        outline: none;
        background: var(--rs-input-bg);
        color: #fff;
        direction: rtl !important;
        text-align: right !important;
        font-family: inherit;
        font-size: 14px;
        font-weight: 400;
        transition:
          border-color .18s ease,
          box-shadow .18s ease,
          background .18s ease;
      }

      #${LOGIN_ROOT_ID} input::placeholder {
        color: rgba(226,238,232,.30);
        direction: rtl;
        text-align: right;
      }

      #${LOGIN_ROOT_ID} input:focus {
        border-color: rgba(52,211,153,.70);
        background: rgba(5,13,11,.82);
        box-shadow: 0 0 0 4px rgba(52,211,153,.08);
      }

      #${LOGIN_ROOT_ID} .rs-password-toggle {
        position: absolute;
        left: 10px;
        display: inline-flex;
        width: 36px;
        height: 36px;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 10px;
        outline: 0;
        background: transparent;
        color: rgba(191,215,205,.78);
        cursor: pointer;
        transition:
          background .18s ease,
          color .18s ease;
      }

      #${LOGIN_ROOT_ID} .rs-password-toggle:hover {
        background: rgba(52,211,153,.08);
        color: #d1fae5;
      }

      #${LOGIN_ROOT_ID} .rs-error {
        min-height: 20px;
        color: #fecaca;
        font-size: 12px;
        line-height: 1.9;
      }

      #${LOGIN_ROOT_ID} .rs-error:not(:empty) {
        padding: 10px 12px;
        border: 1px solid rgba(239,68,68,.20);
        border-radius: 12px;
        background: rgba(127,29,29,.18);
      }

      /* مدل ۱ نهایی: شیشه‌ای سبز تیره */
      #${LOGIN_ROOT_ID} .rs-login-button {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        width: 100%;
        height: 58px;
        border: 1px solid rgba(74,222,128,.46);
        border-radius: 14px;
        outline: none;

        background:
          linear-gradient(
            180deg,
            rgba(14,72,46,.58) 0%,
            rgba(7,47,31,.54) 52%,
            rgba(4,31,21,.62) 100%
          );

        color: #f5fff9;
        font-family: inherit;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: .1px;
        cursor: pointer;

        backdrop-filter: blur(14px) saturate(125%);
        -webkit-backdrop-filter: blur(14px) saturate(125%);

        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.12),
          inset 0 -1px 0 rgba(16,185,129,.16),
          0 0 0 1px rgba(16,185,129,.04),
          0 10px 28px rgba(0,0,0,.24),
          0 0 20px rgba(52,211,153,.08);

        transition:
          transform .16s ease,
          border-color .18s ease,
          background .18s ease,
          box-shadow .18s ease,
          filter .18s ease;
      }

      #${LOGIN_ROOT_ID} .rs-login-button::before {
        content: "";
        position: absolute;
        z-index: -1;
        inset: 0;
        background:
          linear-gradient(
            110deg,
            transparent 0%,
            rgba(255,255,255,.025) 24%,
            rgba(255,255,255,.12) 48%,
            rgba(255,255,255,.025) 68%,
            transparent 100%
          );
        transform: translateX(-115%);
        transition: transform .52s ease;
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-login-button::after {
        content: "";
        position: absolute;
        z-index: -1;
        right: 12%;
        bottom: -14px;
        left: 12%;
        height: 24px;
        border-radius: 50%;
        background: rgba(52,211,153,.22);
        filter: blur(18px);
        opacity: .42;
        transition:
          opacity .18s ease,
          transform .18s ease;
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-login-button:hover:not(:disabled) {
        transform: translateY(-1px);
        border-color: rgba(110,231,183,.68);
        background:
          linear-gradient(
            180deg,
            rgba(18,92,58,.66) 0%,
            rgba(8,60,39,.60) 52%,
            rgba(5,39,26,.68) 100%
          );
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.16),
          inset 0 -1px 0 rgba(16,185,129,.22),
          0 0 0 1px rgba(52,211,153,.06),
          0 14px 32px rgba(0,0,0,.28),
          0 0 26px rgba(52,211,153,.15);
      }

      #${LOGIN_ROOT_ID}
      .rs-login-button:hover:not(:disabled)::before {
        transform: translateX(115%);
      }

      #${LOGIN_ROOT_ID}
      .rs-login-button:hover:not(:disabled)::after {
        opacity: .68;
        transform: scaleX(1.12);
      }

      #${LOGIN_ROOT_ID} .rs-login-button:active:not(:disabled) {
        transform: translateY(0) scale(.992);
        box-shadow:
          inset 0 2px 8px rgba(0,0,0,.24),
          0 6px 18px rgba(0,0,0,.22),
          0 0 16px rgba(52,211,153,.10);
      }

      #${LOGIN_ROOT_ID} .rs-login-button:focus-visible {
        border-color: rgba(110,231,183,.92);
        box-shadow:
          0 0 0 4px rgba(52,211,153,.12),
          inset 0 1px 0 rgba(255,255,255,.14),
          0 12px 30px rgba(0,0,0,.26);
      }

      #${LOGIN_ROOT_ID} .rs-login-button:disabled {
        cursor: wait;
        opacity: .66;
        transform: none;
        filter: saturate(.72) brightness(.88);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,.08),
          0 8px 20px rgba(0,0,0,.18);
      }

      #${LOGIN_ROOT_ID} .rs-spinner {
        display: none;
        width: 16px;
        height: 16px;
        margin-left: 8px;
        vertical-align: middle;
        border: 2px solid rgba(255,255,255,.28);
        border-top-color: #fff;
        border-radius: 50%;
        animation: rs-spin .75s linear infinite;
      }

      #${LOGIN_ROOT_ID}
      .rs-login-button.rs-loading
      .rs-spinner {
        display: inline-block;
      }

      @keyframes rs-spin {
        to {
          transform: rotate(360deg);
        }
      }

      #${LOGIN_ROOT_ID} .rs-security {
        margin-top: 14px;
        color: var(--rs-text-dim);
        text-align: center;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.9;
      }

      #${LOGIN_ROOT_ID} .rs-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,.06);
        color: rgba(255,255,255,.34);
        font-size: 11px;
        font-weight: 400;
      }

      #${LOGIN_ROOT_ID} .rs-live-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }

      #${LOGIN_ROOT_ID} .rs-live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 10px #22c55e;
      }

      @media (prefers-reduced-motion: reduce) {
        #${LOGIN_ROOT_ID} .rs-login-button,
        #${LOGIN_ROOT_ID} .rs-login-button::before,
        #${LOGIN_ROOT_ID} .rs-login-button::after {
          transition: none;
        }
      }

      @media (max-width: 640px) {
        #${LOGIN_ROOT_ID} {
          overflow-y: auto;
        }

        #${LOGIN_ROOT_ID} .rs-shell {
          align-items: flex-start;
          padding: 18px;
        }

        #${LOGIN_ROOT_ID} .rs-card {
          width: 100%;
          padding: 18px;
          border-radius: 20px;
        }

        #${LOGIN_ROOT_ID} .rs-title {
          font-size: 28px;
        }

        #${LOGIN_ROOT_ID} .rs-subtitle {
          font-size: 15px;
        }

        #${LOGIN_ROOT_ID} .rs-footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-height: 760px) and (min-width: 641px) {
        #${LOGIN_ROOT_ID} .rs-shell {
          align-items: flex-start;
          overflow-y: auto;
          padding-top: 20px;
          padding-bottom: 20px;
        }
      }
    </style>

    <main
      class="rs-shell"
      aria-label="ورود به سامانه رصدیار پدافند"
    >
      <section class="rs-card">
        <div class="rs-status">
          <span class="rs-status-dot"></span>
          سامانه فعال
        </div>

        <header class="rs-header">
          <h1 class="rs-title">
            ${escapeHtml(branding.systemName)}
          </h1>

          <div class="rs-subtitle">
            ${escapeHtml(branding.systemSubtitle)}
          </div>

          ${
            branding.organizationName
              ? `
                <div class="rs-organization">
                  ${escapeHtml(branding.organizationName)}
                </div>
              `
              : ""
          }
        </header>

        <div class="rs-form">
          <div class="rs-field">
            <label class="rs-label" for="rs-user">
              نام کاربری
            </label>

            <div class="rs-input-wrap">
              <span class="rs-input-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path
                    d="M4.5 20C5.5 15.7 8 14 12 14C16 14 18.5 15.7 19.5 20"
                  />
                </svg>
              </span>

              <input
                id="rs-user"
                type="text"
                autocomplete="username"
                spellcheck="false"
                placeholder="نام کاربری خود را وارد کنید"
                aria-label="نام کاربری"
              />
            </div>
          </div>

          <div class="rs-field">
            <label class="rs-label" for="rs-pass">
              رمز عبور
            </label>

            <div class="rs-input-wrap">
              <span class="rs-input-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="10"
                    rx="2"
                  />
                  <path
                    d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10"
                  />
                </svg>
              </span>

              <input
                id="rs-pass"
                type="password"
                autocomplete="current-password"
                placeholder="رمز عبور خود را وارد کنید"
                aria-label="رمز عبور"
              />

              <button
                id="rs-toggle-password"
                class="rs-password-toggle"
                type="button"
                title="نمایش رمز عبور"
                aria-label="نمایش یا مخفی کردن رمز عبور"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12C5 7.5 8.2 5.5 12 5.5C15.8 5.5 19 7.5 21.5 12C19 16.5 15.8 18.5 12 18.5C8.2 18.5 5 16.5 2.5 12Z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          <div
            id="rs-error"
            class="rs-error"
            role="alert"
            aria-live="polite"
          ></div>

          <button
            id="rs-login"
            class="rs-login-button"
            type="button"
          >
            <span class="rs-spinner" aria-hidden="true"></span>
            <span id="rs-login-text">ورود به سامانه</span>
          </button>
        </div>

        <div class="rs-security">
          دسترسی صرفاً برای کاربران مجاز سامانه
        </div>

        <div class="rs-footer">
          <span>
            ${escapeHtml(branding.systemName)}
            &nbsp;•&nbsp;
            v2.10.0
          </span>

          <span class="rs-live-status">
            <span class="rs-live-dot"></span>
            آماده خدمت
          </span>
        </div>
      </section>
    </main>
  `;

  document.body.appendChild(root);

  const usernameInput = document.getElementById("rs-user") as
    | HTMLInputElement
    | null;

  const passwordInput = document.getElementById("rs-pass") as
    | HTMLInputElement
    | null;

  const loginButton = document.getElementById("rs-login") as
    | HTMLButtonElement
    | null;

  const loginText = document.getElementById("rs-login-text");
  const errorBox = document.getElementById("rs-error");

  const passwordToggle = document.getElementById(
    "rs-toggle-password",
  ) as HTMLButtonElement | null;

  const clearError = (): void => {
    if (errorBox) {
      errorBox.textContent = "";
    }
  };

  const performLogin = async (): Promise<void> => {
    if (!usernameInput || !passwordInput || !loginButton) {
      return;
    }

    if (loginButton.disabled) {
      return;
    }

    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username) {
      if (errorBox) {
        errorBox.textContent = "لطفاً نام کاربری را وارد کنید.";
      }

      usernameInput.focus();
      return;
    }

    if (!password) {
      if (errorBox) {
        errorBox.textContent = "لطفاً رمز عبور را وارد کنید.";
      }

      passwordInput.focus();
      return;
    }

    loginButton.disabled = true;
    loginButton.classList.add("rs-loading");

    if (loginText) {
      loginText.textContent = "در حال بررسی...";
    }

    let loginSucceeded = false;

    try {
      const user = await authenticate(username, password);

      if (!user) {
        if (errorBox) {
          errorBox.textContent =
            "نام کاربری یا رمز عبور صحیح نیست.";
        }

        passwordInput.value = "";
        passwordInput.focus();
        return;
      }

      loginSucceeded = true;

      if (loginText) {
        loginText.textContent = "ورود موفق";
      }

      /*
       * authenticate() احراز هویت واقعی سمت سرور را انجام می‌دهد
       * و فقط پروفایل عمومی و بدون رمز را در کش UI قرار می‌دهد.
       */
      removeLoginGate();
      window.location.reload();
    } catch (error) {
      console.error("Login failed:", error);

      if (errorBox) {
        errorBox.textContent =
          "خطایی در ارتباط با سامانه احراز هویت رخ داد.";
      }
    } finally {
      if (!loginSucceeded) {
        loginButton.disabled = false;
        loginButton.classList.remove("rs-loading");

        if (loginText) {
          loginText.textContent = "ورود به سامانه";
        }
      }
    }
  };

  loginButton?.addEventListener("click", () => {
    void performLogin();
  });

  const handleEnter = (event: KeyboardEvent): void => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      event.stopPropagation();
      void performLogin();
    }
  };

  usernameInput?.addEventListener("keydown", handleEnter);
  passwordInput?.addEventListener("keydown", handleEnter);

  usernameInput?.addEventListener("input", clearError);
  passwordInput?.addEventListener("input", clearError);

  passwordToggle?.addEventListener("click", () => {
    if (!passwordInput) {
      return;
    }

    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    passwordToggle.title = isHidden
      ? "مخفی کردن رمز عبور"
      : "نمایش رمز عبور";

    passwordToggle.setAttribute(
      "aria-label",
      isHidden
        ? "مخفی کردن رمز عبور"
        : "نمایش رمز عبور",
    );

    passwordInput.focus();
  });

  window.setTimeout(() => {
    usernameInput?.focus();
  }, 120);
}

export function requireLogin(): boolean {
  try {
    const user = getCurrentUser();

    if (user) {
      removeLoginGate();
      return true;
    }

    renderLoginGate();
    return false;
  } catch (error) {
    console.error(
      "Unable to check login state:",
      error,
    );

    renderLoginGate();
    return false;
  }
}
