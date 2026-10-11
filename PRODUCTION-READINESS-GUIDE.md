# CrochetNook production-readiness guide

This guide is a practical launch checklist for the current CrochetNook implementation. The shop checkout defaults to manual order requests; customers are not charged by the app. Complete the business, hosting, email, privacy and customer-support steps before accepting real customer details.

For the ordered, task-by-task launch checklist with pass criteria, see [PRODUCTION-MVP-CHECKLIST.md](./PRODUCTION-MVP-CHECKLIST.md). This guide has additional deployment and optional provider setup details.

## Important: current launch blockers

The app is **not ready to accept or route real payments, or issue statutory tax invoices**:

1. Default checkout records manual order requests and does not accept or route payment. Sellers must agree payment and fulfilment directly with customers; the app does not provide payment dispute, reconciliation or seller payout services.
2. The optional Paystack integration is test-only and deliberately restricted to `sk_test_` keys. There is no live-payment mode. Do not replace the test key with a live key and expect it to work; the app rejects live keys.
3. The customer email used by the optional Paystack test flow is a plain-text payment receipt/order confirmation, not a VAT tax invoice. No tax invoice PDF or legal document attachment is generated.
4. Courier Guy request/response handling, especially the tracking response fields and ETA, has not been validated against your live account.
5. Meta, Paystack, SMTP and Courier Guy delivery have not been tested with your real accounts.

Use the manual order-request steps and optional sandbox/test steps below to prove the flow. Before launch, complete the legal review and production testing needed for your business model.

## 1. Prepare the business and customer-facing policies

Do this before you publish the store:

1. Confirm the trading/legal name, business contact details, return/refund policy, fulfilment and collection terms, privacy notice and customer support process for each shop.
2. Ask a South African accountant or tax practitioner which sales document your business must issue for each transaction and what information it must contain. CrochetNook currently sends a payment receipt only. Do not call it a tax invoice or represent it as SARS-compliant.
3. If you need VAT invoices, collect and verify the appropriate seller identity, address, registration and VAT information, and agree on invoice numbering, line-item treatment, tax display, corrections/refunds and retention with your practitioner. Invoice templates/PDFs and VAT fields are not implemented yet.
4. Review POPIA responsibilities with a suitable adviser: which party is responsible for buyer data, why it is collected, retention/deletion, access controls, processor agreements, breach handling and cross-border providers. Do not put secrets, card data or unnecessary personal information in notification templates or logs.
5. Keep records of the buyer's WhatsApp opt-in. The app records the checkout consent and timestamp. Make sure your privacy notice explains the messages and how a buyer can withdraw consent; the current checkout tells the buyer to contact the shop to opt out.

## 2. Create and protect the production environment

### 2.1 Choose hosting and a public domain

1. Choose a host for the Node.js app and PostgreSQL. A managed PostgreSQL provider is preferable to the development database settings in the included Compose file.
   Production startup now fails without `DATABASE_URL` or `NEON_DATABASE_URL`; do not run a public shop on the in-memory development fallback.
2. Configure a stable public HTTPS hostname, for example `https://shop.yourdomain.co.za`, and route it to the app. Set DNS, TLS certificates, renewal and health monitoring.
3. If using shop-specific custom domains, configure DNS and TLS for each domain and ensure the hosting/reverse proxy routes those hostnames to CrochetNook.
4. Set the production `APP_URL` to the canonical public app URL. It is used to build auth links and Paystack return URLs. Do not include a trailing slash.
5. Configure the hosting proxy so HTTPS is preserved to the app. Test login cookies, password-reset links and the Paystack return URL through the public HTTPS hostname, not only on localhost.

### 2.2 Set environment variables

For Docker Compose, add the applicable values to the ignored local `.env` file. For another host, set the same values in that host's secret/environment-variable manager. Never commit `.env`, paste secrets into source code, or expose server secrets in client-side variables.

