/* =========================================================
   Rasadyar System Settings Runtime Bridge

   اتصال تنظیمات مدیر اصلی به رفتار واقعی WorldMonitor
========================================================= */

const SETTINGS_KEY =
  "rasadyar_system_settings";

const APPLIED_SIGNATURE_KEY =
  "rasadyar_system_settings_applied_signature";

const WORLD_MONITOR_MAP_MODE_KEY =
  "worldmonitor-map-mode";

const WORLD_MONITOR_LAYERS_KEY =
  "worldmonitor-layers";


/* =========================================================
   Types
========================================================= */

export type RuntimeSystemSettings = {
  systemName: string;
  systemSubtitle: string;
  organizationName: string;

  language: "fa";
  direction: "rtl";
  timezone: string;
  calendar: "jalali";
  hourFormat: "24";

  defaultView: "global";

  defaultMapMode:
    | "2d"
    | "3d";

  defaultTimeRange:
    | "1h"
    | "6h"
    | "24h"
    | "3d"
    | "48h"
    | "7d"
    | "30d"
    | "all";

  defaultLayers: {
    conflicts: boolean;
    bases: boolean;
    hotspots: boolean;
    nuclear: boolean;
    sanctions: boolean;
    weather: boolean;
    canadaAlerts: boolean;
  };

  reportHeaderTitle: string;
  reportOrganizationName: string;

  showPublishedDate: boolean;
  showAuthor: boolean;
  showSourceAnalysis: boolean;
  showEvidence: boolean;

  defaultClassification:
    | "normal"
    | "internal"
    | "confidential";

  printOrientation:
    | "portrait"
    | "landscape";
};


/* =========================================================
   Defaults
========================================================= */

const DEFAULT_SETTINGS:
  RuntimeSystemSettings = {

  systemName:
    "رصدیار پدافند",

  systemSubtitle:
    "داشبورد هوشمند رصد و تحلیل",

  organizationName:
    "",

  language:
    "fa",

  direction:
    "rtl",

  timezone:
    "Asia/Tehran",

  calendar:
    "jalali",

  hourFormat:
    "24",

  defaultView:
    "global",

  defaultMapMode:
    "2d",

  defaultTimeRange:
    "7d",

  defaultLayers: {
    conflicts: true,
    bases: true,
    hotspots: true,
    nuclear: true,
    sanctions: true,
    weather: false,
    canadaAlerts: false,
  },

  reportHeaderTitle:
    "رصدیار پدافند",

  reportOrganizationName:
    "",

  showPublishedDate:
    true,

  showAuthor:
    true,

  showSourceAnalysis:
    true,

  showEvidence:
    true,

  defaultClassification:
    "normal",

  printOrientation:
    "portrait",
};


/* =========================================================
   Managed Layers

   فقط همین لایه‌هایی که در صفحه تنظیمات مدیر
   وجود دارند مدیریت می‌شوند.

   سایر لایه‌های WorldMonitor دست‌نخورده می‌مانند.
========================================================= */

const MANAGED_LAYER_KEYS = [
  "conflicts",
  "bases",
  "hotspots",
  "nuclear",
  "sanctions",
  "weather",
  "canadaAlerts",
] as const;


/* =========================================================
   Load Settings
========================================================= */

export function loadRuntimeSystemSettings():
  RuntimeSystemSettings {

  try {

    const raw =
      localStorage.getItem(
        SETTINGS_KEY
      );


    if (!raw) {

      return {
        ...DEFAULT_SETTINGS,

        defaultLayers: {
          ...DEFAULT_SETTINGS.defaultLayers,
        },
      };
    }


    const parsed =
      JSON.parse(raw);


    return {
      ...DEFAULT_SETTINGS,

      ...parsed,

      defaultLayers: {
        ...DEFAULT_SETTINGS.defaultLayers,

        ...(parsed?.defaultLayers || {}),
      },
    };

  } catch (error) {

    console.warn(
      "[Rasadyar Settings] Failed to read settings:",
      error
    );


    return {
      ...DEFAULT_SETTINGS,

      defaultLayers: {
        ...DEFAULT_SETTINGS.defaultLayers,
      },
    };
  }
}


