import "@fontsource-variable/vazirmatn/wght.css";

import {
  authenticate,
  getCurrentUser,
  refreshCurrentUser,
  setCurrentUser,
} from "./userStore";

/* =========================================================
   Rasadyar Login Gate - Full Background Version
========================================================= */

const LOGIN_ROOT_ID = "rasadyar-login-gate";

/**
 * اگر نام فایل تصویرت فرق دارد،
 * فقط همین مسیر را عوض کن.
 */
const LOGIN_BACKGROUND_IMAGE = "/branding/login-right-panel.png";

let previousBodyOverflow = "";

/* =========================================================
   Helpers
========================================================= */

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

/* =========================================================
   Branding
========================================================= */

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
        parsed?.systemName?.trim() || defaults.systemName,

      systemSubtitle:
        parsed?.systemSubtitle?.trim() || defaults.systemSubtitle,

      organizationName:
        parsed?.organizationName?.trim() || defaults.organizationName,
    };
  } catch {
    return defaults;
  }
}

/* =========================================================
   Remove Login Gate
========================================================= */

function removeLoginGate(): void {
  const existing = document.getElementById(LOGIN_ROOT_ID);

  if (existing) {
    existing.remove();
  }

  unlockBodyScroll();
}

/* =========================================================
   Render Login Gate
========================================================= */

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
        --rs-green-soft: rgba(52, 211, 153, 0.18);
        --rs-text: #ffffff;
        --rs-text-soft: rgba(255, 255, 255, 0.72);
        --rs-text-dim: rgba(255, 255, 255, 0.46);
        --rs-border: rgba(255, 255, 255, 0.10);
        --rs-card-bg: rgba(6, 14, 12, 0.60);
        --rs-card-bg-2: rgba(4, 10, 9, 0.74);
        --rs-input-bg: rgba(3, 10, 8, 0.58);
        --rs-input-border: rgba(107, 139, 126, 0.24);
        --rs-shadow: 0 24px 90px rgba(0, 0, 0, 0.48);

        position: fixed;
        inset: 0;
        z-index: 2147483647;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        direction: rtl;
        color: var(--rs-text);
        font-family: "Vazirmatn", Tahoma, Arial, sans-serif;
        background:
          linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.42),
            rgba(0, 0, 0, 0.54)
          ),
          radial-gradient(
            circle at 50% 50%,
            rgba(52, 211, 153, 0.06),
            transparent 48%
          ),
          url('${LOGIN_BACKGROUND_IMAGE}');
        background-position: center center;
        background-size: cover;
        background-repeat: no-repeat;
      }

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
            rgba(2, 6, 5, 0.48) 0%,
            rgba(2, 7, 6, 0.28) 30%,
            rgba(2, 7, 6, 0.22) 55%,
            rgba(2, 6, 5, 0.42) 100%
          );
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID}::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(52, 211, 153, 0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(52, 211, 153, 0.04) 1px, transparent 1px);
        background-size: 48px 48px;
        mask-image: radial-gradient(circle at center, #000 22%, transparent 90%);
        pointer-events: none;
        opacity: 0.35;
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
        width: min(440px, calc(100vw - 32px));
        border-radius: 24px;
        border: 1px solid var(--rs-border);
        background:
          linear-gradient(
            180deg,
            rgba(9, 20, 17, 0.64),
            rgba(5, 11, 10, 0.52)
          );
        box-shadow:
          var(--rs-shadow),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        padding: 24px 26px 20px;
        position: relative;
        overflow: hidden;
      }

      #${LOGIN_ROOT_ID} .rs-card::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at top center, rgba(52, 211, 153, 0.10), transparent 38%);
        pointer-events: none;
      }

      #${LOGIN_ROOT_ID} .rs-status {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 18px;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid rgba(52, 211, 153, 0.22);
        background: rgba(52, 211, 153, 0.07);
        color: #a7f3d0;
        font-size: 12px;
        font-weight: 600;
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
        text-align: center;
        margin-bottom: 28px;
      }

      #${LOGIN_ROOT_ID} .rs-title {
        margin: 0;
        font-size: clamp(34px, 5vw, 56px);
        line-height: 1.2;
        font-weight: 800;
        color: #ffffff;
        letter-spacing: -0.8px;
      }

      #${LOGIN_ROOT_ID} .rs-subtitle {
        margin: 14px 0 0;
        font-size: 20px;
        line-height: 1.8;
        font-weight: 600;
        color: rgba(230, 255, 244, 0.92);
      }

      #${LOGIN_ROOT_ID} .rs-organization {
        margin-top: 10px;
        font-size: 13px;
        color: rgba(167, 243, 208, 0.72);
      }

      #${LOGIN_ROOT_ID} .rs-form {
        position: relative;
        z-index: 1;
        display: grid;
        gap: 18px;
      }

      #${LOGIN_ROOT_ID} .rs-field {
        position: relative;
      }

      #${LOGIN_ROOT_ID} .rs-label {
        display: block;
        margin: 0 4px 10px;
        font-size: 14px;
        font-weight: 600;
        color: rgba(245, 255, 250, 0.88);
      }

      #${LOGIN_ROOT_ID} .rs-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }

      #${LOGIN_ROOT_ID} .rs-input-icon {
        position: absolute;
        right: 16px;
        width: 20px;
        height: 20px;
        color: rgba(191, 215, 205, 0.72);
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #${LOGIN_ROOT_ID} .rs-input-icon svg {
        width: 18px;
        height: 18px;
      }

      #${LOGIN_ROOT_ID} input {
        width: 100%;
        height: 56px;
        border: 1px solid var(--rs-input-border);
        border-radius: 14px;
        outline: none;
        background: var(--rs-input-bg);
        color: #ffffff;
        padding: 0 46px 0 46px;
        font-size: 15px;
        font-family: inherit;
        transition:
          border-color 0.18s ease,
          box-shadow 0.18s ease,
          background 0.18s ease,
          transform 0.18s ease;
      }

      #${LOGIN_ROOT_ID} input::placeholder {
        color: rgba(226, 238, 232, 0.30);
      }

      #${LOGIN_ROOT_ID} input:focus {
        border-color: rgba(52, 211, 153, 0.70);
        background: rgba(5, 13, 11, 0.82);
        box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.08);
      }

      #${LOGIN_ROOT_ID} .rs-password-toggle {
        position: absolute;
        left: 10px;
        width: 36px;
        height: 36px;
        border: none;
        outline: none;
        border-radius: 10px;
        background: transparent;
        color: rgba(191, 215, 205, 0.78);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.18s ease, color 0.18s ease;
      }

      #${LOGIN_ROOT_ID} .rs-password-toggle:hover {
        background: rgba(52, 211, 153, 0.08);
        color: #d1fae5;
      }

      #${LOGIN_ROOT_ID} .rs-password-toggle svg {
        width: 18px;
        height: 18px;
      }

      #${LOGIN_ROOT_ID} .rs-error {
        min-height: 20px;
        font-size: 12px;
        line-height: 1.9;
        color: #fecaca;
      }

      #${LOGIN_ROOT_ID} .rs-error:not(:empty) {
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(239, 68, 68, 0.20);
        background: rgba(127, 29, 29, 0.18);
      }

      #${LOGIN_ROOT_ID} .rs-login-button {
        height: 58px;
        border: 1px solid rgba(52, 211, 153, 0.36);
        border-radius: 14px;
        outline: none;
        background:
          linear-gradient(135deg, #0f7a3e, #0a6137);
        color: #ffffff;
        font-size: 17px;
        font-weight: 800;
        font-family: inherit;
        cursor: pointer;
        transition:
          transform 0.16s ease,
          box-shadow 0.16s ease,
          background 0.16s ease,
          border-color 0.16s ease;
        box-shadow: 0 16px 36px rgba(21, 128, 61, 0.24);
      }

      #${LOGIN_ROOT_ID} .rs-login-button:hover {
        transform: translateY(-1px);
        border-color: rgba(74, 222, 128, 0.55);
        background: linear-gradient(135deg, #128647, #0b6d3d);
        box-shadow: 0 20px 42px rgba(21, 128, 61, 0.30);
      }

      #${LOGIN_ROOT_ID} .rs-login-button:disabled {
        cursor: wait;
        opacity: 0.72;
        transform: none;
      }

      #${LOGIN_ROOT_ID} .rs-spinner {
        display: none;
        width: 16px;
        height: 16px;
        margin-left: 8px;
        vertical-align: middle;
        border: 2px solid rgba(255, 255, 255, 0.28);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: rs-spin 0.75s linear infinite;
      }

      #${LOGIN_ROOT_ID} .rs-login-button.rs-loading .rs-spinner {
        display: inline-block;
      }

      @keyframes rs-spin {
        to {
          transform: rotate(360deg);
        }
      }

      #${LOGIN_ROOT_ID} .rs-security {
        margin-top: 18px;
        text-align: center;
        font-size: 12px;
        line-height: 1.9;
        color: var(--rs-text-dim);
      }

      #${LOGIN_ROOT_ID} .rs-attribution {
        margin-top: 8px;
        text-align: center;
        font-size: 11px;
        line-height: 1.9;
        font-weight: 400;
        color: rgba(255, 255, 255, 0.42);
      }

      #${LOGIN_ROOT_ID} .rs-footer {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.34);
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

      @media (max-width: 640px) {
        #${LOGIN_ROOT_ID} .rs-shell {
          padding: 18px;
        }

        #${LOGIN_ROOT_ID} .rs-card {
          width: min(100%, 100%);
          padding: 22px 18px 18px;
          border-radius: 20px;
        }

        #${LOGIN_ROOT_ID} .rs-title {
          font-size: 28px;
        }

        #${LOGIN_ROOT_ID} .rs-subtitle {
          font-size: 16px;
        }

        #${LOGIN_ROOT_ID} .rs-footer {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      @media (max-height: 760px) {
        #${LOGIN_ROOT_ID} .rs-shell {
          align-items: flex-start;
          overflow-y: auto;
          padding-top: 20px;
          padding-bottom: 20px;
        }
      }
        /* =========================================
   Login Typography - Vazirmatn
========================================= */