```dotenv
# Required for a stable production login/session signing key.
SESSION_SECRET=<long-random-secret>

# Canonical public HTTPS URL, without a trailing slash.
APP_URL=https://your-public-app-domain

# Stable encryption keys: generate once, securely back up, and do not rotate casually.
COURIERGUY_ENCRYPTION_KEY=<64-hex-character-key>
SHOP_SECRETS_ENCRYPTION_KEY=<separate-64-hex-character-key>

# Default shop checkout: manual order requests; no customer payment is collected online.
SHOP_PAYMENT_MODE=manual

# Optional: explicitly opt into the Paystack test-only checkout.
# SHOP_PAYMENT_MODE=paystack_test
PAYSTACK_SECRET_KEY=sk_test_<test-secret>

# SMTP: production email delivery requires a working mail provider.
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password>
SMTP_SECURE=false
MAIL_FROM="CrochetNook <orders@your-verified-domain>"

# Optional defaults.
COURIERGUY_AWS_REGION=eu-west-1
WHATSAPP_GRAPH_API_VERSION=v23.0
```

Generate random values locally, for example:

```sh
openssl rand -hex 32
```

Run it separately for each encryption key. `COURIERGUY_ENCRYPTION_KEY` must remain exactly the same as the key already used to encrypt saved Courier Guy credentials. Keep both encryption keys in a secure password manager/secret vault with a controlled backup. Losing a key makes the credentials encrypted with that key unreadable.

Notes:

- The Compose file passes through `SESSION_SECRET`, `APP_URL`, SMTP settings and provider keys from `.env`. It has development fallbacks; replace the sample session secret and localhost URL for production.
- The Compose database still uses simple development credentials in its service configuration. Do **not** expose this setup as-is to the public internet. Prefer managed PostgreSQL; otherwise change the database credentials and app connection string together, keep the database on a private network, and apply a firewall.
- `DATABASE_URL` is supplied by the app's Compose configuration for its internal database service. For a managed database, configure the host's `DATABASE_URL`/`NEON_DATABASE_URL` and TLS settings instead.
- `SMTP_HOST` can be left unset while developing; in production a missing SMTP configuration means queued emails fail and retry rather than being delivered.
- Courier Guy and WhatsApp credentials are configured centrally by the platform admin in **Admin**. Keep only the encryption keys in the root `.env`; do not put provider account tokens there.

After setting deployment environment values and confirming your database choice, the Compose-based staging deployment can be rebuilt with:

```sh
docker compose up -d --build
docker compose logs -f app
```

Do not use this Compose database configuration for a public production launch until its default database credentials and connection settings have been replaced and verified, or the app is configured to use a properly secured managed database.

### 2.3 Database, migrations and backups

1. Before upgrading an existing installation, take a database backup and test that you can restore it.
2. Deploy the app with the current migrations, including `drizzle/0009_manual_order_requests.sql`. Runtime startup also creates/adds the current shop/order/notification tables and columns.
3. Docker's `/docker-entrypoint-initdb.d` scripts only initialize a new empty Postgres data directory. They do not replay all migration files into an already initialized volume. Do not delete a volume to force migrations; that can destroy customer/order data.
4. Verify that shops, products, orders, image bytes, and queued notifications survive an app restart and a database backup/restore.
5. Set automated encrypted backups and a retention policy. Restrict database credentials and production access to named operators.

## 3. Configure and test email

1. Choose an SMTP service that allows your verified sending domain and production volume.
2. Verify your sending domain with the provider and publish the DNS records it requests (typically SPF/DKIM and, where applicable, DMARC). Use the provider's current instructions rather than copying records from another domain.
3. Put the SMTP host, port, username, password, TLS setting and verified `MAIL_FROM` address in production environment settings.
4. Deploy and trigger a password-reset email using a test account. Confirm it arrives, links back to the correct HTTPS host and is not rewritten to localhost.
5. Submit a manual shop order request and verify that the customer acknowledgement and shop alert are queued and sent. If you also test `SHOP_PAYMENT_MODE=paystack_test`, verify the separate plain-text payment receipt. Trigger a pickup reminder in a controlled test and verify email delivery.
6. Check the mail provider's bounce, spam, suppression and delivery logs. A successful SMTP handoff is not proof that an email reached the inbox.

Until a mail provider is configured, reset emails and one-time codes work only as development console output, and production order emails are not delivered.

