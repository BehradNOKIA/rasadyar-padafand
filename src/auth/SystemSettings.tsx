import React, {
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthProvider";


/* =========================================================
   Storage
========================================================= */

export const SYSTEM_SETTINGS_KEY =
  "rasadyar_system_settings";

const UPDATE_ENDPOINT =
  "/api/rasadyar-auth/system/update";

const UPDATE_REPOSITORY =
  "https://github.com/BehradNOKIA/rasadyar-padafand.git";

const UPDATE_BRANCH =
  "main";


/* =========================================================
   Types
========================================================= */

type MapMode =
  | "2d"
  | "3d";

type TimeRange =
  | "24h"
  | "3d"
  | "7d"
  | "30d";

type Classification =
  | "normal"
  | "internal"
  | "confidential";

type PrintOrientation =
  | "portrait"
  | "landscape";

type DefaultLayers = {
  conflicts: boolean;
  bases: boolean;
  hotspots: boolean;
  nuclear: boolean;
  sanctions: boolean;
  weather: boolean;
  canadaAlerts: boolean;
};

type UpdateResponse = {
  ok?: boolean;
  message?: string;
  code?: string;
  currentVersion?: string;
  latestVersion?: string;
  deploymentId?: string;
};

export type SystemSettingsData = {
  systemName: string;
  systemSubtitle: string;
  organizationName: string;

  language: "fa";
  direction: "rtl";
  timezone: string;
  calendar: "jalali";
  hourFormat: "24";

  defaultView: "global";
  defaultMapMode: MapMode;
  defaultTimeRange: TimeRange;

  defaultLayers: DefaultLayers;

  reportHeaderTitle: string;
  reportOrganizationName: string;
  showPublishedDate: boolean;
  showAuthor: boolean;
  showSourceAnalysis: boolean;
  showEvidence: boolean;
  defaultClassification: Classification;
  printOrientation: PrintOrientation;
};


/* =========================================================
   Defaults
========================================================= */

export const DEFAULT_SYSTEM_SETTINGS:
  SystemSettingsData = {

  systemName:
    "رصدیار پدافند",

  systemSubtitle:
    "سامانه هوشمند رصد و تحلیل",

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
    conflicts:
      true,

    bases:
      true,

    hotspots:
      true,

    nuclear:
      true,

    sanctions:
      true,

    weather:
      false,

    canadaAlerts:
      false,
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
   Storage Helpers
========================================================= */

export function loadSystemSettings():
  SystemSettingsData {

  try {

    const raw =
      localStorage.getItem(
        SYSTEM_SETTINGS_KEY
      );

    if (!raw) {

      return {
        ...DEFAULT_SYSTEM_SETTINGS,

        defaultLayers: {
          ...DEFAULT_SYSTEM_SETTINGS.defaultLayers,
        },
      };
    }

    const parsed =
      JSON.parse(raw);

    return {
      ...DEFAULT_SYSTEM_SETTINGS,
      ...parsed,

      defaultLayers: {
        ...DEFAULT_SYSTEM_SETTINGS.defaultLayers,
        ...(parsed?.defaultLayers || {}),
      },
    };

  } catch (error) {

    console.error(
      "Unable to load system settings:",
      error
    );

    return {
      ...DEFAULT_SYSTEM_SETTINGS,

      defaultLayers: {
        ...DEFAULT_SYSTEM_SETTINGS.defaultLayers,
      },
    };
  }
}


export function saveSystemSettings(
  settings:
    SystemSettingsData
): void {

  localStorage.setItem(
    SYSTEM_SETTINGS_KEY,
    JSON.stringify(
      settings
    )
  );
}


/* =========================================================
   Parsers
========================================================= */

function parseMapMode(
  value: string
): MapMode {

  return value === "3d"
    ? "3d"
    : "2d";
}


function parseTimeRange(
  value: string
): TimeRange {

  if (
    value === "24h" ||
    value === "3d" ||
    value === "7d" ||
    value === "30d"
  ) {
    return value;
  }

  return "7d";
}


function parseClassification(
  value: string
): Classification {

  if (
    value === "internal"
  ) {
    return "internal";
  }

  if (
    value === "confidential"
  ) {
    return "confidential";
  }

  return "normal";
}


function parsePrintOrientation(
  value: string
): PrintOrientation {

  return value ===
    "landscape"
    ? "landscape"
    : "portrait";
}


/* =========================================================
   Component
========================================================= */

export default function SystemSettings() {

  const auth =
    useAuth();

  const user =
    auth?.user;

  const isSuperAdmin =
    user?.role ===
      "superadmin";

  const [
    settings,
    setSettings,
  ] =
    useState<SystemSettingsData>(
      () =>
        loadSystemSettings()
    );

  const [
    savedMessage,
    setSavedMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    isUpdating,
    setIsUpdating,
  ] =
    useState(false);

  const [
    updateMessage,
    setUpdateMessage,
  ] =
    useState("");

  const [
    updateError,
    setUpdateError,
  ] =
    useState("");


  /* ---------------------------------------------------------
     Auto clear normal success message
  --------------------------------------------------------- */

  useEffect(
    () => {

      if (!savedMessage) {
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            setSavedMessage("");
          },
          3000
        );

      return () => {
        window.clearTimeout(
          timer
        );
      };
    },
    [
      savedMessage,
    ]
  );


  /* ---------------------------------------------------------
     Update setting
  --------------------------------------------------------- */

  function updateSetting<
    K extends keyof SystemSettingsData
  >(
    key: K,
    value:
      SystemSettingsData[K]
  ): void {

    setSettings(
      (current) => ({
        ...current,

        [key]:
          value,
      })
    );
  }


  /* ---------------------------------------------------------
     Update layer
  --------------------------------------------------------- */

  function updateLayer(
    key:
      keyof DefaultLayers,
    value:
      boolean
  ): void {

    setSettings(
      (current) => ({
        ...current,

        defaultLayers: {
          ...current.defaultLayers,

          [key]:
            value,
        },
      })
    );
  }


  /* ---------------------------------------------------------
     Save
  --------------------------------------------------------- */

  function save(): void {

    setSavedMessage("");
    setErrorMessage("");

    if (
      !settings.systemName.trim()
    ) {

      setErrorMessage(
        "نام سامانه نمی‌تواند خالی باشد."
      );

      return;
    }

    try {

      const next:
        SystemSettingsData = {
        ...settings,

        systemName:
          settings.systemName.trim(),

        systemSubtitle:
          settings.systemSubtitle.trim(),

        organizationName:
          settings.organizationName.trim(),

        reportHeaderTitle:
          settings.reportHeaderTitle.trim(),

        reportOrganizationName:
          settings.reportOrganizationName.trim(),
      };

      saveSystemSettings(
        next
      );

      setSettings(
        next
      );

      setSavedMessage(
        "تنظیمات سامانه با موفقیت ذخیره شد."
      );

      window.dispatchEvent(
        new CustomEvent(
          "rasadyar:system-settings-changed",
          {
            detail:
              next,
          }
        )
      );

    } catch (error) {

      console.error(
        "Unable to save system settings:",
        error
      );

      setErrorMessage(
        "خطا در ذخیره تنظیمات سامانه."
      );
    }
  }


  /* ---------------------------------------------------------
     Reset
  --------------------------------------------------------- */

  function resetSettings():
    void {

    const confirmed =
      window.confirm(
        "تمام تنظیمات سامانه به حالت پیش‌فرض بازگردانده شود؟"
      );

    if (!confirmed) {
      return;
    }

    const defaults:
      SystemSettingsData = {
      ...DEFAULT_SYSTEM_SETTINGS,

      defaultLayers: {
        ...DEFAULT_SYSTEM_SETTINGS.defaultLayers,
      },
    };

    setSettings(
      defaults
    );

    saveSystemSettings(
      defaults
    );

    window.dispatchEvent(
      new CustomEvent(
        "rasadyar:system-settings-changed",
        {
          detail:
            defaults,
        }
      )
    );

    setErrorMessage("");

    setSavedMessage(
      "تنظیمات پیش‌فرض بازیابی شد."
    );
  }


  /* ---------------------------------------------------------
     Latest version
  --------------------------------------------------------- */

  async function installLatestVersion():
    Promise<void> {

    if (
      !isSuperAdmin
    ) {
      setUpdateError(
        "فقط مدیر اصلی اجازه بروزرسانی سامانه را دارد."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "آخرین نسخه شاخه main از مخزن رسمی رصدیار دریافت و روی سرور نصب شود؟\n\nدر زمان بروزرسانی ممکن است سامانه برای مدت کوتاهی در دسترس نباشد."
      );

    if (
      !confirmed
    ) {
      return;
    }

    setIsUpdating(
      true
    );

    setUpdateMessage(
      ""
    );

    setUpdateError(
      ""
    );

    try {

      const response =
        await fetch(
          UPDATE_ENDPOINT,
          {
            method:
              "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                repository:
                  UPDATE_REPOSITORY,

                branch:
                  UPDATE_BRANCH,
              }),
          }
        );

      let result:
        UpdateResponse = {};

      try {

        result =
          await response.json() as
            UpdateResponse;

      } catch {
        result = {};
      }

      if (
        !response.ok ||
        result.ok === false
      ) {

        if (
          response.status === 401
        ) {
          throw new Error(
            "نشست مدیریتی معتبر نیست. دوباره وارد سامانه شوید."
          );
        }

        if (
          response.status === 403
        ) {
          throw new Error(
            "فقط مدیر اصلی اجازه بروزرسانی سامانه را دارد."
          );
        }

        if (
          response.status === 404
        ) {
          throw new Error(
            "سرویس بروزرسانی سمت سرور هنوز فعال نشده است."
          );
        }

        throw new Error(
          result.message ||
          result.code ||
          "شروع بروزرسانی ناموفق بود."
        );
      }

      const details:
        string[] = [];

      if (
        result.latestVersion
      ) {
        details.push(
          `نسخه جدید: ${result.latestVersion}`
        );
      }

      if (
        result.deploymentId
      ) {
        details.push(
          `شناسه بروزرسانی: ${result.deploymentId}`
        );
      }

      setUpdateMessage(
        [
          result.message ||
            "فرآیند دریافت و نصب آخرین نسخه با موفقیت آغاز شد.",

          ...details,
        ].join(
          " — "
        )
      );

    } catch (error) {

      console.error(
        "Unable to start Rasadyar update:",
        error
      );

      setUpdateError(
        error instanceof Error
          ? error.message
          : "خطا در شروع بروزرسانی سامانه."
      );

    } finally {

      setIsUpdating(
        false
      );
    }
  }


  /* =========================================================
     Authentication
  ========================================================= */

  if (!user) {

    return (
      <div
        dir="rtl"
        style={
          pageStyle
        }
      >
        خطای احراز هویت
      </div>
    );
  }


  if (!isSuperAdmin) {

    return (
      <div
        dir="rtl"
        style={
          pageStyle
        }
      >
        <div
          style={
            accessDeniedStyle
          }
        >
          دسترسی به تنظیمات سامانه فقط برای مدیر اصلی مجاز است.
        </div>
      </div>
    );
  }


  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      dir="rtl"
      style={
        pageStyle
      }
    >

      <div
        style={
          headerStyle
        }
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
            }}
          >
            تنظیمات سامانه
          </h2>

          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              opacity: 0.6,
            }}
          >
            پیکربندی عمومی رصدیار پدافند
          </div>
        </div>

        <div
          style={
            adminBadgeStyle
          }
        >
          مدیر اصلی
        </div>
      </div>


      {savedMessage && (
        <div
          style={
            successStyle
          }
        >
          {savedMessage}
        </div>
      )}


      {errorMessage && (
        <div
          style={
            errorStyle
          }
        >
          {errorMessage}
        </div>
      )}


      <Section
        title="عمومی سامانه"
        description="اطلاعات اصلی و هویت نمایشی سامانه"
      >
        <Field
          label="نام سامانه"
        >
          <input
            type="text"
            dir="auto"
            value={
              settings.systemName
            }
            onChange={(
              event
            ) => {
              updateSetting(
                "systemName",
                event.target.value
              );
            }}
            style={
              inputStyle
            }
          />
        </Field>


        <Field
          label="عنوان فرعی"
        >
          <input
            type="text"
            dir="auto"
            value={
              settings.systemSubtitle
            }
            onChange={(
              event
            ) => {
              updateSetting(
                "systemSubtitle",
                event.target.value
              );
            }}
            style={
              inputStyle
            }
          />
        </Field>


        <Field
          label="نام سازمان / واحد بهره‌بردار"
        >
          <input
            type="text"
            dir="auto"
            value={
              settings.organizationName
            }
            onChange={(
              event
            ) => {
              updateSetting(
                "organizationName",
                event.target.value
              );
            }}
            style={
              inputStyle
            }
            placeholder="نام سازمان..."
          />
        </Field>
      </Section>


      <Section
        title="زبان و زمان"
        description="تنظیمات بومی‌سازی سامانه"
      >
        <div
          style={
            infoGridStyle
          }
        >
          <InfoBox
            title="زبان"
            value="فارسی"
          />

          <InfoBox
            title="جهت نمایش"
            value="راست به چپ"
          />

          <InfoBox
            title="منطقه زمانی"
            value="ایران / تهران"
          />

          <InfoBox
            title="تقویم"
            value="شمسی"
          />

          <InfoBox
            title="قالب ساعت"
            value="۲۴ ساعته"
          />
        </div>
      </Section>


      <Section
        title="داشبورد و نقشه"
        description="تنظیمات پیش‌فرض هنگام ورود کاربران به داشبورد"
      >
        <div
          style={
            twoColumnStyle
          }
        >
          <Field
            label="نوع نقشه پیش‌فرض"
          >
            <select
              value={
                settings.defaultMapMode
              }
              onChange={(
                event
              ) => {
                updateSetting(
                  "defaultMapMode",
                  parseMapMode(
                    event.target.value
                  )
                );
              }}
              style={
                inputStyle
              }
            >
              <option
                value="2d"
              >
                نقشه دوبعدی
              </option>

              <option
                value="3d"
              >
                کره سه‌بعدی
              </option>
            </select>
          </Field>


          <Field
            label="بازه زمانی پیش‌فرض"
          >
            <select
              value={
                settings.defaultTimeRange
              }
              onChange={(
                event
              ) => {
                updateSetting(
                  "defaultTimeRange",
                  parseTimeRange(
                    event.target.value
                  )
                );
              }}
              style={
                inputStyle
              }
            >
              <option
                value="24h"
              >
                ۲۴ ساعت
              </option>

              <option
                value="3d"
              >
                ۳ روز
              </option>

              <option
                value="7d"
              >
                ۷ روز
              </option>

              <option
                value="30d"
              >
                ۳۰ روز
              </option>
            </select>
          </Field>
        </div>


        <div
          style={{
            marginTop: 18,
          }}
        >
          <div
            style={
              subTitleStyle
            }
          >
            لایه‌های فعال پیش‌فرض
          </div>

          <div
            style={
              layersGridStyle
            }
          >
            <CheckBox
              label="درگیری‌ها"
              checked={
                settings.defaultLayers.conflicts
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "conflicts",
                  value
                );
              }}
            />

            <CheckBox
              label="پایگاه‌ها"
              checked={
                settings.defaultLayers.bases
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "bases",
                  value
                );
              }}
            />

            <CheckBox
              label="نقاط حساس"
              checked={
                settings.defaultLayers.hotspots
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "hotspots",
                  value
                );
              }}
            />

            <CheckBox
              label="تأسیسات هسته‌ای"
              checked={
                settings.defaultLayers.nuclear
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "nuclear",
                  value
                );
              }}
            />

            <CheckBox
              label="تحریم‌ها"
              checked={
                settings.defaultLayers.sanctions
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "sanctions",
                  value
                );
              }}
            />

            <CheckBox
              label="آب‌وهوا"
              checked={
                settings.defaultLayers.weather
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "weather",
                  value
                );
              }}
            />

            <CheckBox
              label="هشدارهای کانادا"
              checked={
                settings.defaultLayers.canadaAlerts
              }
              onChange={(
                value
              ) => {
                updateLayer(
                  "canadaAlerts",
                  value
                );
              }}
            />
          </div>
        </div>
      </Section>


      <Section
        title="گزارش‌ها"
        description="تنظیمات سربرگ، اطلاعات همراه و خروجی چاپ/PDF"
      >
        <Field
          label="عنوان سربرگ گزارش"
        >
          <input
            type="text"
            dir="auto"
            value={
              settings.reportHeaderTitle
            }
            onChange={(
              event
            ) => {
              updateSetting(
                "reportHeaderTitle",
                event.target.value
              );
            }}
            style={
              inputStyle
            }
          />
        </Field>


        <Field
          label="نام سازمان در گزارش"
        >
          <input
            type="text"
            dir="auto"
            value={
              settings.reportOrganizationName
            }
            onChange={(
              event
            ) => {
              updateSetting(
                "reportOrganizationName",
                event.target.value
              );
            }}
            style={
              inputStyle
            }
            placeholder="نام سازمان..."
          />
        </Field>


        <div
          style={{
            marginTop: 18,
          }}
        >
          <div
            style={
              subTitleStyle
            }
          >
            اطلاعات قابل نمایش
          </div>

          <div
            style={
              layersGridStyle
            }
          >
            <CheckBox
              label="تاریخ انتشار"
              checked={
                settings.showPublishedDate
              }
              onChange={(
                value
              ) => {
                updateSetting(
                  "showPublishedDate",
                  value
                );
              }}
            />

            <CheckBox
              label="تهیه‌کننده"
              checked={
                settings.showAuthor
              }
              onChange={(
                value
              ) => {
                updateSetting(
                  "showAuthor",
                  value
                );
              }}
            />

            <CheckBox
              label="تحلیل مبنا"
              checked={
                settings.showSourceAnalysis
              }
              onChange={(
                value
              ) => {
                updateSetting(
                  "showSourceAnalysis",
                  value
                );
              }}
            />

            <CheckBox
              label="شواهد و منابع"
              checked={
                settings.showEvidence
              }
              onChange={(
                value
              ) => {
                updateSetting(
                  "showEvidence",
                  value
                );
              }}
            />
          </div>
        </div>


        <div
          style={{
            ...twoColumnStyle,
            marginTop: 18,
          }}
        >
          <Field
            label="سطح طبقه‌بندی پیش‌فرض"
          >
            <select
              value={
                settings.defaultClassification
              }
              onChange={(
                event
              ) => {
                updateSetting(
                  "defaultClassification",
                  parseClassification(
                    event.target.value
                  )
                );
              }}
              style={
                inputStyle
              }
            >
              <option
                value="normal"
              >
                عادی
              </option>

              <option
                value="internal"
              >
                داخلی
              </option>

              <option
                value="confidential"
              >
                محرمانه
              </option>
            </select>
          </Field>


          <Field
            label="قالب چاپ"
          >
            <select
              value={
                settings.printOrientation
              }
              onChange={(
                event
              ) => {
                updateSetting(
                  "printOrientation",
                  parsePrintOrientation(
                    event.target.value
                  )
                );
              }}
              style={
                inputStyle
              }
            >
              <option
                value="portrait"
              >
                A4 عمودی
              </option>

              <option
                value="landscape"
              >
                A4 افقی
              </option>
            </select>
          </Field>
        </div>
      </Section>


      <Section
        title="اطلاعات سامانه"
        description="وضعیت فعلی نسخه در حال اجرا"
      >
        <div
          style={
            infoGridStyle
          }
        >
          <InfoBox
            title="نسخه"
            value="v2.10.0"
          />

          <InfoBox
            title="مخزن بروزرسانی"
            value="BehradNOKIA / rasadyar-padafand"
          />

          <InfoBox
            title="شاخه بروزرسانی"
            value={UPDATE_BRANCH}
          />

          <InfoBox
            title="محیط فعلی"
            value={
              import.meta.env.DEV
                ? "Development"
                : "Production"
            }
          />
        </div>
      </Section>


      {/* =====================================================
          Latest Version — Superadmin only
      ===================================================== */}

      {isSuperAdmin && (
        <Section
          title="مدیریت نسخه سامانه"
          description="دریافت و نصب نسخه جدید فقط توسط مدیر اصلی"
        >
          <div
            style={
              updateCardStyle
            }
          >
            <div
              style={
                updateInfoStyle
              }
            >
              <div
                style={
                  updateTitleStyle
                }
              >
                آخرین ورژن
              </div>

              <div
                style={
                  updateDescriptionStyle
                }
              >
                با اجرای این فرمان، سرور برای دریافت آخرین نسخه شاخه
                {" "}
                <b>{UPDATE_BRANCH}</b>
                {" "}
                از مخزن رسمی رصدیار درخواست بروزرسانی ارسال می‌کند.
              </div>

              <div
                style={
                  repositoryStyle
                }
              >
                {UPDATE_REPOSITORY}
              </div>
            </div>


            <button
              type="button"
              onClick={() => {
                void installLatestVersion();
              }}
              disabled={
                isUpdating
              }
              style={{
                ...updateButtonStyle,

                opacity:
                  isUpdating
                    ? 0.65
                    : 1,

                cursor:
                  isUpdating
                    ? "wait"
                    : "pointer",
              }}
            >
              {isUpdating
                ? "در حال ارسال درخواست..."
                : "آخرین ورژن"}
            </button>
          </div>


          <div
            style={
              updateWarningStyle
            }
          >
            بروزرسانی فقط از مخزن
            {" "}
            <b>BehradNOKIA/rasadyar-padafand</b>
            {" "}
            و شاخه
            {" "}
            <b>main</b>
            {" "}
            انجام می‌شود. اجرای نهایی باید در سمت سرور نیز نقش مدیر اصلی را دوباره بررسی کند.
          </div>


          {updateMessage && (
            <div
              style={
                updateSuccessStyle
              }
            >
              {updateMessage}
            </div>
          )}


          {updateError && (
            <div
              style={
                errorStyle
              }
            >
              {updateError}
            </div>
          )}
        </Section>
      )}


      <div
        style={
          actionBarStyle
        }
      >
        <button
          type="button"
          onClick={
            save
          }
          style={
            primaryButton
          }
        >
          ذخیره تنظیمات
        </button>


        <button
          type="button"
          onClick={
            resetSettings
          }
          style={
            secondaryButton
          }
        >
          بازگردانی پیش‌فرض
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   Components
========================================================= */

