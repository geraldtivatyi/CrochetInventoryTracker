# CrochetNook

A full-stack inventory and pricing management application for a crochet business. The project helps track yarn stock, estimate project costs, manage business activity, and calculate profitable pricing in South African Rand (ZAR).

## Why this project
This application was built to solve a real operational problem: running a handmade craft business requires fast, accurate inventory visibility and reliable pricing decisions. I wanted a tool that could centralize inventory, project planning, and pricing calculations while keeping the workflow simple enough to use in a busy business setting.

## Core features
- Dashboard with business overview and low-stock alerts
- Inventory management for yarn records, colors, costs, and stock quantity
- Project templates with yarn requirements and estimated completion times
- Pricing calculator with labor, materials, and markup logic
- Activity tracking for operational visibility
- Persistent PostgreSQL storage via Drizzle ORM

## Tech stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Backend: Express.js, TypeScript
- Database: PostgreSQL with Drizzle ORM
- State management: TanStack Query
- Validation: React Hook Form + Zod

## AI-assisted development note
This project was developed with AI as an efficiency amplifier rather than a replacement for engineering judgment. AI was especially useful for:
- scaffolding and project setup
- accelerating debugging and error diagnosis
- improving development speed around TypeScript, build configuration, and backend integration
- suggesting refactors and clarifying implementation options

I used AI to speed up infrastructure setup and debugging workflows, but I made the final product decisions and manually implemented the features, data model changes, UI updates, validation logic, and business rules. The project reflects my own engineering work, not a purely generated result.

## Manual implementation and ownership
The features in this app were not simply accepted from generated output. I manually built and refined:
- the inventory CRUD flows
- the pricing and markup calculations
- dashboard logic and activity tracking
- project-related workflows and navigation
- validation and UX improvements
- persistence and database integration

## Project highlights
- Migrated from in-memory storage to PostgreSQL for real persistence
- Updated pricing logic to South African Rand formatting and business assumptions
- Added project-specific yarn color integration and improved calculation workflows
- Improved the app’s UX through validation and UI refinement

## Local development
```bash
npm install
npm run dev
```

## Notes for interview use
This project demonstrates a practical full-stack workflow: translating a business need into a working product, connecting frontend and backend systems, handling data persistence, and iterating quickly through debugging and feature refinement. It also highlights a mature mindset around AI usage: using it to increase velocity while still taking ownership of architecture, implementation, and product quality.

For additional context on how AI was used in this project, see [AI_DEVELOPMENT_NOTES.md](AI_DEVELOPMENT_NOTES.md).
## Authentication
- Sign in/out, forgotten password and reset (emailed link, valid 1 hour), and optional email one-time-code (OTP) two-step verification (enable/disable under **Settings**).
- On first run (no users) the sign-in page lets you create the owner account; after that it is disabled.
- All `/api` routes except `/api/auth/*` require a session.

