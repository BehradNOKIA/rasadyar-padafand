import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { authenticate } from "./userStore";
import { useAuth } from "./AuthProvider";

export default function Login() {
  const { login } = useAuth();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const submit = useCallback(async () => {
    const cleanUsername =
      username.trim();

    if (
      !cleanUsername ||
      !password
    ) {
      setError(
        "نام کاربری و رمز عبور را وارد کنید."
      );

      return;
    }

    try {
      const user =
        await authenticate(
          cleanUsername,
          password
        );

      if (user) {
        setError("");
        login(user);
        return;
      }

      setError(
        "نام کاربری یا رمز عبور اشتباه است."
      );
    } catch (err) {
      console.error(
        "Login failed:",
        err
      );

      setError(
        "خطا در ارتباط با سرویس احراز هویت."
      );
    }
  }, [
    username,
    password,
    login,
  ]);

  /*
   * گرفتن Enter در سطح Window
   * با capture=true تا Handlerهای
   * عمومی داشبورد جلوی آن را نگیرند.
   */
  useEffect(() => {
    const handleEnter = (
      event: KeyboardEvent
    ) => {
      if (
        event.key !== "Enter" ||
        event.isComposing
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      void submit();
    };

    window.addEventListener(
      "keydown",
      handleEnter,
      true
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleEnter,
        true
      );
    };
  }, [submit]);

  return (
    <div
      dir="rtl"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#080808",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 40,
          background: "#111",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxSizing: "border-box",
        }}
      >
        <h2
          style={{
            color: "#fff",
            margin: "0 0 12px",
          }}
        >
          ورود به رصدیار پدافند
        </h2>

        <input
          type="text"
          placeholder="نام کاربری"
          value={username}
          onChange={(event) =>
            setUsername(
              event.target.value
            )
          }
          autoComplete="username"
          autoFocus
          style={{
            padding: 13,
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />

        <input
          type="password"
          placeholder="رمز عبور"
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          autoComplete="current-password"
          style={{
            padding: 13,
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />

        {error && (
          <div
            style={{
              color: "#f87171",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{
            padding: 13,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
          }}
        >
          ورود
        </button>
      </form>
    </div>
  );
}