function Section(
  props: {
    title: string;
    description?: string;
    children:
      React.ReactNode;
  }
) {

  return (
    <section
      style={
        sectionStyle
      }
    >
      <div
        style={
          sectionHeaderStyle
        }
      >
        <h3
          style={{
            margin: 0,
            fontSize: 17,
          }}
        >
          {props.title}
        </h3>

        {props.description && (
          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              opacity: 0.55,
            }}
          >
            {props.description}
          </div>
        )}
      </div>

      <div
        style={{
          paddingTop: 15,
        }}
      >
        {props.children}
      </div>
    </section>
  );
}


function Field(
  props: {
    label: string;
    children:
      React.ReactNode;
  }
) {

  return (
    <div
      style={
        fieldStyle
      }
    >
      <label
        style={
          labelStyle
        }
      >
        {props.label}
      </label>

      {props.children}
    </div>
  );
}


function CheckBox(
  props: {
    label: string;
    checked: boolean;
    onChange:
      (value: boolean) =>
        void;
  }
) {

  return (
    <label
      style={
        checkStyle
      }
    >
      <input
        type="checkbox"
        checked={
          props.checked
        }
        onChange={(
          event
        ) => {
          props.onChange(
            event.target.checked
          );
        }}
      />

      <span>
        {props.label}
      </span>
    </label>
  );
}


