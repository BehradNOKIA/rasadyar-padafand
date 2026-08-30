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


export type SystemSettingsData = {
  /* عمومی */

  systemName: string;

  systemSubtitle: string;

  organizationName: string;


  /* زبان و زمان */

  language: "fa";

  direction: "rtl";

  timezone: string;

  calendar: "jalali";

  hourFormat: "24";


  /* داشبورد */

  defaultView: "global";

  defaultMapMode: MapMode;

  defaultTimeRange: TimeRange;


  /* لایه‌ها */

  defaultLayers:
    DefaultLayers;


  /* گزارش‌ها */

  reportHeaderTitle: string;

  reportOrganizationName: string;

  showPublishedDate: boolean;

  showAuthor: boolean;

  showSourceAnalysis: boolean;

  showEvidence: boolean;

  defaultClassification:
    Classification;

  printOrientation:
    PrintOrientation;
};


/* =========================================================
   Defaults
========================================================= */

export const DEFAULT_SYSTEM_SETTINGS:
  SystemSettingsData = {

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
   Value Parsers
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


  /* ---------------------------------------------------------
     Auto clear success message
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

          دسترسی به تنظیمات سامانه
          فقط برای مدیر اصلی مجاز است.

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

      {/* =====================================================
          Header
      ===================================================== */}

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


      {/* =====================================================
          Messages
      ===================================================== */}

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


      {/* =====================================================
          General
      ===================================================== */}

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


      {/* =====================================================
          Language / Time
      ===================================================== */}

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


      {/* =====================================================
          Dashboard
      ===================================================== */}

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


      {/* =====================================================
          Reports
      ===================================================== */}

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


      {/* =====================================================
          System Information
      ===================================================== */}

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
            title="نوع ذخیره‌سازی"

            value="Local Storage"
          />


          <InfoBox
            title="محیط فعلی"

            value={
              import.meta.env.DEV
                ? "Development"
                : "Production"
            }
          />


          <InfoBox
            title="Backend"

            value="هنوز متصل نشده"
          />

        </div>


        <div
          style={
            futureWarningStyle
          }
        >

          تنظیمات امنیتی، سیاست رمز عبور،
          ثبت فعالیت کاربران، پشتیبان‌گیری
          و مدیریت APIها پس از اتصال
          Backend فعال خواهند شد.

        </div>

      </Section>


      {/* =====================================================
          Actions
      ===================================================== */}

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
   Section
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


/* =========================================================
   Field
========================================================= */

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


/* =========================================================
   Checkbox
========================================================= */

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


/* =========================================================
   Info Box
========================================================= */

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
    "repeat(2, minmax(0, 1fr))",

  gap:
    14,
};


const layersGridStyle:
  React.CSSProperties = {

  display:
    "grid",

  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",

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
    "repeat(2, minmax(0, 1fr))",

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


const futureWarningStyle:
  React.CSSProperties = {

  marginTop:
    15,

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