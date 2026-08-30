import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addUser,
  deleteUser,
  getUsers,
  resetUserPassword,
  setUserActive,
  updateUser,
  type RasadyarStoredUser,
} from "./userStore";

import {
  useAuth,
} from "./AuthProvider";

type ManagedRole =
  | "analyst"
  | "viewer";

type PasswordResetState = {
  username: string;
  name: string;
} | null;

function roleLabel(
  role: string
): string {
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
      return role;
  }
}

function getErrorMessage(
  error: unknown,
  fallback:
    string
): string {
  const code =
    error instanceof Error
      ? error.message
      : "";

  switch (code) {
    case "duplicate":
      return "این نام کاربری قبلاً وجود دارد.";

    case "weak-password":
      return "رمز عبور باید حداقل ۸ نویسه باشد.";

    case "invalid-username":
      return "نام کاربری معتبر وارد کنید.";

    case "invalid-name":
      return "نام و نام خانوادگی را وارد کنید.";

    case "invalid-role":
      return "نقش انتخاب‌شده معتبر نیست.";

    case "protected-superadmin":
      return "حساب مدیر اصلی قابل تغییر یا حذف نیست.";

    case "protected-admin":
      return "این حساب مدیریتی فقط توسط مدیر اصلی قابل تغییر است.";

    case "cannot-delete-current-user":
      return "امکان حذف حساب کاربری جاری وجود ندارد.";

    case "not-found":
      return "کاربر موردنظر پیدا نشد.";

    default:
      return fallback;
  }
}