/* =========================================================
   Time Range Adapter

   WorldMonitor native:
   1h / 6h / 24h / 48h / 7d / all
========================================================= */

function normalizeWorldMonitorTimeRange(
  value: string
): string {

  switch (value) {

    case "1h":
      return "1h";

    case "6h":
      return "6h";

    case "24h":
      return "24h";

    case "48h":
      return "48h";

    case "7d":
      return "7d";

    case "all":
      return "all";


    /*
     * سازگاری با گزینه‌هایی که قبلاً
     * در تنظیمات رصدیار تعریف کردیم.
     */

    case "3d":
      return "48h";

    case "30d":
      return "all";

    default:
      return "7d";
  }
}


/* =========================================================
   Read active layers
========================================================= */

function getActiveLayers(
  url: URL
): Set<string> {

  const result =
    new Set<string>();


  /*
   * ابتدا URL را می‌خوانیم چون در WorldMonitor
   * URL از storage اولویت بالاتری دارد.
   */

  const urlLayers =
    url.searchParams.get(
      "layers"
    );


  if (
    urlLayers !== null
  ) {

    const clean =
      urlLayers.trim();


    if (
      clean &&
      clean !== "none"
    ) {

      clean
        .split(",")
        .map(
          (item) =>
            item.trim()
        )
        .filter(Boolean)
        .forEach(
          (item) =>
            result.add(item)
        );
    }


    return result;
  }


  /*
   * اگر layers در URL نبود،
   * وضعیت ذخیره‌شده WorldMonitor را می‌خوانیم.
   */

  try {

    const raw =
      localStorage.getItem(
        WORLD_MONITOR_LAYERS_KEY
      );


    if (!raw) {
      return result;
    }


    const parsed =
      JSON.parse(raw);


    if (
      parsed &&
      typeof parsed ===
        "object"
    ) {

      Object.entries(
        parsed
      ).forEach(
        ([
          key,
          enabled,
        ]) => {

          if (
            enabled === true
          ) {

            result.add(
              key
            );
          }
        }
      );
    }

  } catch (error) {

    console.warn(
      "[Rasadyar Settings] Unable to read WorldMonitor layers:",
      error
    );
  }


  return result;
}


/* =========================================================
   Branding
========================================================= */

function applyBranding(
  settings:
    RuntimeSystemSettings
): void {

  const name =
    settings.systemName.trim() ||
    "رصدیار پدافند";


  const subtitle =
    settings.systemSubtitle.trim();


  document.documentElement.lang =
    "fa";


  document.documentElement.dir =
    "rtl";


  document.title =
    subtitle
      ? `${name} — ${subtitle}`
      : name;


  /*
   * CSS Variableها برای استفاده‌های آینده
   */

  document.documentElement.style.setProperty(
    "--rasadyar-system-name",
    `"${name}"`
  );
}


/* =========================================================
   Map Mode
========================================================= */

function applyMapMode(
  settings:
    RuntimeSystemSettings
): void {

  /*
   * WorldMonitor:
   *
   * flat  = 2D
   * globe = 3D
   *
   * سرویس اصلی WorldMonitor مقدار را
   * با JSON.parse می‌خواند.
   */

  const mode =
    settings.defaultMapMode ===
      "3d"
      ? "globe"
      : "flat";


  try {

    localStorage.setItem(

      WORLD_MONITOR_MAP_MODE_KEY,

      JSON.stringify(
        mode
      )
    );

  } catch (error) {

    console.warn(
      "[Rasadyar Settings] Unable to save map mode:",
      error
    );
  }
}


/* =========================================================
   URL / Map Settings
========================================================= */

