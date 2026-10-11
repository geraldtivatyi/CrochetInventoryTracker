# CrochetNook manual-order MVP launch checklist

Use this checklist to prepare and operate the current manual-order MVP. Complete the steps in order, save the evidence requested, and do not accept real customer data until every applicable launch gate is complete.

This checklist is an operational guide, not legal, tax, security, or payment-provider advice. Ask qualified South African professionals and the relevant providers to confirm requirements for your specific business.

## MVP scope and important limits

- The public shop collects **order requests**, not online payments.
- The shop owner contacts the customer directly to confirm stock/availability, final price, shipping cost, payment method, and fulfilment.
- The platform must not collect, hold, route, or promise to pay out customer funds. Do not collect or store shop owners' bank details in the app.
- `SHOP_PAYMENT_MODE` defaults to `manual`. `paystack_test` is for test transactions only. Live Paystack payments are not implemented.
- In manual mode, the app does not fetch Courier Guy rates or book a Courier Guy shipment. Arrange delivery outside the app, or defer provider integration until it is deliberately designed and tested for manual orders.
- The app can queue customer and shop email notifications, but it does not currently provide a notification-delivery dashboard. Orders remain visible in the owner Shop → Orders screen if email delivery fails.
- Marking a manual order as paid is the shop owner's own record after checking their payment records. It is not proof of an online payment.
- The app does not automatically reserve/decrement yarn stock for shop orders, provide a full returns/refunds workflow, generate statutory tax invoices, or provide marketplace payment dispute handling.

Record the release being checked:

- Release/version or commit: ______________________________
- Staging URL: ___________________________________________
- Production URL: ________________________________________
- Checklist owner: _______________________________________
- Intended launch date: __________________________________

## 1. Confirm the business and customer terms

**Do this before publishing a shop or accepting customer details.**

- [ ] Write down who the customer is buying from and which legal/trading name appears in the shop.
  1. Confirm the seller's public business/trading name and contact channel.
  2. Decide who answers order, payment, delivery, returns, and privacy questions.
  3. Keep the contact details current and give the responsible person access to the owner account.
  4. **Pass when:** a customer can identify the seller and knows how to contact them without relying on the platform operator.
- [ ] Agree how manual order requests are handled.
  1. Define how quickly the owner aims to respond to a new request.
  2. Check product availability and confirm whether the order can be fulfilled before asking the customer to pay.
  3. Agree the complete amount with the customer, including any delivery charge, before accepting payment.
  4. Tell the customer which payment methods the seller accepts and how the customer can independently verify payment details.
  5. Record payment and fulfilment using the seller's own business records. Do not treat an order-request email or the app's “payment confirmed by shop” label as proof of payment.
  6. **Pass when:** the owner can process a request from receipt through payment confirmation, fulfilment, and record keeping without implying the app collected money.
- [ ] Prepare and publish customer-facing terms.
  1. Write the delivery/collection areas, estimated timing, collection arrangements, and how the final shipping amount is agreed.
  2. Write the cancellation, returns, refunds, damaged-item, and customer-support procedures.
  3. Write the privacy notice: what customer data is collected, why, who can access it, how long it is retained, how customers can exercise their rights, and who to contact.
  4. Put a clear contact method and links to terms/privacy information in the shop description or another page customers can reach before submitting an order. The app does not currently provide dedicated legal-policy pages.
  5. Have a South African consumer/privacy adviser review these terms for your business model and applicable consumer-protection and POPIA obligations.
  6. **Pass when:** a test buyer can find the terms, privacy notice, and support contact before placing an order.
- [ ] Confirm accounting and tax treatment.
  1. Ask a South African tax practitioner which records and sales documents to issue for your transactions.
  2. Confirm who issues a sales document when the customer pays the seller directly.
  3. Do not call the app's test-payment receipt or a manual order acknowledgement a VAT invoice.
  4. **Pass when:** you have written guidance on seller record keeping and any required invoices. If compliant invoices are required, treat adding and validating them as a separate release blocker.
