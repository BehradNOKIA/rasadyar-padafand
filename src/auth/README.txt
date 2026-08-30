Rasadyar auth TypeScript fix
=============================

Replace these files in src/auth/:
- authorization.ts
- AuthProvider.tsx
- Login.tsx
- ProfileEditor.tsx
- role-panel-manager.ts
- userStore.ts

Targeted fixes:
1. RBAC permission/user types aligned with accessControl.ts.
2. RasadyarAuthUser now reuses RasadyarStoredUser, making username/name/role required.
3. Login now awaits server-side authenticate().
4. Profile update now awaits the server response before updating the UI cache.
5. Unused default React imports removed where applicable.
6. PanelErrorBoundary children made optional for React 19 createElement typing.
7. userStore.hasPermission input aligned with RasadyarAccessUser.

No plaintext password storage was reintroduced.