function InfoBox(
  props: {
    title: string;
    value: string;
  }
) {

  return (
    <div
      style={
        infoBoxStyle
      }
    >
      <div
        style={{
          fontSize: 11,
          opacity: 0.5,
          marginBottom: 6,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontWeight: 700,
          overflowWrap: "anywhere",
        }}
      >
        {props.value}
      </div>
    </div>
  );
}


/* =========================================================
   Styles
========================================================= */

const pageStyle:
  React.CSSProperties = {

  padding:
    20,

  color:
    "#fff",

  background:
    "#111",

  minHeight:
    "100%",

  boxSizing:
    "border-box",
};


const headerStyle:
  React.CSSProperties = {

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    15,

  marginBottom:
    20,

  paddingBottom:
    15,

  borderBottom:
    "1px solid #303030",
};


const adminBadgeStyle:
  React.CSSProperties = {

  padding:
    "5px 10px",

  border:
    "1px solid #22c55e",

  borderRadius:
    20,

  color:
    "#86efac",

  fontSize:
    11,
};


const sectionStyle:
  React.CSSProperties = {

  marginBottom:
    18,

  padding:
    16,

  background:
    "#151515",

  border:
    "1px solid #333",

  borderRadius:
    9,
};


const sectionHeaderStyle:
  React.CSSProperties = {

  paddingBottom:
    11,

  borderBottom:
    "1px solid #292929",
};