export default function UserManagement() {
  const auth =
    useAuth();

  const [
    users,
    setUsers,
  ] =
    useState<
      RasadyarStoredUser[]
    >([]);

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    username,
    setUsername,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    role,
    setRole,
  ] =
    useState<ManagedRole>(
      "viewer"
    );

  const [
    showCreatePassword,
    setShowCreatePassword,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    isError,
    setIsError,
  ] =
    useState(false);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    resetTarget,
    setResetTarget,
  ] =
    useState<PasswordResetState>(
      null
    );

  const [
    resetPassword,
    setResetPassword,
  ] =
    useState("");

  const [
    showResetPassword,
    setShowResetPassword,
  ] =
    useState(false);


  const refreshUsers =
    async () => {
      try {
        setUsers(
          await getUsers()
        );
      } catch (
        error
      ) {
        console.error(
          "getUsers error:",
          error
        );

        setMessage(
          "خطا در بارگذاری فهرست کاربران."
        );

        setIsError(true);
      }
    };


  useEffect(
    () => {
      void refreshUsers();
    },
    []
  );


  if (!auth) {
    return (
      <div
        dir="rtl"
        style={{
          padding:
            20,
          color:
            "#fff",
        }}
      >
        خطای احراز هویت
      </div>
    );
  }


  const currentUser =
    auth.user;

  const canManageUsers =
    auth.hasPermission(
      "users.manage"
    );

  const canCreateUsers =
    auth.hasPermission(
      "users.create"
    );

  const canEditUsers =
    auth.hasPermission(
      "users.edit"
    );

  const canDeleteUsers =
    auth.hasPermission(
      "users.delete"
    );


  if (
    !canManageUsers
  ) {
    return (
      <div
        dir="rtl"
        style={{
          padding:
            20,
          color:
            "#fff",
        }}
      >
        دسترسی غیرمجاز
      </div>
    );
  }


  const filteredUsers =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLocaleLowerCase(
              "fa"
            );

        if (!query) {
          return users;
        }

        return users.filter(
          (user) =>
            `${user.name} ${user.username} ${roleLabel(
              String(
                user.role
              )
            )}`
              .toLocaleLowerCase(
                "fa"
              )
              .includes(
                query
              )
        );
      },
      [
        users,
        search,
      ]
    );


  const announce =
    (
      text:
        string,
      error = false
    ) => {
      setMessage(
        text
      );

      setIsError(
        error
      );
    };


  const handleCreateUser =
    async (
      event:
        React.FormEvent
    ) => {
      event.preventDefault();

      announce("");

      if (
        !canCreateUsers
      ) {
        announce(
          "شما مجوز ایجاد کاربر ندارید.",
          true
        );

        return;
      }

      try {
        await addUser({
          name:
            name.trim(),

          username:
            username.trim(),

          password,

          role,
        });

        setName("");
        setUsername("");
        setPassword("");
        setRole(
          "viewer"
        );

        await refreshUsers();

        announce(
          "کاربر با موفقیت ایجاد شد و اکنون می‌تواند با نام کاربری و رمز عبور تعیین‌شده وارد سامانه شود."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        announce(
          getErrorMessage(
            error,
            "خطا در ایجاد کاربر."
          ),
          true
        );
      }
    };


  const handleDelete =
    async (
      target:
        RasadyarStoredUser
    ) => {
      announce("");

      if (
        !canDeleteUsers
      ) {
        announce(
          "شما مجوز حذف کاربر ندارید.",
          true
        );

        return;
      }

      if (
        target.role ===
        "superadmin"
      ) {
        announce(
          "مدیر اصلی قابل حذف نیست.",
          true
        );

        return;
      }

      if (
        target.username ===
        currentUser?.username
      ) {
        announce(
          "امکان حذف حساب کاربری جاری وجود ندارد.",
          true
        );

        return;
      }

      const confirmed =
        window.confirm(
          `آیا از حذف کاربر «${target.name || target.username}» مطمئن هستید؟`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        await deleteUser(
          target.username,
          currentUser?.username
        );

        await refreshUsers();

        announce(
          "کاربر با موفقیت حذف شد."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        announce(
          getErrorMessage(
            error,
            "خطا در حذف کاربر."
          ),
          true
        );
      }
    };


  const handleRoleChange =
    async (
      target:
        RasadyarStoredUser,
      newRole:
        ManagedRole
    ) => {
      announce("");

      if (
        !canEditUsers
      ) {
        announce(
          "شما مجوز تغییر نقش کاربران را ندارید.",
          true
        );

        return;
      }

      if (
        target.role ===
        "superadmin"
      ) {
        announce(
          "نقش مدیر اصلی قابل تغییر نیست.",
          true
        );

        return;
      }

      try {
        await updateUser(
          target.username,
          {
            role:
              newRole,
          }
        );

        await refreshUsers();

        announce(
          `نقش کاربر به «${roleLabel(newRole)}» تغییر کرد.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        announce(
          getErrorMessage(
            error,
            "خطا در تغییر نقش کاربر."
          ),
          true
        );
      }
    };


  const handleActiveChange =
    async (
      target:
        RasadyarStoredUser,
      active:
        boolean
    ) => {
      announce("");

      if (
        !canEditUsers
      ) {
        announce(
          "شما مجوز تغییر وضعیت کاربران را ندارید.",
          true
        );

        return;
      }

      if (
        target.role ===
        "superadmin"
      ) {
        announce(
          "مدیر اصلی قابل غیرفعال‌سازی نیست.",
          true
        );

        return;
      }

      try {
        await setUserActive(
          target.username,
          active
        );

        await refreshUsers();

        announce(
          active
            ? "حساب کاربر فعال شد."
            : "حساب کاربر غیرفعال شد."
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        announce(
          getErrorMessage(
            error,
            "خطا در تغییر وضعیت کاربر."
          ),
          true
        );
      }
    };


  const openResetPassword =
    (
      target:
        RasadyarStoredUser
    ) => {
      announce("");

      if (
        !canEditUsers
      ) {
        announce(
          "شما مجوز بازنشانی رمز عبور را ندارید.",
          true
        );

        return;
      }

      if (
        target.role ===
        "superadmin"
      ) {
        announce(
          "رمز عبور مدیر اصلی از این بخش تغییر نمی‌کند.",
          true
        );

        return;
      }

      setResetTarget({
        username:
          target.username,

        name:
          target.name ||
          target.username,
      });

      setResetPassword("");
      setShowResetPassword(
        false
      );
    };


  const closeResetPassword =
    () => {
      setResetTarget(
        null
      );

      setResetPassword("");
      setShowResetPassword(
        false
      );
    };


  const submitResetPassword =
    async (
      event:
        React.FormEvent
    ) => {
      event.preventDefault();

      if (
        !resetTarget
      ) {
        return;
      }

      try {
        await resetUserPassword(
          resetTarget.username,
          resetPassword
        );

        await refreshUsers();

        const targetName =
          resetTarget.name;

        closeResetPassword();

        announce(
          `رمز عبور «${targetName}» با موفقیت بازنشانی شد.`
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        announce(
          getErrorMessage(
            error,
            "خطا در بازنشانی رمز عبور."
          ),
          true
        );
      }
    };


  return (
    <div
      dir="rtl"
      style={{
        padding:
          "4px 2px 24px",

        color:
          "#fff",

        minHeight:
          "100%",

        boxSizing:
          "border-box",

        fontFamily:
          '"Vazirmatn Variable", "Vazirmatn", Tahoma, Arial, sans-serif',
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "flex-start",

          justifyContent:
            "space-between",

          gap:
            "12px",

          marginBottom:
            "16px",
        }}
      >
        <div>
          <h2
            style={{
              margin:
                0,

              fontSize:
                "18px",

              fontWeight:
                800,
            }}
          >
            مدیریت کاربران
          </h2>

          <div
            style={{
              marginTop:
                "6px",

              color:
                "rgba(220,240,230,.52)",

              fontSize:
                "11px",

              lineHeight:
                1.8,
            }}
          >
            ایجاد حساب، تعیین نقش، فعال‌سازی، بازنشانی رمز عبور و حذف کاربران
          </div>
        </div>

        <div
          style={{
            padding:
              "5px 9px",

            border:
              "1px solid rgba(52,211,153,.15)",

            borderRadius:
              "999px",

            color:
              "rgba(167,243,208,.82)",

            background:
              "rgba(52,211,153,.045)",

            fontSize:
              "10px",

            whiteSpace:
              "nowrap",
          }}
        >
          {users.length} کاربر
        </div>
      </div>


      <form
        onSubmit={
          handleCreateUser
        }
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",

          gap:
            "10px",

          padding:
            "14px",

          marginBottom:
            "14px",

          border:
            "1px solid rgba(52,211,153,.12)",

          borderRadius:
            "10px",

          background:
            "rgba(5,24,16,.56)",
        }}
      >
        <input
          value={
            name
          }
          onChange={
            (event) =>
              setName(
                event.target.value
              )
          }
          placeholder=
            "نام و نام خانوادگی"
          autoComplete=
            "off"
          style={
            inputStyle
          }
        />

        <input
          value={
            username
          }
          onChange={
            (event) =>
              setUsername(
                event.target.value
              )
          }
          placeholder=
            "نام کاربری"
          autoCapitalize=
            "none"
          autoCorrect=
            "off"
          spellCheck=
            {false}
          style={
            inputStyle
          }
        />

        <div
          style={{
            position:
              "relative",
          }}
        >
          <input
            type={
              showCreatePassword
                ? "text"
                : "password"
            }
            value={
              password
            }
            onChange={
              (event) =>
                setPassword(
                  event.target.value
                )
            }
            placeholder=
              "رمز عبور — حداقل ۸ نویسه"
            autoComplete=
              "new-password"
            style={{
              ...inputStyle,
              width:
                "100%",
              paddingLeft:
                "76px",
            }}
          />

          <button
            type=
              "button"
            onClick={
              () =>
                setShowCreatePassword(
                  (value) =>
                    !value
                )
            }
            style={
              inlinePasswordButtonStyle
            }
          >
            {showCreatePassword
              ? "مخفی"
              : "نمایش"}
          </button>
        </div>

        <select
          value={
            role
          }
          onChange={
            (event) =>
              setRole(
                event.target.value === "analyst"
                  ? "analyst"
                  : "viewer"
              )
          }
          style={
            inputStyle
          }
        >
          <option
            value=
              "viewer"
          >
            مشاهده‌گر
          </option>

          <option
            value=
              "analyst"
          >
            تحلیلگر
          </option>
        </select>

        <button
          type=
            "submit"
          disabled={
            !canCreateUsers
          }
          style={{
            gridColumn:
              "1 / -1",

            minHeight:
              "40px",

            borderRadius:
              "8px",

            border:
              "1px solid rgba(52,211,153,.42)",

            background:
              "#0b6a3a",

            color:
              "#fff",

            fontFamily:
              "inherit",

            fontSize:
              "12px",

            fontWeight:
              700,

            cursor:
              canCreateUsers
                ? "pointer"
                : "not-allowed",

            opacity:
              canCreateUsers
                ? 1
                : .5,
          }}
        >
          ایجاد کاربر جدید
        </button>
      </form>


      {message && (
        <div
          role=
            "status"
          style={{
            padding:
              "9px 11px",

            marginBottom:
              "14px",

            border:
              isError
                ? "1px solid rgba(248,113,113,.28)"
                : "1px solid rgba(52,211,153,.18)",

            borderRadius:
              "8px",

            background:
              isError
                ? "rgba(127,29,29,.18)"
                : "rgba(52,211,153,.045)",

            color:
              isError
                ? "#fecaca"
                : "rgba(209,250,229,.86)",

            fontSize:
              "11px",

            lineHeight:
              1.8,
          }}
        >
          {message}
        </div>
      )}


      <div
        style={{
          marginBottom:
            "10px",
        }}
      >
        <input
          type=
            "search"
          value={
            search
          }
          onChange={
            (event) =>
              setSearch(
                event.target.value
              )
          }
          placeholder=
            "جستجو در کاربران..."
          style={{
            ...inputStyle,
            width:
              "100%",
          }}
        />
      </div>


      <div
        style={{
          overflowX:
            "auto",

          border:
            "1px solid rgba(52,211,153,.11)",

          borderRadius:
            "10px",

          background:
            "rgba(2,12,8,.46)",
        }}
      >
        <table
          style={{
            width:
              "100%",

            minWidth:
              "680px",

            borderCollapse:
              "collapse",
          }}
        >
          <thead>
            <tr>
              <th
                style={
                  cellStyle
                }
              >
                نام
              </th>

              <th
                style={
                  cellStyle
                }
              >
                نام کاربری
              </th>

              <th
                style={
                  cellStyle
                }
              >
                نقش
              </th>

              <th
                style={
                  cellStyle
                }
              >
                وضعیت
              </th>

              <th
                style={
                  cellStyle
                }
              >
                عملیات
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredUsers.map(
              (user) => {
                const protectedAdmin =
                  user.role ===
                  "superadmin";

                return (
                  <tr
                    key={
                      user.username
                    }
                  >
                    <td
                      style={
                        cellStyle
                      }
                    >
                      <div
                        style={{
                          fontWeight:
                            650,
                        }}
                      >
                        {user.name ||
                          "—"}
                      </div>

                      {user.username ===
                        currentUser?.username && (
                        <small
                          style={{
                            color:
                              "rgba(110,231,183,.62)",
                          }}
                        >
                          حساب جاری
                        </small>
                      )}
                    </td>

                    <td
                      style={{
                        ...cellStyle,

                        direction:
                          "ltr",

                        textAlign:
                          "left",
                      }}
                    >
                      {user.username}
                    </td>

                    <td
                      style={
                        cellStyle
                      }
                    >
                      {protectedAdmin
                        ? (
                          <span
                            style={
                              adminBadgeStyle
                            }
                          >
                            مدیر اصلی
                          </span>
                        )
                        : (
                          <select
                            value={
                              user.role
                            }
                            disabled={
                              !canEditUsers
                            }
                            onChange={
                              (event) =>
                                handleRoleChange(
                                  user,
                                  event.target.value === "analyst"
                                    ? "analyst"
                                    : "viewer"
                                )
                            }
                            style={
                              smallInputStyle
                            }
                          >
                            <option
                              value=
                                "viewer"
                            >
                              مشاهده‌گر
                            </option>

                            <option
                              value=
                                "analyst"
                            >
                              تحلیلگر
                            </option>
                          </select>
                        )}
                    </td>

                    <td
                      style={
                        cellStyle
                      }
                    >
                      {protectedAdmin
                        ? (
                          <span
                            style={{
                              color:
                                "#86efac",
                            }}
                          >
                            فعال
                          </span>
                        )
                        : (
                          <label
                            style={{
                              display:
                                "inline-flex",

                              alignItems:
                                "center",

                              gap:
                                "7px",

                              cursor:
                                canEditUsers
                                  ? "pointer"
                                  : "default",
                            }}
                          >
                            <input
                              type=
                                "checkbox"
                              checked={
                                user.active !==
                                false
                              }
                              disabled={
                                !canEditUsers
                              }
                              onChange={
                                (event) =>
                                  handleActiveChange(
                                    user,
                                    event.target.checked
                                  )
                              }
                            />

                            <span>
                              {user.active !==
                              false
                                ? "فعال"
                                : "غیرفعال"}
                            </span>
                          </label>
                        )}
                    </td>

                    <td
                      style={
                        cellStyle
                      }
                    >
                      {protectedAdmin
                        ? (
                          <span
                            style={{
                              color:
                                "rgba(220,238,229,.34)",

                              fontSize:
                                "10px",
                            }}
                          >
                            حساب محافظت‌شده
                          </span>
                        )
                        : (
                          <div
                            style={{
                              display:
                                "flex",

                              gap:
                                "7px",

                              flexWrap:
                                "wrap",
                            }}
                          >
                            <button
                              type=
                                "button"
                              disabled={
                                !canEditUsers
                              }
                              onClick={
                                () =>
                                  openResetPassword(
                                    user
                                  )
                              }
                              style={
                                neutralActionStyle
                              }
                            >
                              بازنشانی رمز
                            </button>

                            <button
                              type=
                                "button"
                              disabled={
                                !canDeleteUsers
                              }
                              onClick={
                                () =>
                                  handleDelete(
                                    user
                                  )
                              }
                              style={
                                dangerActionStyle
                              }
                            >
                              حذف
                            </button>
                          </div>
                        )}
                    </td>
                  </tr>
                );
              }
            )}

            {filteredUsers.length ===
              0 && (
              <tr>
                <td
                  colSpan={
                    5
                  }
                  style={{
                    ...cellStyle,
                    textAlign:
                      "center",
                    color:
                      "rgba(220,238,229,.40)",
                    padding:
                      "26px 10px",
                  }}
                >
                  کاربری یافت نشد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {resetTarget && (
        <div
          role=
            "dialog"
          aria-modal=
            "true"
          aria-label=
            "بازنشانی رمز عبور"
          style={
            modalOverlayStyle
          }
          onMouseDown={
            (event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeResetPassword();
              }
            }
          }
        >
          <form
            onSubmit={
              submitResetPassword
            }
            style={
              modalCardStyle
            }
          >
            <h3
              style={{
                margin:
                  "0 0 6px",

                fontSize:
                  "15px",
              }}
            >
              بازنشانی رمز عبور
            </h3>

            <div
              style={{
                marginBottom:
                  "14px",

                color:
                  "rgba(220,238,229,.54)",

                fontSize:
                  "11px",

                lineHeight:
                  1.8,
              }}
            >
              کاربر:
              {" "}
              <strong>
                {resetTarget.name}
              </strong>
              {" "}
              ({resetTarget.username})
            </div>

            <div
              style={{
                position:
                  "relative",
              }}
            >
              <input
                autoFocus
                type={
                  showResetPassword
                    ? "text"
                    : "password"
                }
                value={
                  resetPassword
                }
                onChange={
                  (event) =>
                    setResetPassword(
                      event.target.value
                    )
                }
                placeholder=
                  "رمز عبور جدید — حداقل ۸ نویسه"
                autoComplete=
                  "new-password"
                style={{
                  ...inputStyle,
                  width:
                    "100%",
                  paddingLeft:
                    "76px",
                }}
              />

              <button
                type=
                  "button"
                onClick={
                  () =>
                    setShowResetPassword(
                      (value) =>
                        !value
                    )
                }
                style={
                  inlinePasswordButtonStyle
                }
              >
                {showResetPassword
                  ? "مخفی"
                  : "نمایش"}
              </button>
            </div>

            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "flex-end",

                gap:
                  "8px",

                marginTop:
                  "14px",
              }}
            >
              <button
                type=
                  "button"
                onClick={
                  closeResetPassword
                }
                style={
                  neutralActionStyle
                }
              >
                انصراف
              </button>

              <button
                type=
                  "submit"
                style={
                  confirmActionStyle
                }
              >
                ثبت رمز جدید
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


const inputStyle:
  React.CSSProperties = {
  boxSizing:
    "border-box",

  minHeight:
    "40px",

  background:
    "rgba(3,13,9,.84)",

  color:
    "#fff",

  border:
    "1px solid rgba(52,211,153,.14)",

  padding:
    "9px 10px",

  borderRadius:
    "7px",

  outline:
    "none",

  fontFamily:
    "inherit",
};


const smallInputStyle:
  React.CSSProperties = {
  minHeight:
    "32px",

  background:
    "#08140e",

  color:
    "#fff",

  border:
    "1px solid rgba(52,211,153,.15)",

  padding:
    "5px 7px",

  borderRadius:
    "6px",

  fontFamily:
    "inherit",
};


const cellStyle:
  React.CSSProperties = {
  padding:
    "10px",

  borderBottom:
    "1px solid rgba(52,211,153,.08)",

  textAlign:
    "right",

  verticalAlign:
    "middle",

  fontSize:
    "11px",
};


const adminBadgeStyle:
  React.CSSProperties = {
  display:
    "inline-flex",

  padding:
    "4px 8px",

  border:
    "1px solid rgba(52,211,153,.18)",

  borderRadius:
    "999px",

  background:
    "rgba(52,211,153,.055)",

  color:
    "#a7f3d0",

  fontSize:
    "10px",

  fontWeight:
    700,
};


const neutralActionStyle:
  React.CSSProperties = {
  minHeight:
    "31px",

  padding:
    "0 9px",

  border:
    "1px solid rgba(148,163,184,.22)",

  borderRadius:
    "6px",

  background:
    "rgba(30,41,59,.28)",

  color:
    "#e2e8f0",

  fontFamily:
    "inherit",

  fontSize:
    "10px",

  cursor:
    "pointer",
};


const dangerActionStyle:
  React.CSSProperties = {
  ...neutralActionStyle,

  border:
    "1px solid rgba(248,113,113,.28)",

  background:
    "rgba(127,29,29,.22)",

  color:
    "#fecaca",
};


const confirmActionStyle:
  React.CSSProperties = {
  ...neutralActionStyle,

  border:
    "1px solid rgba(52,211,153,.34)",

  background:
    "#0b6a3a",

  color:
    "#ffffff",

  fontWeight:
    700,
};


const inlinePasswordButtonStyle:
  React.CSSProperties = {
  position:
    "absolute",

  left:
    "7px",

  top:
    "50%",

  transform:
    "translateY(-50%)",

  minHeight:
    "27px",

  padding:
    "0 8px",

  border:
    "1px solid rgba(148,163,184,.18)",

  borderRadius:
    "5px",

  background:
    "rgba(15,23,42,.48)",

  color:
    "rgba(226,232,240,.76)",

  fontFamily:
    "inherit",

  fontSize:
    "9px",

  cursor:
    "pointer",
};


const modalOverlayStyle:
  React.CSSProperties = {
  position:
    "fixed",

  inset:
    0,

  zIndex:
    2147482000,

  display:
    "grid",

  placeItems:
    "center",

  padding:
    "20px",

  background:
    "rgba(0,0,0,.64)",

  backdropFilter:
    "blur(5px)",
};


const modalCardStyle:
  React.CSSProperties = {
  width:
    "min(430px, 100%)",

  boxSizing:
    "border-box",

  padding:
    "18px",

  border:
    "1px solid rgba(52,211,153,.18)",

  borderRadius:
    "11px",

  background:
    "#07100c",

  boxShadow:
    "0 22px 55px rgba(0,0,0,.42)",
};
