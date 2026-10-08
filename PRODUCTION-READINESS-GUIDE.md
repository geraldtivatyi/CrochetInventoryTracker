# CrochetNook production-readiness guide

This guide is a practical launch checklist for the current CrochetNook implementation. Complete the business, hosting, email, payment, courier and messaging steps in order, and test each provider using sandbox/test credentials before accepting real customers.

## Important: current launch blockers

The app is **not ready to accept real payments or issue statutory tax invoices yet**:

1. Paystack integration is deliberately restricted to `sk_test_` keys. There is no live-payment mode. Do not replace the test key with a live key and expect it to work; the app rejects live keys.
2. The customer email is a plain-text payment receipt/order confirmation, not a VAT tax invoice. No tax invoice PDF or legal document attachment is generated.
3. Courier Guy request/response handling, especially the tracking response fields and ETA, has not been validated against your live account.
4. Meta, Paystack, SMTP and Courier Guy delivery have not been tested with your real accounts.

Use the sandbox/test steps below to prove the flow. Before launch, plan the code, legal review and production testing needed to remove each blocker.

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

# Paystack: test key only until the app's live mode is implemented.
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
- No Courier Guy or WhatsApp provider account token belongs in this root `.env`; those are configured per shop in **Shop setup**.

After setting deployment environment values and confirming your database choice, the Compose-based staging deployment can be rebuilt with:

```sh
docker compose up -d --build
docker compose logs -f app
```

Do not use this Compose database configuration for a public production launch until its default database credentials and connection settings have been replaced and verified, or the app is configured to use a properly secured managed database.

### 2.3 Database, migrations and backups

1. Before upgrading an existing installation, take a database backup and test that you can restore it.
2. Deploy the app with the `drizzle/0006_order_notifications.sql` migration included. Runtime startup also creates/adds the current shop/order/notification tables and columns.
3. Docker's `/docker-entrypoint-initdb.d` scripts only initialize a new empty Postgres data directory. They do not replay all migration files into an already initialized volume. Do not delete a volume to force migrations; that can destroy customer/order data.
4. Verify that shops, products, orders, image bytes, and queued notifications survive an app restart and a database backup/restore.
5. Set automated encrypted backups and a retention policy. Restrict database credentials and production access to named operators.

## 3. Configure and test email

1. Choose an SMTP service that allows your verified sending domain and production volume.
2. Verify your sending domain with the provider and publish the DNS records it requests (typically SPF/DKIM and, where applicable, DMARC). Use the provider's current instructions rather than copying records from another domain.
3. Put the SMTP host, port, username, password, TLS setting and verified `MAIL_FROM` address in production environment settings.
4. Deploy and trigger a password-reset email using a test account. Confirm it arrives, links back to the correct HTTPS host and is not rewritten to localhost.
5. Make a test shop order and verify that a successful payment queues and sends the plain-text receipt. Trigger a pickup reminder in a controlled test and verify email delivery.
6. Check the mail provider's bounce, spam, suppression and delivery logs. A successful SMTP handoff is not proof that an email reached the inbox.

Until a mail provider is configured, reset emails and one-time codes work only as development console output, and production order emails are not delivered.

## 4. Set up Paystack (test mode)

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
8. Before taking any real money, stop and arrange the live-payment implementation and review. Live keys are intentionally rejected today; changing `.env` cannot enable production charges. The implementation needs a deliberate live/test mode, environment-specific secrets, webhook verification, acceptance tests and operational rollout.

The integration charges ZAR using integer minor units and sends customers to Paystack-hosted checkout. Never mark an order paid based only on the browser redirect.

## 5. Set up Courier Guy delivery and lockers

The project's [Courier Guy integration notes](./CourierGuyAPI.md) and supplied [`tcg.postman_collection.json`](./tcg.postman_collection.json) are the implementation references. Courier Guy's actual API permissions, rate availability and account setup must be confirmed with Courier Guy.

1. Contact Courier Guy and arrange the account/merchant onboarding needed for API access, address delivery and locker/pickup-point delivery. Ask specifically for the production Accounts API access key and secret and the expected API region/settings.
2. Keep those provider credentials private. Sign in to CrochetNook as the relevant shop owner; open **Shop setup**; enter the Courier Guy access key and secret there. They are encrypted in the database using `COURIERGUY_ENCRYPTION_KEY`.
3. Fill in the shop's collection/origin address, contact name, sender email and phone. Enable the appropriate Courier Guy address and/or locker fulfilment option. Save the settings.
4. For every published item that may be shipped, maintain realistic packaged length, width, height and weight. The app uses these product-level values to request a rate and builds a parcel per item unit. Validate the final packed parcel sizes/weight and any combined-order limits against Courier Guy's rules.
5. Test buyer checkout from the public storefront using Courier Guy address delivery and locker delivery separately. Verify pickup-point search, rates, the selected service, the paid order's saved address/locker, and total amount against Courier Guy and Paystack.
6. Use a Courier Guy test/sandbox account or an approved low-risk test process to create a shipment **only for a paid order**. The shop owner chooses a future collection date and time window at booking; verify that Courier Guy accepts the window and that the resulting response includes a tracking reference.
7. Check the app's order page for the shipment reference and poll result. Compare Courier Guy's raw account tracking page/API response with the status/ETA displayed by the app. Tracking field names and ETA availability need verification against your actual account; there is no documented webhook in the supplied collection, so the app polls about every 30 minutes.
8. Test a real delivered/terminal status before relying on automatic tracking updates. Customers receive an update only if they consented to WhatsApp at checkout.

