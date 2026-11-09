# TijaraGO Platform Control

Staff-only operations dashboard for monitoring the entire commerce platform. This application is separate from the merchant dashboard and authenticates only with Django staff/superuser accounts.

## Local development

Start the backend on HTTPS port 8001, then run from the `design-stock` root:

```bash
npm run dev:platform-admin
```

Open `https://<your-local-ip>:5180`. The Vite server proxies `/backend` to Django on the same machine. Set `VITE_API_URL` only when Django is running elsewhere.

Create an operator account if needed:

```bash
./venv/bin/python manage.py createsuperuser
```

The command above runs from `platform-server`, not `design-stock`.

## Browser tests

The pricing editor has Playwright coverage for real browser interaction, clean
capability PATCH payloads, successful saves, and backend validation failures.
Install Chromium once, then run the suite from the `design-stock` root:

```bash
npx playwright install chromium
npm run test:platform-admin:e2e
```

Use Node 20 or newer, as required by the repository. The suite mocks the staff
session and pricing API in the browser; it does not read or modify the local or
production database. It also runs as part of `npm run quality`.

## Production

Set `VITE_API_URL` to the public Django API URL. Add the deployed control-room origin to the backend's `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` configuration. Keep this app on a private operator domain and do not share staff accounts with merchants.

## Monitored areas

- platform growth, gross volume, realized revenue and commerce trends;
- stores, owners, retail models, catalog depth and deployment state;
- platform staff, merchants and customers;
- orders, fulfillment, payment state and stock exceptions;
- payment-provider transactions and failures;
- Vercel storefront deployments and bounded failure diagnostics;
- database health, provider configuration and catalog integrity.

The initial release is intentionally read-only. Future platform-wide mutations should use separate permissions, confirmations, and immutable audit events.