#${LOGIN_ROOT_ID} {
    font-family: "Vazirmatn Variable", Tahoma, Arial, sans-serif;
}

#${LOGIN_ROOT_ID} .rs-title {
    font-size: 48px;
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -1px;
}

#${LOGIN_ROOT_ID} .rs-subtitle {
    font-size: 17px;
    font-weight: 500;
    line-height: 1.9;
}

#${LOGIN_ROOT_ID} .rs-label {
    font-size: 13px;
    font-weight: 500;
}

#${LOGIN_ROOT_ID} input {
    font-size: 14px;
    font-weight: 400;
}

#${LOGIN_ROOT_ID} .rs-login-button {
    font-size: 16px;
    font-weight: 700;
}

#${LOGIN_ROOT_ID} .rs-status {
    font-size: 12px;
    font-weight: 600;
}

#${LOGIN_ROOT_ID} .rs-security,
#${LOGIN_ROOT_ID} .rs-footer {
    font-weight: 400;
}
    /* Fix Persian input direction */
#${LOGIN_ROOT_ID} input {
    direction: rtl !important;
    text-align: right !important;
}

#${LOGIN_ROOT_ID} input::placeholder {
    direction: rtl;
    text-align: right;
}
    #${LOGIN_ROOT_ID} .rs-label {
    width: 100%;
    direction: rtl !important;
    text-align: right !important;

    margin-right: 2px;
    margin-left: 0;
}
    /* Compact login card */

