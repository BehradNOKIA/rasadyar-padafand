/**
 * Legacy compatibility bridge.
 *
 * The old implementation edited rasadyar_users directly in localStorage and
 * therefore could persist plaintext passwords. It is intentionally retired.
 * All user management now goes through the secure server-backed React panel.
 */
export function openUserManagement(): void {
  window.dispatchEvent(
    new CustomEvent("rasadyar:open-user-management")
  );
}