- [ ] Decide whether any provider integrations are actually needed for this MVP.
  1. Manual ordering works without Paystack, Courier Guy, or WhatsApp credentials.
  2. Do not enable the app's Courier Guy shipment flow for manual orders; manual orders are fulfilled directly outside that integrated shipment workflow.
  3. Do not promise WhatsApp order notifications in manual mode; manual-mode order acknowledgements/owner alerts are email-based.
  4. **Pass when:** shop copy and operating procedures only promise services that are configured and tested.

## 2. Prepare a safe release candidate

**Complete this on a staging deployment before production.**

- [ ] Record the exact source revision and review its changes.
  1. Confirm which commit/release is being deployed.
  2. Review the changes included in that release, especially checkout, customer data, authentication, database migrations, and notifications.
  3. Confirm no `.env`, passwords, provider tokens, private keys, or customer data are included in source control or build artifacts.
  4. **Pass when:** the deployed revision is identifiable and contains no secrets.
- [ ] Build the application.
  1. From the repository root, run `npm ci` using the lockfile.
  2. Run `npm run build`.
  3. Resolve build errors; record and investigate warnings rather than assuming they are harmless.
  4. **Pass when:** the production client and server bundles build successfully from a clean install.
- [ ] Resolve the current TypeScript-check baseline.
  1. Run `npm run check`.
  2. At the time this checklist was written, the repository-wide check reports existing TypeScript/configuration errors, including compiler target/module settings, an unrelated storage typing issue, and duplicate imports in `server/vite.ts`.
  3. Fix or explicitly triage these issues; do not claim a clean type-check based only on the production bundle build.
  4. Add a repeatable CI step for build and type-check before relying on future releases.
  5. **Pass when:** CI reports the agreed required checks as passing, with any accepted exception documented and owned.
- [ ] Test authorization and tenant boundaries using separate shop accounts.
  1. Verify signed-out visitors cannot call owner/shop administration endpoints.
  2. Verify a normal shop user cannot access owner-only user administration.
  3. With two test shops, attempt to access each other's orders, products, uploaded images, and shop credentials.
  4. Verify a signed-in owner can view and manage only their own shop.
  5. **Pass when:** unauthorized requests fail, cross-shop data is inaccessible, and secrets never appear in API responses.
- [ ] Review production logging before entering real customer data.
  1. Inspect application and hosting logs during test sign-in, shop setup, order submission, and owner order review.
  2. The current API request logger records response JSON in logs; responses can contain customer names, phone numbers, email addresses, and delivery addresses.
  3. Disable response-body logging or change it to a carefully reviewed, allow-listed and redacted format before launch.
  4. Ensure passwords, reset/OTP tokens, session identifiers, encryption keys, provider credentials, buyer contact details, and full addresses are not logged.
  5. Restrict log access and retention; confirm how to request deletion if personal data has already been logged.
  6. **Pass when:** test logs contain operational metadata only and no unnecessary customer or secret data.
- [ ] Verify authentication and session behaviour.
  1. Set a unique high-entropy `SESSION_SECRET` in the production secret manager.
  2. Confirm `APP_URL` uses the public `https://` origin and is correct for reset links.
  3. Confirm the reverse proxy forwards HTTPS correctly so secure cookies work.
  4. Confirm sessions use PostgreSQL in the deployed environment and survive an app restart.
  5. Test owner account setup, sign-in, sign-out, password reset, account invites, and optional email OTP.
  6. Use unique strong passwords, enable OTP for administrative accounts where practical, and remove unused accounts.
  7. **Pass when:** an app restart does not unexpectedly log out all active users, reset links work on the public domain, and authentication flows do not expose tokens.

## 3. Provision hosting, domain, and secrets

**Never paste secrets into this checklist, chat, source files, browser code, or screenshots. Use the host's secret manager. The repository `.env` is local configuration; do not publish or share it.**

- [ ] Choose and configure the production host.
  1. Select a host that supports the app's Node.js production build and a persistent PostgreSQL database.
  2. Set a stable public domain and route HTTPS traffic to the app.
  3. Configure TLS certificate issuance and automatic renewal.
  4. Configure the proxy/load balancer to preserve the original HTTPS scheme and correct host.
  5. Configure platform restart-on-failure and a health/availability alert using a supported endpoint or external uptime check.
  6. **Pass when:** the public HTTPS domain loads the app, certificates are valid, and an outage or failed app start alerts the operator.