Shipment creation is a seller action after payment; checkout does not book a courier automatically. For locker orders, the shipment destination is the selected locker, and owner reminders tell the seller to prepare that parcel. Confirm how Courier Guy expects locker drop-off/collection and service-level selection for your account.

## 6. Set up WhatsApp Cloud API for each shop

Official starting point: [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started/). Meta's dashboard and current documentation are authoritative; UI and permissions can change.

1. The shop owner creates/uses a Meta business portfolio, creates a Meta developer app with the WhatsApp use case, and connects the correct WhatsApp Business Account and sending phone number.
2. Complete Meta business verification, phone-number registration, display-name checks, and any app review/permissions that Meta requires for the intended production setup. Do not rely on the temporary test token for production.
3. Create a long-lived/system-user access token with the current WhatsApp messaging permission required by Meta. Protect it like a password.
4. Create and submit three WhatsApp message templates for approval in the correct business account and language. The current code sends **body text parameters only** and expects:

   **Order confirmation** — 5 placeholders, in this order:
   1. shop name
   2. order reference
   3. item summary
   4. total paid
   5. delivery method/address or locker

   **Tracking update** — 4 placeholders:
   1. order reference
   2. status
   3. estimated delivery (or “Not provided by Courier Guy yet”)
   4. latest courier scan/event

   **Pickup reminder** — 5 placeholders:
   1. shop name
   2. order reference
   3. pickup date/time window in South African time
   4. item summary
   5. preparation instruction

   The template names and language code entered in **Shop setup** must match the exact approved template and language in Meta. Keep the templates transactional, accurate and consistent with buyer consent and WhatsApp policy.
5. In the shop's **Shop setup → WhatsApp order updates**, enter the Meta phone number ID, long-lived access token, exact approved template names and template language (often `en_ZA` if that is how the template was approved). Save, then confirm the UI reports **Connected**. The token is not returned to the browser after saving.
6. Confirm the shop sender phone is a valid WhatsApp recipient number in international format. South African local numbers beginning with `0` are converted to country code `27` by the app.
7. Complete a low-risk Paystack test order and explicitly tick WhatsApp consent at checkout. Confirm the order template arrives at the buyer's opted-in number.
8. Book a test Courier Guy shipment and verify the shop owner's configured WhatsApp number receives the 24-hour and 2-hour reminders, and that a changed tracking event reaches the opted-in buyer.
9. Test bad/expired tokens, unapproved or wrong-language templates, a bad recipient number and Meta rate/quality errors. Correct configuration and inspect server logs/notification records before launch.

Each shop uses its **own** phone number ID, token and approved templates. A configured number/token without approved matching templates will not send successfully. Buyer updates are opt-in; owner reminders are sent to the shop's configured sender phone only when WhatsApp API settings are configured.

## 7. Test the full order lifecycle

Use a test shop and test buyer addresses/numbers. Do not use real customer data during integration testing.

1. Publish one test product with correct price and parcel dimensions/weight.
2. Place a collection order and test Paystack test payment; verify the paid status, receipt email and optional consented WhatsApp order confirmation.
3. Place an address-delivery order, compare the courier quote and chosen shipping rate with the Paystack amount, pay in test mode, and verify no shipment exists until the seller books it.
4. Repeat for a locker order. Verify locker selection is stored and used in shipment booking.
5. Book a future pickup window. Confirm the booking response and tracking reference. Verify 24-hour and 2-hour reminders are queued at the correct local times (a reminder whose scheduled time is already past is not sent retroactively).
6. Poll tracking and compare status/ETA with Courier Guy. Confirm only changed tracking values create customer WhatsApp updates.
7. Test provider outages, a failed webhook, repeated webhooks and app/database restarts. Confirm queued notifications remain persisted and retry.
8. Test shop tenant isolation: one owner cannot see another shop's orders, credentials, buyer addresses, messages or product data.
9. Verify refunds, returns, cancellations, delivery exceptions and buyer support manually. The current app does not automate the full refund/return or shipment-cancellation lifecycle.

## 8. Production operations and monitoring

Before launch, assign an operator to:

- monitor application, database, SMTP, Paystack, Courier Guy and Meta errors;
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
- [ ] Production migrations applied without deleting any database volume/data.
- [ ] Both encryption keys recorded securely; existing Courier Guy key preserved.
- [ ] SMTP/domain authentication tested; payment receipt and pickup reminder delivered.
- [ ] Paystack end-to-end test, webhook signature, verification, duplicates and failed payments tested.
- [ ] Live payment mode implemented and separately reviewed before accepting real money.
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
