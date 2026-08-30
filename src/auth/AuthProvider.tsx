import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { can, hasAny } from './accessControl';
import type { RasadyarPermission } from './permissions';

import {
  getCurrentUser,
  logoutUser,
  refreshCurrentUser,
  setCurrentUser,
  type RasadyarStoredUser,
} from './userStore';

export type RasadyarAuthUser =
  RasadyarStoredUser;

interface AuthContextValue {
  user: RasadyarAuthUser | null;

  /**
   * Updates only the non-sensitive UI profile cache.
   * The authenticated session itself is created on the server.
   */
  login: (userData: RasadyarAuthUser) => void;

  /** Revokes the HttpOnly server session and clears the UI profile cache. */
  logout: () => Promise<void>;

  /** Revalidates the server session and refreshes the public profile. */
  refreshUser: () => Promise<void>;

  hasPermission: (
    permission: RasadyarPermission,
  ) => boolean;

  hasAnyPermission: (
    permissions: readonly RasadyarPermission[],
  ) => boolean;
}

const AuthContext =
  createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  /*
   * role-panel-manager mounts each panel in its own React root.
   * Start from the sanitized UI profile cache so the panel can
   * render immediately, then revalidate against the server session.
   */
  const [user, setUser] =
    useState<RasadyarAuthUser | null>(
      () => getCurrentUser(),
    );

  const login =
    useCallback(
      (userData: RasadyarAuthUser) => {
        setCurrentUser(userData);

        setUser(
          getCurrentUser(),
        );
      },
      [],
    );

  const logout =
    useCallback(async () => {
      await logoutUser();

      setUser(null);
    }, []);

  const refreshUser =
    useCallback(async () => {
      try {
        const serverUser =
          await refreshCurrentUser();

        setUser(
          serverUser,
        );
      } catch (error) {
        console.error(
          'Unable to refresh Rasadyar secure session:',
          error,
        );

        /*
         * Keep only the already-sanitized display cache during a
         * transient server/network failure.
         *
         * Protected backend actions still require the real session.
         */
        setUser(
          getCurrentUser(),
        );
      }
    }, []);

  useEffect(() => {
    void refreshUser();

    const onAuthChanged =
      () => {
        /*
         * Synchronize the independent role-panel React roots
         * immediately with the current sanitized profile.
         */
        setUser(
          getCurrentUser(),
        );

        /*
         * Then obtain the canonical profile from the server.
         */
        void refreshUser();
      };

    window.addEventListener(
      'rasadyar:auth-changed',
      onAuthChanged,
    );

    return () => {
      window.removeEventListener(
        'rasadyar:auth-changed',
        onAuthChanged,
      );
    };
  }, [refreshUser]);

  const hasPermission =
    useCallback(
      (
        permission:
          RasadyarPermission,
      ) =>
        can(
          user,
          permission,
        ),
      [user],
    );

  const hasAnyPermission =
    useCallback(
      (
        permissions:
          readonly RasadyarPermission[],
      ) =>
        hasAny(
          user,
          permissions,
        ),
      [user],
    );

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        login,
        logout,
        refreshUser,
        hasPermission,
        hasAnyPermission,
      }),
      [
        user,
        login,
        logout,
        refreshUser,
        hasPermission,
        hasAnyPermission,
      ],
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}