const fieldStyle:
  React.CSSProperties = {

  marginBottom:
    14,
};


const labelStyle:
  React.CSSProperties = {

  display:
    "block",

  marginBottom:
    6,

  fontSize:
    13,

  opacity:
    0.8,
};


const inputStyle:
  React.CSSProperties = {

  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "10px 12px",

  background:
    "#0d0d0d",

  border:
    "1px solid #3a3a3a",

  borderRadius:
    6,

  color:
    "#fff",

  fontFamily:
    "inherit",
};


const twoColumnStyle:
  React.CSSProperties = {

  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",

  gap:
    14,
};


const layersGridStyle:
  React.CSSProperties = {

  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",

  gap:
    8,
};


const checkStyle:
  React.CSSProperties = {

  display:
    "flex",

  alignItems:
    "center",

  gap:
    8,

  padding:
    "9px 11px",

  background:
    "#101010",

  border:
    "1px solid #333",

  borderRadius:
    6,

  cursor:
    "pointer",

  fontSize:
    13,
};


const subTitleStyle:
  React.CSSProperties = {

  marginBottom:
    10,

  fontWeight:
    700,

  fontSize:
    13,
};


const infoGridStyle:
  React.CSSProperties = {

  display:
    "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(200px, 1fr))",

  gap:
    10,
};