Environment variables:

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Required in production. Long random string. |
| `APP_URL` | Public URL used in reset links (e.g. `https://app.example.com`). `https://` enables secure cookies. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` | Email server. In development, if `SMTP_HOST` is unset, emails are printed to the server console; production delivery requires SMTP. |
| `MAIL_FROM` | Sender, e.g. `CrochetNook <no-reply@yourdomain.com>` |
| `SHOP_SECRETS_ENCRYPTION_KEY` | Stable 64-character hex key used to encrypt tenant WhatsApp credentials. Falls back to `COURIERGUY_ENCRYPTION_KEY` if unset. |
| `WHATSAPP_GRAPH_API_VERSION` | Meta Graph API version used for WhatsApp Cloud API messages; defaults to `v23.0`. |

Tables are created automatically on startup; `drizzle/0001_auth.sql` is provided for manual setup.

## Multi-tenant shops and Courier Guy
- See [PRODUCTION-READINESS-GUIDE.md](./PRODUCTION-READINESS-GUIDE.md) for the step-by-step production deployment, Paystack test, Courier Guy, WhatsApp, email, privacy and go-live checklist.
- Each signed-in account owns an isolated shop profile, catalogue, fulfilment settings, sender details and Courier Guy credentials.
- Shop owners can publish a public catalogue at `/store/<slug>` and optionally configure a custom hostname. The hostname needs DNS/TLS routing to this app.
- Shop owners can add a branding image and choose a theme color; both are shown on the live public shop. Branding images use the same JPEG, PNG, WebP or GIF formats, 5 MiB limit and database-backed storage as product images.
- Product images can be selected from a computer or phone and are stored in PostgreSQL as `bytea` (JPEG, PNG, WebP or GIF; maximum 5 MiB per image). Image bytes are served by a tenant-scoped image endpoint and are not included in product JSON. This is an interim storage adapter; the same upload boundary can later be backed by S3.
- Checkout supports a basket, collection, Courier Guy address delivery and locker delivery, Paystack-hosted test payments, server-side callback/webhook payment verification and saved orders. Courier Guy delivery quotes use package dimensions and weight stored per product; locker search uses the buyer's browser location.
- Shop owners can review orders and explicitly create a Courier Guy shipment for a paid courier order. Creating a shipment submits a booking to Courier Guy; it is not done automatically when the customer pays.
- After payment is verified, the customer receives an email payment receipt/order confirmation. This initial receipt is **not a VAT tax invoice**; configure a registered seller's and VAT details and obtain tax advice before treating later invoice support as a compliant tax invoice.
- Shops can connect their own Meta WhatsApp Cloud API phone number under **Shop setup**. They enter a phone number ID, access token, approved template names and template language; access tokens are encrypted at rest and never returned to the browser. Customer WhatsApp updates are sent only when the customer opts in at checkout. Meta-approved templates are required for order confirmations, shipment updates and pickup reminders.
- After a paid Courier Guy shipment is booked, the shop owner chooses a collection date/time window. The app sends owner email and WhatsApp reminders 24 hours and 2 hours before that window (when those channels are configured). Customer shipment status and estimated-delivery updates are polled from Courier Guy about every 30 minutes and sent by WhatsApp when the buyer opted in. Courier Guy's tracking response fields and estimate availability vary by account/service; an estimate is only sent when the API returns one.
- Set `PAYSTACK_SECRET_KEY` to a Paystack **test secret key** (`sk_test_...`) for test checkout. CrochetNook rejects live keys so testing cannot collect real payments. Use Paystack's test card details from its dashboard/docs; never put the key in client-side code. Without this setting checkout is unavailable. Configure the Paystack test webhook to call `https://<your-app>/api/paystack/webhook`.
- Courier Guy checkout requires the shop owner to configure Courier Guy credentials, origin/sender information and product package dimensions. Set `COURIERGUY_ENCRYPTION_KEY` to a stable 64-character hexadecimal key before saving credentials; do not rotate or lose the key without first re-entering every shop's credentials. See [CourierGuyAPI.md](./CourierGuyAPI.md) and [tcg.postman_collection.json](./tcg.postman_collection.json).

Shop tables are created automatically on startup; `drizzle/0002_shop_shipping.sql` through `drizzle/0006_order_notifications.sql` are provided for manual setup.
For Docker Compose, generate stable 64-hex-character keys with `openssl rand -hex 32`. Keep the existing `COURIERGUY_ENCRYPTION_KEY` unchanged so saved Courier Guy credentials remain decryptable; set `SHOP_SECRETS_ENCRYPTION_KEY=<generated-key>` for WhatsApp secrets in the ignored local `.env` file, then rebuild/restart the app. Keep secure backups; losing or changing either key makes credentials encrypted with it unreadable.

Each shop owner must configure a Meta WhatsApp Business phone number ID, long-lived/system-user token and the names/language of templates approved in that WhatsApp Business account. Test credentials and template approval with Meta before enabling real notifications. Buyers must explicitly consent to WhatsApp messages in checkout.

For Paystack test payments, copy the **test secret key** from the Paystack dashboard's API Keys & Webhooks settings into `PAYSTACK_SECRET_KEY`. Docker Compose reads it from the ignored local `.env` file; when running `npm run dev` directly, export it in the shell before starting the app. Checkout uses ZAR amounts and returns to the shop after payment so the server can verify the transaction directly with Paystack before marking the order paid. Do not use a live key: this initial integration is deliberately test-only.

The dashboard uses saved inventory, project-template, pricing-calculation and activity records. New installations and the no-database development fallback are no longer populated with sample records. Existing sample records in an already initialized database are preserved; review them in Inventory, Projects and Activity before removing anything.

Inventory, Projects and Calculator pages likewise read and write their saved API records. Project templates do not display invented price estimates; price calculations use the selected inventory costs and the hourly rate and markup entered for that calculation. Calculations are saved when submitted and listed on the Calculator page.