- [ ] Do not deploy the repository's Compose defaults directly to the public internet.
  1. The included Compose file contains development database credentials and fallback session/URL values.
  2. Use a managed/private PostgreSQL service or replace those values with strong production credentials and private networking.
  3. Expose only the application through the public ingress; do not expose PostgreSQL publicly.
  4. **Pass when:** production has no default database password, sample session secret, or localhost public URL.
- [ ] Set required production environment values in the host's secret/configuration manager.
  1. `NODE_ENV=production`.
  2. `PORT` set to the port expected by the hosting platform.
  3. `DATABASE_URL` or `NEON_DATABASE_URL` set to the persistent PostgreSQL connection.
  4. `SESSION_SECRET` set to a unique high-entropy secret.
  5. `APP_URL` set to the canonical public HTTPS URL, without a trailing slash.
  6. `SHOP_PAYMENT_MODE=manual` explicitly set, even though manual is the default.
  7. Set SMTP values: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, and a verified `MAIL_FROM`.
  8. Only if you will configure Courier Guy or WhatsApp credentials, set and securely back up stable `COURIERGUY_ENCRYPTION_KEY` and `SHOP_SECRETS_ENCRYPTION_KEY` values. Do not rotate existing encryption keys without a planned credential re-encryption process.
  9. Do not add `PAYSTACK_SECRET_KEY` for the manual MVP. If deliberately running a test environment, use only a Paystack test key with `SHOP_PAYMENT_MODE=paystack_test`; never use live credentials.
  10. **Pass when:** the host's configuration has been reviewed without exposing secret values and the app starts in manual mode.
- [ ] Verify deployment/restart behaviour.
  1. Run the exact production build and start command used by the platform.
  2. Confirm the app starts only when it has a persistent database connection; production must not silently run on in-memory storage.
  3. Restart the application and confirm shops, products, images, orders, notification jobs, and sessions persist.
  4. Confirm a failed database connection or missing required secret is visible to the operator and does not produce a success-shaped empty shop.
  5. **Pass when:** deployment is repeatable, persistent, and failures are observable.

## 4. Protect and operate PostgreSQL

- [ ] Apply database schema changes safely.
  1. Identify the production database and verify the backup is current before an upgrade.
  2. Apply the repository's current schema/migrations, including `drizzle/0009_manual_order_requests.sql`.
  3. Runtime startup currently creates/adds some shop/order columns as well; still keep migration files and deployment steps in sync.
  4. Never delete a database volume to make migrations run. Docker init scripts only initialize an empty database directory.
  5. Verify existing users, yarn, projects, calculations, shops, products, and orders remain after the migration.
  6. **Pass when:** migration logs show success, existing records remain, and the app can read/write a test record.
- [ ] Set up backups and prove recovery.
  1. Enable automatic encrypted backups with a defined retention schedule.
  2. Restrict database and backup access to named administrators.
  3. Document who receives backup failure alerts and how to restore.
  4. Restore a backup into a separate non-production database.
  5. Verify restored users, shops, products/images, orders, and notification jobs.
  6. Record backup frequency, retention, last successful restore test, and expected recovery time: ____________________.
  7. **Pass when:** a restore has been completed and verified, not merely assumed from a “backup successful” indicator.

## 5. Configure and prove email delivery

- [ ] Configure the production email sender.
  1. Choose an SMTP provider that supports your expected transactional email volume.
  2. Verify the sending domain and publish the provider's current SPF/DKIM records; configure DMARC where appropriate.
  3. Store SMTP credentials and `MAIL_FROM` only in the production secret manager.
  4. In Shop setup, use a valid shop contact email. A published shop requires one for order-request notifications.
  5. **Pass when:** the provider accepts mail from the verified sender and no password or API key is present in logs.
