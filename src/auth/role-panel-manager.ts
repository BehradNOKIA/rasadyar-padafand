import {
  Component,
  createElement,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from "react";

import {
  createRoot,
  type Root,
} from "react-dom/client";

import {
  AuthProvider,
} from "./AuthProvider";

import UserManagement
  from "./UserManagement";

import ProfileEditor
  from "./ProfileEditor";

import SystemSettings
  from "./SystemSettings";

import AnalysisCenter
  from "../features/analysis/AnalysisCenter";

import ReportCenter
  from "../features/reports/ReportCenter";

import {
  can,
} from "./accessControl";

import {
  getCurrentUser,
} from "./userStore";

import type {
  RasadyarPermission,
} from "./permissions";


/* =========================================================
   Panel State
========================================================= */

const PANEL_ID =
  "rasadyar-role-panel";

let activeRoot:
  Root | null = null;


/* =========================================================
   Close panel
========================================================= */

function closeCurrentPanel():
  void {

  if (activeRoot) {

    try {

      activeRoot.unmount();

    } catch (error) {

      console.warn(
        "Unable to unmount Rasadyar panel:",
        error
      );
    }

    activeRoot =
      null;
  }


  const existing =
    document.getElementById(
      PANEL_ID
    );


  if (existing) {
    existing.remove();
  }
}


/* =========================================================
   Create panel
========================================================= */

function openPanel(
  title: string
): HTMLElement {

  closeCurrentPanel();


  const overlay =
    document.createElement(
      "div"
    );


  overlay.id =
    PANEL_ID;


  overlay.style.cssText = `
    position: fixed;
    inset: 0;

    background:
      rgba(0,0,0,.55);

    z-index: 9999;

    display: flex;

    justify-content:
      flex-end;

    align-items:
      stretch;
  `;


  const box =
    document.createElement(
      "div"
    );


  box.style.cssText = `
    position: relative;

    width:
      min(820px, 96vw);

    height:
      100vh;

    background:
      #111;

    color:
      #ffffff;

    padding:
      24px;

    box-sizing:
      border-box;

    overflow-y:
      auto;

    overflow-x:
      hidden;

    direction:
      rtl;

    border-inline-start:
      1px solid #2c2c2c;

    box-shadow:
      0 0 30px
      rgba(0,0,0,.45);
  `;


  box.addEventListener(
    "click",
    (
      event
    ) => {

      event.stopPropagation();
    }
  );


  /* -------------------------------------------------------
     Header
  ------------------------------------------------------- */

  const header =
    document.createElement(
      "div"
    );


  header.style.cssText = `
    position: sticky;

    top: -24px;

    z-index: 50;

    display: flex;

    align-items:
      center;

    justify-content:
      space-between;

    gap: 12px;

    margin:
      -24px -24px
      18px -24px;

    padding:
      16px 20px;

    background:
      #111;

    border-bottom:
      1px solid #2c2c2c;
  `;


  const titleElement =
    document.createElement(
      "h2"
    );


  titleElement.textContent =
    title;


  titleElement.style.cssText = `
    margin: 0;

    color:
      #ffffff;

    font-size:
      19px;

    font-weight:
      700;

    line-height:
      1.5;
  `;


  const close =
    document.createElement(
      "button"
    );


  close.type =
    "button";


  close.innerHTML =
    "✕";


  close.title =
    "بستن";


  close.setAttribute(
    "aria-label",
    "بستن پنل"
  );


  close.style.cssText = `
    width:
      34px;

    height:
      34px;

    display:
      flex;

    align-items:
      center;

    justify-content:
      center;

    flex:
      0 0 auto;

    border:
      1px solid #3c3c3c;

    border-radius:
      7px;

    background:
      #1c1c1c;

    color:
      #ffffff;

    font-size:
      18px;

    cursor:
      pointer;

    font-family:
      inherit;
  `;


  close.addEventListener(
    "mouseenter",
    () => {

      close.style.background =
        "#292929";
    }
  );


  close.addEventListener(
    "mouseleave",
    () => {

      close.style.background =
        "#1c1c1c";
    }
  );


  close.addEventListener(
    "click",
    () => {

      closeCurrentPanel();
    }
  );


  header.appendChild(
    titleElement
  );


  header.appendChild(
    close
  );


  const mount =
    document.createElement(
      "div"
    );


  mount.className =
    "rasadyar-role-panel-content";


  mount.style.cssText = `
    width: 100%;
    min-height: 100px;
    box-sizing: border-box;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: relative;
    z-index: 1;
    color: #ffffff;
  `;


  box.appendChild(
    header
  );


  box.appendChild(
    mount
  );


  overlay.appendChild(
    box
  );


  document.body.appendChild(
    overlay
  );


  overlay.addEventListener(
    "click",
    () => {

      closeCurrentPanel();
    }
  );


  return mount;
}


/* =========================================================
   Access denied
========================================================= */

function showAccessDenied(
  permission:
    RasadyarPermission
): void {

  document
    .querySelector(
      ".rasadyar-rbac-toast"
    )
    ?.remove();


  const messages:
    Partial<
      Record<
        RasadyarPermission,
        string
      >
    > = {

    "analysis.view":
      "مرکز تحلیل برای نقش مشاهده‌گر در دسترس نیست.",

    "users.manage":
      "مدیریت کاربران فقط برای مدیر اصلی در دسترس است.",

    "system.settings":
      "تنظیمات سامانه فقط برای مدیر اصلی در دسترس است.",

    "report.view":
      "شما مجوز مشاهده گزارش‌ها را ندارید.",

    "profile.edit":
      "برای ویرایش پروفایل باید وارد سامانه شوید.",
  };


  const toast =
    document.createElement(
      "div"
    );


  toast.className =
    "rasadyar-rbac-toast";


  toast.setAttribute(
    "role",
    "alert"
  );


  toast.setAttribute(
    "aria-live",
    "assertive"
  );


  toast.textContent =
    messages[permission] ||
    "شما مجوز دسترسی به این بخش را ندارید.";


  toast.style.cssText = `
    position:
      fixed;

    right:
      22px;

    bottom:
      24px;

    z-index:
      2147483000;

    max-width:
      min(
        390px,
        calc(
          100vw - 44px
        )
      );

    padding:
      11px 14px;

    direction:
      rtl;

    text-align:
      right;

    color:
      #f4fff8;

    background:
      rgba(
        40,
        15,
        15,
        .97
      );

    border:
      1px solid
      rgba(
        248,
        113,
        113,
        .34
      );

    border-radius:
      9px;

    box-shadow:
      0 14px 38px
      rgba(
        0,
        0,
        0,
        .34
      );

    font-family:
      "Vazirmatn Variable",
      "Vazirmatn",
      Tahoma,
      Arial,
      sans-serif;

    font-size:
      12px;

    line-height:
      1.8;
  `;


  document.body.appendChild(
    toast
  );


  window.setTimeout(
    () => {

      toast.remove();

    },
    3000
  );
}


/* =========================================================
   React render error boundary
   Prevents a crashed React child from leaving the panel blank.
========================================================= */

type PanelErrorBoundaryProps = {
  title: string;
  children?: ReactNode;
};

type PanelErrorBoundaryState = {
  error: Error | null;
};

class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(
    error: Error
  ): PanelErrorBoundaryState {
    return {
      error,
    };
  }

  componentDidCatch(
    error: Error,
    info: ErrorInfo
  ): void {
    console.error(
      `[Rasadyar panel: ${this.props.title}] render error:`,
      error,
      info.componentStack
    );
  }

  render(): ReactNode {
    const error =
      this.state.error;

    if (!error) {
      return this.props.children;
    }

    return createElement(
      "div",
      {
        dir: "rtl",
        style: {
          display: "block",
          visibility: "visible",
          opacity: 1,
          padding: "16px",
          marginTop: "8px",
          border: "1px solid rgba(248,113,113,.35)",
          borderRadius: "10px",
          background: "rgba(127,29,29,.20)",
          color: "#fecaca",
          fontFamily:
            '"Vazirmatn Variable", "Vazirmatn", Tahoma, Arial, sans-serif',
          fontSize: "12px",
          lineHeight: 1.9,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        },
      },
      createElement(
        "div",
        {
          style: {
            fontWeight: 800,
            marginBottom: "8px",
            color: "#ffffff",
          },
        },
        "خطای اجرای محتوای پنل"
      ),
      createElement(
        "div",
        null,
        `پنل: ${this.props.title}`
      ),
      createElement(
        "div",
        {
          dir: "ltr",
          style: {
            textAlign: "left",
            marginTop: "8px",
            fontFamily:
              'Consolas, "Courier New", monospace',
          },
        },
        error.message || String(error)
      )
    );
  }
}