function applyMapUrlSettings(
  settings:
    RuntimeSystemSettings
): void {

  try {

    const url =
      new URL(
        window.location.href
      );


    /* -------------------------------------------------------
       View
    ------------------------------------------------------- */

    if (
      !url.searchParams.has(
        "view"
      )
    ) {

      url.searchParams.set(
        "view",
        settings.defaultView ||
          "global"
      );
    }


    /* -------------------------------------------------------
       Time range
    ------------------------------------------------------- */

    url.searchParams.set(

      "timeRange",

      normalizeWorldMonitorTimeRange(
        settings.defaultTimeRange
      )
    );


    /* -------------------------------------------------------
       Layers
    ------------------------------------------------------- */

    const activeLayers =
      getActiveLayers(
        url
      );


    MANAGED_LAYER_KEYS.forEach(
      (layer) => {

        const enabled =
          settings
            .defaultLayers[
              layer
            ];


        if (enabled) {

          activeLayers.add(
            layer
          );

        } else {

          activeLayers.delete(
            layer
          );
        }
      }
    );


    const layersValue =
      activeLayers.size > 0
        ? Array.from(
            activeLayers
          ).join(",")
        : "none";


    url.searchParams.set(
      "layers",
      layersValue
    );


    /*
     * بدون reload URL را اصلاح می‌کنیم.
     * چون این تابع قبل از new App اجرا می‌شود،
     * WorldMonitor همین URL جدید را می‌خواند.
     */

    window.history.replaceState(

      window.history.state,

      "",

      url.toString()
    );

  } catch (error) {

    console.warn(
      "[Rasadyar Settings] Unable to apply map URL settings:",
      error
    );
  }
}


/* =========================================================
   Apply Dashboard Settings
========================================================= */

function applyDashboardSettings(
  settings:
    RuntimeSystemSettings
): void {

  applyBranding(
    settings
  );

  applyMapMode(
    settings
  );

  applyMapUrlSettings(
    settings
  );
}


/* =========================================================
   Signature
========================================================= */

function createSignature(
  settings:
    RuntimeSystemSettings
): string {

  try {

    return JSON.stringify(
      settings
    );

  } catch {

    return String(
      Date.now()
    );
  }
}


/* =========================================================
   Install Runtime
========================================================= */

export function installSystemSettingsRuntime():
  void {

  const currentSettings =
    loadRuntimeSystemSettings();


  /*
   * Branding همیشه اعمال شود.
   */

  applyBranding(
    currentSettings
  );


  /*
   * تنظیمات پیش‌فرض فقط وقتی دوباره اعمال شوند
   * که مدیر تنظیمات را تغییر داده باشد.
   *
   * در نتیجه تغییر دستی کاربر در نقشه، بعد از
   * هر Refresh بی‌دلیل Reset نمی‌شود.
   */

  const signature =
    createSignature(
      currentSettings
    );


  const appliedSignature =
    localStorage.getItem(
      APPLIED_SIGNATURE_KEY
    );


  if (
    signature !==
    appliedSignature
  ) {

    applyDashboardSettings(
      currentSettings
    );


    localStorage.setItem(

      APPLIED_SIGNATURE_KEY,

      signature
    );
  }


  /* -------------------------------------------------------
     Listen for Admin Settings Changes
  ------------------------------------------------------- */

  window.addEventListener(

    "rasadyar:system-settings-changed",

    (
      event:
        Event
    ) => {

      const customEvent =
        event as
          CustomEvent<
            RuntimeSystemSettings
          >;


      const next =
        customEvent.detail ||
        loadRuntimeSystemSettings();


      applyDashboardSettings(
        next
      );


      localStorage.setItem(

        APPLIED_SIGNATURE_KEY,

        createSignature(
          next
        )
      );


      /*
       * WorldMonitor هنگام ساخت MapContainer
       * map mode / URL state را می‌خواند.
       *
       * بنابراین پس از تغییر تنظیمات مدیر
       * یک Reload کنترل‌شده انجام می‌دهیم.
       */

      window.setTimeout(
        () => {

          window.location.reload();

        },
        180
      );
    }
  );
}