#${LOGIN_ROOT_ID} .rs-card {
    padding-top: 18px;
    padding-bottom: 18px;
}

#${LOGIN_ROOT_ID} .rs-header {
    margin-bottom: 22px;
}

#${LOGIN_ROOT_ID} .rs-form {
    gap: 14px;
}

#${LOGIN_ROOT_ID} .rs-security {
    margin-top: 14px;
}

#${LOGIN_ROOT_ID} .rs-footer {
    margin-top: 14px;
    padding-top: 12px;
}
    #${LOGIN_ROOT_ID} .rs-status {
    display: flex;
    width: fit-content;

    margin-left: 0;
    margin-right: auto;

    direction: rtl;
}
    #${LOGIN_ROOT_ID} .rs-status {
    position: relative;

    display: flex;
    width: fit-content;

    margin: 0 0 18px auto;

    direction: rtl;
}
    </style>

    <main class="rs-shell" aria-label="ورود به سامانه رصدیار پدافند">
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
            سامانه هوشمند رصد و تحلیل
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4.5 20C5.5 15.7 8 14 12 14C16 14 18.5 15.7 19.5 20" />
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7C8 4.8 9.8 3 12 3C14.2 3 16 4.8 16 7V10" />
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M2.5 12C5 7.5 8.2 5.5 12 5.5C15.8 5.5 19 7.5 21.5 12C19 16.5 15.8 18.5 12 18.5C8.2 18.5 5 16.5 2.5 12Z" />
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

        <div class="rs-attribution">
          طراحی شده توسط دانشکده و پژوهشکده پدافند غیرعامل دانشگاه جامع امام حسین (ع)
        </div>

        <div class="rs-footer">
          <span>
            ${escapeHtml(branding.systemName)} &nbsp;•&nbsp; v2.10.0
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

  const usernameInput = document.getElementById("rs-user") as HTMLInputElement | null;
  const passwordInput = document.getElementById("rs-pass") as HTMLInputElement | null;
  const loginButton = document.getElementById("rs-login") as HTMLButtonElement | null;
  const loginText = document.getElementById("rs-login-text");
  const errorBox = document.getElementById("rs-error");
  const passwordToggle = document.getElementById("rs-toggle-password") as HTMLButtonElement | null;

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

    try {
      const user = await authenticate(username, password);

      if (user) {
        setCurrentUser(user);

        if (loginText) {
          loginText.textContent = "ورود موفق";
        }

        removeLoginGate();
        window.location.reload();
        return;
      }

      if (errorBox) {
        errorBox.textContent = "نام کاربری یا رمز عبور صحیح نیست.";
      }

      passwordInput.value = "";
      passwordInput.focus();
    } catch (error) {
      console.error("Login failed:", error);

      const code = error instanceof Error ? error.message : "";

      if (errorBox) {
        if (code === "too-many-attempts") {
          errorBox.textContent =
            "تعداد تلاش‌های ناموفق زیاد است. ۱۵ دقیقه بعد دوباره تلاش کنید.";
        } else if (code === "auth-not-initialized") {
          errorBox.textContent =
            "مخزن امن کاربران هنوز راه‌اندازی نشده است. ابتدا مهاجرت کاربران قبلی را از همین رایانه انجام دهید.";
        } else if (code === "migration-not-allowed") {
          errorBox.textContent =
            "مهاجرت اولیه کاربران فقط از خودِ رایانه سرور (localhost) مجاز است.";
        } else {
          errorBox.textContent =
            "خطایی در ارتباط با سرویس امن احراز هویت رخ داد.";
        }
      }
    } finally {
      loginButton.disabled = false;
      loginButton.classList.remove("rs-loading");

      if (loginText) {
        loginText.textContent = "ورود به سامانه";
      }
    }
  };

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
        : "نمایش رمز عبور"
    );

    passwordInput.focus();
  });

  loginButton?.addEventListener("click", () => {
    void performLogin();
  });

  window.setTimeout(() => {
    usernameInput?.focus();
  }, 120);
}

/* =========================================================
   Public API
========================================================= */

export function requireLogin(): boolean {
  try {
    const cachedUser = getCurrentUser();

    if (cachedUser) {
      removeLoginGate();

      // The local profile is only a display cache. Server session validation is
      // authoritative and can revoke a forged/stale browser role immediately.
      void refreshCurrentUser()
        .then((serverUser) => {
          if (!serverUser) {
            renderLoginGate();
          }
        })
        .catch((error) => {
          console.error("Unable to validate secure session:", error);
          renderLoginGate();
        });

      return true;
    }

    renderLoginGate();

    // A valid HttpOnly session may exist even if the display cache was cleared.
    void refreshCurrentUser()
      .then((serverUser) => {
        if (!serverUser) return;
        setCurrentUser(serverUser);
        removeLoginGate();
        window.location.reload();
      })
      .catch((error) => {
        // Keep the login form visible. Detailed errors are surfaced on login.
        console.warn("Secure session bootstrap did not complete:", error);
      });

    return false;
  } catch (error) {
    console.error("Unable to check login state:", error);
    renderLoginGate();
    return false;
  }
}