## 4. Shop orders and payment mode

The default `SHOP_PAYMENT_MODE=manual` is the MVP path. A customer submits an order request; the app records it and displays an order reference. The app takes no payment, does not store seller bank details, does not quote shipping, and does not book Courier Guy shipments for these orders. The shop owner contacts the customer directly to confirm product availability, the final shipping cost, payment arrangements and fulfilment. The owner may mark the order paid only after checking their own payment records, or cancel the request. This is an internal seller confirmation, not a Paystack-verified transaction.

An email acknowledgement to the customer and an email alert to the shop contact are queued when the request is submitted. Configure and verify production SMTP, and monitor failed notification jobs; the app has no notification delivery dashboard. Orders remain visible in the owner Shop → Orders view if email delivery fails. Manual mode is not a marketplace payout system and the platform must not collect, hold or promise to route customer funds.

To switch to the existing Paystack **test** setup for development/testing only, set `SHOP_PAYMENT_MODE=paystack_test` and configure `PAYSTACK_SECRET_KEY` with a test key. Restart the app after changing the variable. Live payments are not implemented; never set a live key or use this switch for production charges. A future live integration requires Paystack approval for the platform model, legal/accounting review, a purpose-built implementation, provider acceptance tests and a separate rollout.

### Optional: test Paystack

