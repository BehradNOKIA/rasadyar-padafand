/**
 * Catch-all route for Rasadyar authentication sub-resources.
 *
 * The Docker/Tauri local API sidecar uses filesystem routing and supports
 * `[...path]` handlers. Re-exporting the canonical handler keeps one auth
 * implementation while allowing routes such as:
 *
 *   /api/rasadyar-auth/login
 *   /api/rasadyar-auth/logout
 *   /api/rasadyar-auth/me
 *   /api/rasadyar-auth/users/...
 *
 * The canonical handler derives the sub-route from the request pathname and
 * still accepts the legacy `?path=` form for compatibility.
 */
export { default } from '../rasadyar-auth';