- [ ] Test the actual messages and failure fallback.
  1. Trigger a password-reset email and confirm the link opens the public HTTPS app.
  2. Submit a manual order request using test customer information.
  3. Confirm the customer receives the order reference and explicit “no payment taken” / follow-up wording.
  4. Confirm the shop contact receives the order request and can reach the customer using the supplied details.
  5. Simulate invalid SMTP settings or a controlled provider failure. Confirm the order remains visible in Shop → Orders and the notification is reported/retried.
  6. Check provider bounce/suppression logs and the app's notification failure logs. The app has no delivery dashboard; assign a person to inspect failures.
  7. **Pass when:** both messages arrive in a real inbox, content is accurate, and an email outage does not lose the order.

## 6. Configure the public shop and owner workflow

- [ ] Prepare shop information and catalogue.
  1. Sign in using the production owner account.
  2. Set the shop name, URL slug, public contact method, and a plain-language description.
  3. Include customer-facing links or instructions for payment, shipping-cost confirmation, collection/delivery timing, cancellations/returns, privacy, and support.
  4. Add product names, accurate descriptions, prices, images, and publish only items that are currently available.
  5. Confirm no placeholder/sample text, false Paystack claims, or unsupported shipping promises are visible.
  6. **Pass when:** a buyer unfamiliar with the business can understand what is sold and what happens after an order request.
- [ ] Set the fulfilment choices honestly.
  1. Enable collection/address/locker request options only if the shop is willing to fulfil them.
  2. Explain that an address or locker preference is a request and the owner confirms feasibility and cost.
  3. For manual mode, arrange all shipping outside the app; do not promise live Courier Guy rates, labels, tracking, or automated booking.
  4. **Pass when:** every selected option can actually be serviced and the final charge is agreed before payment.
- [ ] Verify order-owner procedures.
  1. Keep Shop → Orders open during the test; confirm an order request appears with customer contact, items, subtotal, fulfilment preference, and reference.
  2. Contact the test customer to confirm availability, final shipping price, payment method, and timing.
  3. Confirm offline payment in the seller's own bank/payment records before using “Confirm payment received”.
  4. Verify the action changes the status and the buyer's reference page displays the shop-confirmed status. Test cancellation too.
  5. After fulfilment, reconcile the sale and inventory in the seller's normal records. Shop orders do not automatically reduce yarn inventory.
  6. **Pass when:** staff understand the status meaning and do not confuse seller confirmation with provider verification.

## 7. Run acceptance tests on staging

Use fake names, addresses, phone numbers, and email accounts. Never use live payment credentials or create a real courier booking as an unapproved test.

- [ ] **Collection request:** submit a basket; verify order reference, saved products/prices/customer, no payment charge, customer/shop emails, and owner visibility.
- [ ] **Address request:** submit a delivery address; verify it is retained for the shop, shipping is labelled unconfirmed, and no Courier Guy/Paystack rate or payment call is made.
- [ ] **Locker request:** submit the locker preference without requiring a provider lookup in manual mode; verify copy says the choice is to be arranged with the owner.
- [ ] **Repeated submission:** submit the same checkout twice or retry after a connection interruption; verify it does not create duplicate orders or duplicate acknowledgement messages.
- [ ] **Invalid/stale checkout:** alter an item price or use an expired quote; verify checkout fails clearly and safely, and the customer can restart.
- [ ] **Order state:** confirm paid and cancel actions succeed only for the correct shop's pending manual order; verify a second resolution attempt is rejected.
- [ ] **Public status:** open the returned reference URL, reload it, and verify status refreshes; test on both the standard `/store/<slug>` domain and each configured custom domain.
- [ ] **Email outage:** block/fail SMTP in staging; verify the order remains saved and visible, the customer is not told email was successfully delivered, and the failure is observable.
- [ ] **Tenant isolation:** use a second owner account to try to read/update the first shop's order and verify access is denied.
- [ ] **Mobile/accessibility:** test public catalogue and checkout on a narrow screen; use keyboard navigation and ensure field labels and errors are understandable.
- [ ] **Operational restart:** restart the app after a test order; verify order and notification status persist.
- [ ] Acceptance-test operator/date: ____________________  Evidence location: ______________________________

