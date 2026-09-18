RASADYAR AUTH DOCKER ROUTE FIX
==============================

Root causes confirmed on the production container:

1) /app/api/rasadyar-auth.js exports:
     default = object

   but local-api-server.mjs requires:
     typeof mod.default === 'function'

2) The frontend calls:
     /api/rasadyar-auth/login
     /api/rasadyar-auth/me
     ...

   while the sidecar filesystem router maps the flat file:
     api/rasadyar-auth.js
   only to:
     /api/rasadyar-auth

   The sidecar natively supports catch-all routes named `[...path].js`.

Fix:
- Change api/rasadyar-auth.ts default export from `{ fetch() {} }` to an async function.
- Make routeParts() understand the pathname suffix as well as legacy ?path=.
- Add api/rasadyar-auth/[...path].ts that re-exports the canonical handler.

No change is required to:
- Dockerfile
- docker-compose.yml
- Nginx
- src/auth/userStore.ts
- Redis auth storage

WINDOWS APPLY
-------------

From repository root, copy the patch there and run:

  git apply --check .\rasadyar-auth-docker-route-fix.patch
  git apply .\rasadyar-auth-docker-route-fix.patch

Then:

  git status --short
  npm.cmd ci
  npx.cmd tsc --noEmit
  npx.cmd vite build

Expected changed files:
  M  api/rasadyar-auth.ts
  ?? api/rasadyar-auth/[...path].ts

Commit:
  git add api/rasadyar-auth.ts "api/rasadyar-auth/[...path].ts"
  git commit -m "fix: support Rasadyar auth routes in Docker sidecar"
  git push origin main

VPS AFTER PUSH
--------------

  cd /opt/rasadyar-padafand
  git pull
  docker compose build --no-cache worldmonitor
  docker compose up -d
  docker compose ps

Test route:

  curl -i \
    -X POST \
    http://127.0.0.1:3000/api/rasadyar-auth/login \
    -H 'Content-Type: application/json' \
    --data '{"username":"__test__","password":"__test__"}'

A 401 invalid-credentials is GOOD at this stage: it proves routing and handler
loading are fixed. A 200 means the supplied credentials are valid.

After routing is fixed, configure HTTPS before relying on the login session,
because the session cookie is Secure.