Official references: [Accept payments](https://paystack.com/docs/payments/accept-payments/), [verify payments](https://paystack.com/docs/payments/verify-payments/) and [webhooks](https://paystack.com/docs/payments/webhooks/).

1. Create/verify the Paystack merchant account and complete the business/KYC steps Paystack requires for the account.
2. In Paystack's test environment/dashboard, copy the **test secret key** (starts `sk_test_`) into `PAYSTACK_SECRET_KEY`. Store it only on the server. Never use a `pk_test_` public key here.
3. In the Paystack dashboard, add the public HTTPS webhook endpoint:

   ```text
   https://your-public-app-domain/api/paystack/webhook
   ```

4. Deploy to the public HTTPS host. Confirm that requests to the webhook reach the app and the host forwards the raw request body unchanged. The app validates the Paystack HMAC signature and then independently calls Paystack's transaction verification API.
5. Complete an end-to-end test purchase. Confirm the browser returns to the right `/store/<slug>` page, the order reference is retained, the server verifies successful status, amount, currency and reference, and only then the order becomes paid.
6. Test an abandoned/failed payment, a duplicate webhook delivery and a return-page verification. Confirm there is no shipment booking for an unpaid order and duplicate success events do not duplicate receipts.
7. Confirm the shop order view shows the paid order and the customer receipt is sent.
8. Live payments are not supported. Do not take real money through the app or change the test key to a live key.

The test integration charges ZAR using integer minor units and sends customers to Paystack-hosted checkout. Never mark an order paid based only on the browser redirect.

## 5. Set up Courier Guy delivery and lockers

The project's [Courier Guy integration notes](./CourierGuyAPI.md) and supplied [`tcg.postman_collection.json`](./tcg.postman_collection.json) are the implementation references. Courier Guy's actual API permissions, rate availability and account setup must be confirmed with Courier Guy.

1. Contact Courier Guy and arrange the account/merchant onboarding needed for API access, address delivery and locker/pickup-point delivery. Ask specifically for the production Accounts API access key and secret and the expected API region/settings.
2. Keep those provider credentials private. Sign in as the platform administrator, open **Admin → Shared integrations**, and enter the Courier Guy access key and secret. They are encrypted in the database using `COURIERGUY_ENCRYPTION_KEY`.
3. Fill in the shop's collection/origin address, contact name, sender email and phone. Enable the appropriate Courier Guy address and/or locker fulfilment option. Save the settings.
4. For every published item that may be shipped, maintain realistic packaged length, width, height and weight. The app uses these product-level values to request a rate and builds a parcel per item unit. Validate the final packed parcel sizes/weight and any combined-order limits against Courier Guy's rules.
5. In manual mode, test address delivery and locker selection from the public storefront. These are saved as preferences only; no rate request or payment is made. If validating the Paystack test-only flow, separately verify pickup-point search, rates, the selected service, the paid order's saved address/locker, and total amount against Courier Guy and Paystack.
6. Use a Courier Guy test/sandbox account or an approved low-risk test process to create a shipment **only for a paid order**. The shop owner chooses a future collection date and time window at booking; verify that Courier Guy accepts the window and that the resulting response includes a tracking reference.
7. Check the app's order page for the shipment reference and poll result. Compare Courier Guy's raw account tracking page/API response with the status/ETA displayed by the app. Tracking field names and ETA availability need verification against your actual account; there is no documented webhook in the supplied collection, so the app polls about every 30 minutes.
8. Test a real delivered/terminal status before relying on automatic tracking updates. Customers receive an update only if they consented to WhatsApp at checkout.

Shipment creation is a seller action after payment; checkout does not book a courier automatically. For locker orders, the shipment destination is the selected locker, and owner reminders tell the seller to prepare that parcel. Confirm how Courier Guy expects locker drop-off/collection and service-level selection for your account.

## 6. Set up the shared WhatsApp Cloud API integration

Official starting point: [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/). Meta's dashboard and current documentation are authoritative; UI and permissions can change.

1. The platform administrator creates/uses a Meta business portfolio and developer app with the WhatsApp use case, and connects the WhatsApp Business Account and shared sending phone number.
2. Complete Meta business verification, phone-number registration, display-name checks, and any app review/permissions that Meta requires for the intended production setup. Do not rely on the temporary test token for production.
3. Create a long-lived/system-user access token with the current WhatsApp messaging permission required by Meta. Protect it like a password.
4. Create and submit the templates needed for the flows you will enable. Configure the approved names and language in **Admin → Shared integrations**. Current parameters are:
   - Manual order request (5): shop, reference, item summary, product subtotal, fulfilment preference.
   - Manual order status update (3): shop, reference, status.
   - Paystack test receipt (5): shop, reference, item summary, total, delivery.
   - Courier tracking update (4): order reference, shipment status, estimated delivery (or “Not provided by Courier Guy yet”), latest courier scan/event.
   - Courier pickup reminder (5): shop, order reference, South African pickup date/time window, item summary, preparation instruction.
   Templates must be approved in the connected WhatsApp Business Account and language. Keep them transactional and consistent with buyer consent and WhatsApp policy.
5. In **Admin → Shared integrations**, enter the Meta phone number ID, long-lived access token, Meta app secret, webhook verify token and approved template names/language. Save. Secret values are encrypted in the database and are not returned to the browser.
6. Configure the callback URL shown on the Admin page in Meta and subscribe to the `messages` webhook field. Meta verifies the webhook using the configured verify token; incoming webhook POST requests are checked with the app-secret signature.
7. In **Admin → Owner WhatsApp numbers**, assign a unique international-format WhatsApp number to each shop account that should receive the owner menu. South African local numbers beginning with `0` are converted to country code `27`. Unassigned numbers receive the customer menu.
8. Submit a manual order request from a test storefront. Explicitly tick WhatsApp consent to test the buyer notification. From the mapped owner number, review pending requests, then test confirming a manually received payment and cancelling a request. Test customer reference lookup from the customer's saved phone number.
9. For optional Paystack/Courier Guy test integrations, test receipt, pickup and tracking templates separately. Test bad/expired tokens, unapproved or wrong-language templates, bad recipient numbers and Meta rate/quality errors. Correct configuration and inspect server logs/notification records before launch.

The platform uses one shared WhatsApp sending number, while owner identities are mapped to distinct incoming WhatsApp numbers. Buyer updates are opt-in; the bot only returns order details when the incoming number matches the customer's phone saved on that order. The owner menu can mark a manual payment received or cancel a pending request; owners must check their own payment records first.

## 7. Test the full order lifecycle

Use a test shop and test buyer addresses/numbers. Do not use real customer data during integration testing.

1. Publish one test product with an accurate price.
2. In default manual mode, submit collection and delivery order requests. Confirm no Paystack or Courier Guy rate request is made, shipping is labelled as to-be-confirmed, no payment is taken, and the customer sees the request reference and accurate next steps.
3. Confirm customer and shop emails arrive through SMTP. Simulate SMTP failure; confirm the order remains visible to the owner and failed jobs are logged/retried.
4. In the owner Shop → Orders view, confirm a request is marked paid only after a real offline payment has been checked, and confirm cancellation works. Verify the public order status reflects the shop's action.
5. Confirm manual-mode shipping is arranged directly by the shop and customer; the app must not show or invoke Courier Guy shipment booking for a manual order.
6. If explicitly testing Paystack, switch `SHOP_PAYMENT_MODE=paystack_test`, configure only test credentials, and follow the Paystack test steps above.
7. Test provider outages, failed/repeated test webhooks (only in Paystack test mode) and app/database restarts. Confirm queued notifications remain persisted and retry.
8. Test shop tenant isolation: one owner cannot see another shop's orders, credentials, buyer addresses, messages or product data.
9. Verify returns, cancellations, delivery exceptions and buyer support manually. The current app does not automate the full refund/return or shipment-cancellation lifecycle.

## 8. Production operations and monitoring

Before launch, assign an operator to:

- monitor application, database and SMTP errors; monitor Paystack, Courier Guy and Meta only if those test/optional flows are enabled;
- review queued/failed notification jobs and retries in the database/logs (there is no notification-delivery dashboard yet);
- check backups and periodically test a restore;
- renew HTTPS certificates and rotate access only through a planned secret migration;
- restrict production access, require strong unique owner passwords and protect staff accounts;
- set up provider alerting for Paystack transaction/webhook failures, SMTP bounces, Courier Guy shipment exceptions and WhatsApp template/token/quality problems;
- establish customer support, order reconciliation and manual fallback procedures.

The current email/WhatsApp worker runs inside the application process. The notification queue is persisted and retried, but production monitoring/recovery controls and a dedicated background worker/queue service are not yet provided. Test restart/retry behavior on the actual host and do not rely on reminders until their delivery is observable.

## 9. Go-live decision checklist

Do not enable a public launch until every applicable item is checked:

- [ ] Production domain, HTTPS, hosting proxy and correct `APP_URL` tested.
- [ ] Unique production `SESSION_SECRET`; no development placeholder values.
- [ ] Production database isolated from public access, backed up, restorable and using non-default credentials.
- [ ] App configured with a persistent production PostgreSQL connection; in-memory storage is not used.
- [ ] Production migrations applied without deleting any database volume/data.
- [ ] Both encryption keys recorded securely; existing Courier Guy key preserved.
- [ ] SMTP/domain authentication tested; manual order acknowledgement and owner alert delivered and failed notifications observable.
- [ ] Manual order request, owner payment confirmation, cancellation and direct fulfilment instructions tested.
- [ ] Paystack test flow and webhook signature, verification, duplicates and failed payments tested only if `SHOP_PAYMENT_MODE=paystack_test` is enabled.
- [ ] Live payments are not available. Do not collect customer funds through the app until an approved live-payment design is implemented and separately reviewed.
- [ ] Courier Guy rates, shipment booking, collection window, locker handling, tracking and ETA tested with the actual account.
- [ ] Each shop has the intended production WhatsApp number/token and approved exact-language templates.
- [ ] Buyer opt-in, order confirmation, tracking update and owner reminders tested end to end.
- [ ] Tax/documentation requirements reviewed with a South African tax practitioner; VAT invoice generation added if needed.
- [ ] Privacy notice, POPIA process, store terms, returns/refunds and customer support ready.
- [ ] Monitoring, failed-notification review, backups and manual fulfilment fallback assigned to an owner.

## Provider documentation

- [Paystack Accept Payments](https://paystack.com/docs/payments/accept-payments/)
- [Paystack Verify Payments](https://paystack.com/docs/payments/verify-payments/)
- [Paystack Webhooks](https://paystack.com/docs/payments/webhooks/)
- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/)
- [Courier Guy integration notes in this repo](./CourierGuyAPI.md)
- [Courier Guy collection supplied for this project](./tcg.postman_collection.json)
