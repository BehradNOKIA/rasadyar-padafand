import React from "react";


export default function GlobalMonitoringPanel() {

  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        color: "#ffffff",
        fontFamily:
          "Vazirmatn, Tahoma, Arial, sans-serif",
      }}
    >

      <div
        style={{
          background: "#181818",
          borderRadius: "12px",
          padding: "18px",
          marginBottom: "16px",
          border: "1px solid #333",
        }}
      >
        <h3>
          مرکز پایش جهانی
        </h3>

        <p>
          پایش وضعیت محیط جهانی، رخدادها و شاخص‌های ریسک
        </p>
      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, 1fr)",
          gap: "12px",
        }}
      >

        <div
          style={{
            background: "#202020",
            padding: "16px",
            borderRadius: "10px",
          }}
        >
          <b>
            سطح ریسک جهانی
          </b>

          <div>
            متوسط
          </div>
        </div>


        <div
          style={{
            background: "#202020",
            padding: "16px",
            borderRadius: "10px",
          }}
        >
          <b>
            رخدادهای فعال
          </b>

          <div>
            ۱۲ مورد
          </div>
        </div>


        <div
          style={{
            background: "#202020",
            padding: "16px",
            borderRadius: "10px",
          }}
        >
          <b>
            مناطق تحت پایش
          </b>

          <div>
            جهانی
          </div>
        </div>

      </div>


      <div
        style={{
          marginTop: "16px",
          background: "#181818",
          padding: "18px",
          borderRadius: "12px",
          border: "1px solid #333",
        }}
      >

        <h4>
          رخدادهای اخیر
        </h4>

        <ul>
          <li>
            پایش رخدادهای امنیتی جهانی
          </li>

          <li>
            بررسی اختلالات زیرساختی
          </li>

          <li>
            تحلیل روندهای محیطی
          </li>
        </ul>

      </div>


    </div>
  );
}