const infoBoxStyle:
  React.CSSProperties = {

  padding:
    12,

  background:
    "#101010",

  border:
    "1px solid #333",

  borderRadius:
    6,
};


const actionBarStyle:
  React.CSSProperties = {

  position:
    "sticky",

  bottom:
    0,

  display:
    "flex",

  gap:
    9,

  flexWrap:
    "wrap",

  padding:
    "14px 0",

  marginTop:
    10,

  background:
    "#111",
};


const primaryButton:
  React.CSSProperties = {

  padding:
    "9px 17px",

  borderRadius:
    6,

  border:
    "1px solid #22c55e",

  background:
    "#14532d",

  color:
    "#fff",

  cursor:
    "pointer",

  fontFamily:
    "inherit",
};


const secondaryButton:
  React.CSSProperties = {

  padding:
    "9px 17px",

  borderRadius:
    6,

  border:
    "1px solid #444",

  background:
    "#222",

  color:
    "#fff",

  cursor:
    "pointer",

  fontFamily:
    "inherit",
};


const successStyle:
  React.CSSProperties = {

  marginBottom:
    15,

  padding:
    11,

  border:
    "1px solid #166534",

  background:
    "#14532d",

  borderRadius:
    6,

  color:
    "#bbf7d0",
};


const errorStyle:
  React.CSSProperties = {

  marginBottom:
    15,

  padding:
    11,

  border:
    "1px solid #7f1d1d",

  background:
    "#450a0a",

  borderRadius:
    6,

  color:
    "#fecaca",
};


