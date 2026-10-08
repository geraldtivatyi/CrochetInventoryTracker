# Integration with The Courier Guy

The imported Postman collection documents the Accounts API at `https://api.portal.thecourierguy.co.za`. It includes both address delivery and locker/pickup-point flows. The collection, rather than the older ShipLogic URL snippets, is the reference for this implementation.

## Current application integration foundation

The Postman collection at `tcg.postman_collection.json` documents the Accounts API endpoints used by the application:

- `GET /pickup-points?lat=...&lng=...&type=locker` searches locker locations (and supports other pickup point types).
- `POST /rates` requests a delivery-to-address quote, or a locker quote using `delivery_pickup_point_id`.
- `POST /shipments` creates a shipment for a delivery address or pickup point.
- `GET /tracking/shipments?tracking_reference=...` provides shipment status/ETA data for periodic order tracking. The collection does not document an event webhook, so the app polls this endpoint rather than receiving push updates.
- The collection also documents labels/waybills and cancellation, which are not yet exposed in the shop order UI.

Requests to account endpoints use AWS Signature Version 4. Each shop stores its own API access key and secret, encrypted at rest with `SHOP_SECRETS_ENCRYPTION_KEY` (or the legacy `COURIERGUY_ENCRYPTION_KEY`). Use a persistent, randomly generated 32-byte key represented as 64 hexadecimal characters; losing or changing it makes stored credentials unreadable, so shops must re-enter them. `COURIERGUY_AWS_REGION` defaults to `eu-west-1`.

The authenticated application endpoints are:

- `GET/PUT /api/shop` — store profile, publication, origin address, fulfilment options and Courier Guy credentials.
- `GET/POST/PATCH/DELETE /api/shop/products` — per-account store catalogue.
- `GET /api/courier/pickup-points?lat=...&lng=...&type=locker` — pickup location search.
- `POST /api/courier/rates` — quote address or locker delivery using the shop's saved origin and Courier Guy credentials.
- `POST /api/courier/shipments` — create a shipment with the shop's origin and sender details.
- `GET /api/storefront/:slug` — public shop data, returned only while live and containing only published products.
- `GET /api/storefront/domain` — serves the live store mapped to the request hostname.

The preview store URL is `/store/:slug`. Custom-domain records can be configured in Shop settings, but the domain also needs DNS and TLS configured to point at the application. Checkout, Paystack test-mode verification, persisted orders, shipment booking for paid orders, scheduled pickup reminders and periodic tracking updates are implemented. Shipment labels are not yet exposed. Do not create shipments for unpaid/unconfirmed orders.

Courier Guy credentials and shipment endpoints should first be tested with credentials and payloads approved for the account. The Postman examples are illustrative; service-level availability, tracking fields, collection scheduling and account permissions are determined by Courier Guy. The shop owner chooses a South African local pickup date/time window when booking; those inputs are sent as `collection_min_date`, `collection_after` and `collection_before`.