/* =========================================================
   React renderer
========================================================= */

function renderPanel(
  title: string,

  component:
    ComponentType<any>,

  permission?:
    RasadyarPermission
): void {

  if (
    permission &&
    !can(
      getCurrentUser(),
      permission
    )
  ) {

    showAccessDenied(
      permission
    );

    return;
  }


  const mount =
    openPanel(
      title
    );


  const root =
    createRoot(
      mount
    );


  activeRoot =
    root;


  try {

    root.render(

      createElement(
        PanelErrorBoundary,
        {
          title,
        },

        createElement(
          "div",
          {
            dir: "rtl",
            style: {
              display: "block",
              visibility: "visible",
              opacity: 1,
              width: "100%",
              minHeight: "80px",
              color: "#ffffff",
            },
          },

          createElement(
            AuthProvider,
            null,

            createElement(
              component
            )
          )
        )
      )
    );

  } catch (error) {

    console.error(
      `[Rasadyar panel: ${title}] root.render error:`,
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    mount.innerHTML = "";

    const errorBox =
      document.createElement(
        "div"
      );

    errorBox.dir =
      "rtl";

    errorBox.style.cssText = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      padding: 16px;
      margin-top: 8px;
      border: 1px solid rgba(248,113,113,.35);
      border-radius: 10px;
      background: rgba(127,29,29,.20);
      color: #fecaca;
      font-family: Tahoma, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.9;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    `;

    errorBox.textContent =
      `خطای اجرای پنل: ${message}`;

    mount.appendChild(
      errorBox
    );
  }
}


/* =========================================================
   Escape
========================================================= */

window.addEventListener(
  "keydown",
  (
    event
  ) => {

    if (
      event.key ===
      "Escape"
    ) {

      closeCurrentPanel();
    }
  }
);


/* =========================================================
   User Management
========================================================= */

window.addEventListener(
  "rasadyar:open-user-management",
  () => {

    renderPanel(
      "مدیریت کاربران",
      UserManagement,
      "users.manage"
    );
  }
);


/* =========================================================
   Analysis
========================================================= */

window.addEventListener(
  "rasadyar:open-analysis-center",
  () => {

    renderPanel(
      "مرکز تحلیل",
      AnalysisCenter,
      "analysis.view"
    );
  }
);


/* =========================================================
   Reports
========================================================= */

window.addEventListener(
  "rasadyar:open-report-center",
  () => {

    renderPanel(
      "مرکز گزارش‌ها",
      ReportCenter,
      "report.view"
    );
  }
);


/* =========================================================
   Profile
========================================================= */

window.addEventListener(
  "rasadyar:open-profile-editor",
  () => {

    renderPanel(
      "ویرایش پروفایل",
      ProfileEditor,
      "profile.edit"
    );
  }
);


/* =========================================================
   System Settings
========================================================= */

window.addEventListener(
  "rasadyar:open-system-settings",
  () => {

    renderPanel(
      "تنظیمات سامانه",
      SystemSettings,
      "system.settings"
    );
  }
);


/* =========================================================
   Explicit close
========================================================= */

window.addEventListener(
  "rasadyar:close-role-panel",
  () => {

    closeCurrentPanel();
  }
);