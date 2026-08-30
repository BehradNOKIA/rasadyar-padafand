import React, { useState } from "react";

import { useAuth } from "./AuthProvider";
import { updateUser } from "./userStore";

function getRoleLabel(role: string): string {
  switch (role) {
    case "superadmin":
      return "مدیر اصلی";

    case "admin":
      return "مدیر";

    case "analyst":
      return "تحلیلگر";

    case "viewer":
      return "مشاهده‌گر";

    default:
      return role || "-";
  }
}

export default function ProfileEditor() {
  const auth = useAuth();

  const user = auth?.user;

  const [name, setName] = useState(
    user?.name || ""
  );

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  if (!user) {
    return (
      <div
        dir="rtl"
        style={{
          padding: 20,
          color: "#fff",
        }}
      >
        خطای احراز هویت
      </div>
    );
  }

  const canEditProfile =
    auth.hasPermission(
      "profile.edit"
    );

  const saveProfile = async () => {
    setMessage("");
    setError("");

    if (!canEditProfile) {
      setError(
        "شما اجازه ویرایش این پروفایل را ندارید."
      );

      return;
    }

    const cleanName =
      name.trim();

    if (!cleanName) {
      setError(
        "نام نمایشی نمی‌تواند خالی باشد."
      );

      return;
    }

    try {
      /*
       * بروزرسانی کاربر در لیست کاربران
       */
      const users =
        await updateUser(
          user.username,
          {
            name: cleanName,
          }
        );

      /*
       * بروزرسانی کاربر جاری با نسخه تاییدشده سمت سرور
       */
      const updatedUser =
        users.find(
          (candidate) =>
            candidate.username ===
            user.username
        ) ?? {
          ...user,
          name: cleanName,
        };

      auth.login(
        updatedUser
      );

      setMessage(
        "نام نمایشی با موفقیت تغییر کرد."
      );

      /*
       * چون Header فعلی DOM-based است،
       * با Reload نام جدید فوراً در سربرگ
       * نمایش داده می‌شود.
       */
      window.setTimeout(
        () => {
          window.location.reload();
        },
        500
      );
    } catch (err) {
      console.error(
        "Profile update failed:",
        err
      );

      setError(
        "خطا در ذخیره تغییرات پروفایل."
      );
    }
  };

  return (
    <div
      dir="rtl"
      style={{
        padding: 20,
        color: "#fff",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 8,
        }}
      >
        ویرایش پروفایل
      </h2>

      <div
        style={{
          opacity: 0.6,
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        اطلاعات نمایشی حساب کاربری
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          نام نمایشی
        </label>

        <input
          type="text"
          dir="auto"
          value={name}
          onChange={(event) =>
            setName(
              event.target.value
            )
          }
          style={inputStyle}
          placeholder="نام نمایشی..."
          autoFocus
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          نام کاربری
        </label>

        <input
          type="text"
          value={user.username}
          disabled
          style={{
            ...inputStyle,
            opacity: 0.55,
            cursor: "not-allowed",
          }}
        />

        <div style={helpStyle}>
          نام کاربری از این بخش قابل تغییر نیست.
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          نقش
        </label>

        <input
          type="text"
          value={getRoleLabel(
            user.role
          )}
          disabled
          style={{
            ...inputStyle,
            opacity: 0.55,
            cursor: "not-allowed",
          }}
        />

        <div style={helpStyle}>
          کاربر نمی‌تواند نقش خودش را تغییر دهد.
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 15,
            padding: 10,
            border:
              "1px solid #7f1d1d",
            background: "#450a0a",
            borderRadius: 6,
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: 15,
            padding: 10,
            border:
              "1px solid #166534",
            background: "#14532d",
            borderRadius: 6,
            color: "#bbf7d0",
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          paddingTop: 18,
          borderTop:
            "1px solid #333",
        }}
      >
        <button
          type="button"
          onClick={
            saveProfile
          }
          disabled={!canEditProfile}
          style={{
            padding:
              "9px 18px",
            borderRadius: 6,
            border:
              "1px solid #22c55e",
            background: "#14532d",
            color: "#fff",
            cursor: canEditProfile
              ? "pointer"
              : "not-allowed",
            fontFamily:
              "inherit",
            opacity: canEditProfile
              ? 1
              : 0.5,
          }}
        >
          ذخیره تغییرات
        </button>
      </div>
    </div>
  );
}

const fieldStyle:
  React.CSSProperties = {
  marginBottom: 18,
};

const labelStyle:
  React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontSize: 13,
};

const inputStyle:
  React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 6,
  border:
    "1px solid #3a3a3a",
  background: "#0d0d0d",
  color: "#fff",
  fontFamily: "inherit",
};

const helpStyle:
  React.CSSProperties = {
  marginTop: 5,
  fontSize: 11,
  opacity: 0.5,
};