**Paystack test flow is separate and optional.** If you need to inspect it, use a non-production staging environment, set `SHOP_PAYMENT_MODE=paystack_test`, use only `sk_test_` credentials, and follow the test procedure in [PRODUCTION-READINESS-GUIDE.md](./PRODUCTION-READINESS-GUIDE.md). Return staging to `manual` before launch. Live Paystack payments are not available.

## 8. Monitoring, incidents, and support

- [ ] Assign people and escalation paths.
  1. Name the person who checks new order requests and responds to customers.
  2. Name the person who monitors app/host/database availability, SMTP errors, backups, and access alerts.
  3. Publish customer support hours and expected response time in the shop.
  4. **Pass when:** every customer-impacting alert and unanswered order has an accountable owner and backup.
- [ ] Document incident procedures.
  1. For an app outage, pause promotion and give customers an alternate contact/order method.
  2. For email failure, check the owner order list and notification logs; do not assume the customer received a message.
  3. For suspected account/data exposure, restrict access, preserve relevant logs, notify the responsible privacy contact/adviser, and follow the documented incident/breach process.
  4. For database failure, stop writes if needed, restore only under an approved runbook, and reconcile orders received during the outage.
  5. **Pass when:** staff know where the runbook is and have rehearsed a non-destructive recovery scenario.
- [ ] Set a recurring operating routine.
  1. Daily while starting: check the order list, respond to requests, check email delivery and app availability.
  2. Weekly: review pending/unresolved requests, cancelled requests, notification failures, user access, and backup status.
  3. Monthly: test restore/incident procedures on a safe environment, review access and privacy retention, and verify customer terms remain current.
  4. Keep an order/payment/fulfilment record outside the app as required by your accounting advice.
  5. **Pass when:** the routine has an owner, calendar reminder, and documented evidence.

## 9. Final go/no-go decision

Do not launch until every applicable required item is complete.

- [ ] Business identity, customer terms, privacy notice, support contact, and tax/accounting approach reviewed.
- [ ] The shop accurately explains manual order requests and never implies that online payment has been taken.
- [ ] Production deployment uses HTTPS, persistent PostgreSQL, non-default credentials, and a unique session secret.
- [ ] Migrations and backup restoration have been tested without deleting data.
- [ ] Production logs do not expose customer personal data or secrets.
- [ ] Owner authentication, authorization, shop isolation, and session persistence have been tested.
- [ ] SMTP delivers customer acknowledgement and shop alert; failure is observable and orders remain accessible.
- [ ] Staging acceptance tests pass for collection, address, locker preference, duplicate/retry, status, cancellation, email failure, tenant isolation, and restart.
- [ ] Owner response, payment verification, shipping confirmation, inventory reconciliation, and customer-support procedures are assigned.
- [ ] Monitoring, incident response, backups, restoration, and access review have named owners.
- [ ] No Paystack live key or live-payment promise is enabled. Paystack test mode is off in production.
- [ ] Any optional Courier Guy/WhatsApp integration is either clearly not offered or separately implemented and fully tested for the intended flow.
- [ ] Remaining known limitations are accepted in writing by the business owner; no unresolved critical data-loss, access-control, or privacy issue remains.

Decision: [ ] GO  [ ] NO-GO  
Approved by: ______________________________  Date: __________________  
Outstanding blockers and owner: ______________________________________________________________

## 10. After launch

- [ ] First day: monitor availability, email delivery, new orders, customer questions, and logs frequently.
- [ ] First week: review every order from request through fulfilment and payment recording; resolve notification and response-time problems.
- [ ] First month: review backups/restores, support volume, terms/privacy wording, access, and whether manual operational work remains manageable.
- [ ] Before any real online payment: obtain written Paystack confirmation for the exact platform/payment model, obtain legal/accounting advice, implement a separate reviewed live-payment design (including settlement, refunds, disputes, reconciliation, seller onboarding and data protection), test it end to end, and approve a separate go-live checklist. **Do not enable a live key in this MVP.**