const accessDeniedStyle:
  React.CSSProperties = {

  padding:
    20,

  border:
    "1px solid #7f1d1d",

  background:
    "#450a0a",

  borderRadius:
    7,

  color:
    "#fecaca",
};


const updateCardStyle:
  React.CSSProperties = {

  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  gap:
    18,

  flexWrap:
    "wrap",

  padding:
    16,

  background:
    "#0d151f",

  border:
    "1px solid #28445f",

  borderRadius:
    8,
};


const updateInfoStyle:
  React.CSSProperties = {

  flex:
    "1 1 360px",

  minWidth:
    0,
};


const updateTitleStyle:
  React.CSSProperties = {

  fontSize:
    16,

  fontWeight:
    800,

  marginBottom:
    7,

  color:
    "#bfdbfe",
};


const updateDescriptionStyle:
  React.CSSProperties = {

  fontSize:
    12,

  lineHeight:
    1.9,

  color:
    "#cbd5e1",
};


const repositoryStyle:
  React.CSSProperties = {

  marginTop:
    8,

  direction:
    "ltr",

  textAlign:
    "left",

  fontSize:
    11,

  color:
    "#93c5fd",

  overflowWrap:
    "anywhere",
};


const updateButtonStyle:
  React.CSSProperties = {

  minWidth:
    150,

  padding:
    "11px 18px",

  borderRadius:
    7,

  border:
    "1px solid #3b82f6",

  background:
    "#1d4ed8",

  color:
    "#fff",

  fontWeight:
    800,

  fontFamily:
    "inherit",
};


const updateWarningStyle:
  React.CSSProperties = {

  marginTop:
    12,

  padding:
    12,

  background:
    "#2a2110",

  border:
    "1px solid #6b5318",

  borderRadius:
    6,

  fontSize:
    12,

  lineHeight:
    1.9,

  color:
    "#fde68a",
};


const updateSuccessStyle:
  React.CSSProperties = {

  marginTop:
    12,

  padding:
    11,

  border:
    "1px solid #166534",

  background:
    "#14532d",

  borderRadius:
    6,

  color:
    "#bbf7d0",

  lineHeight:
    1.8,
};
