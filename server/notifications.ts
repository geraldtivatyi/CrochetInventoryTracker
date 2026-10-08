import type { NotificationJob, Shop, ShopOrder } from "@shared/schema";
import { decryptShopSecret } from "./shop-secrets";
import { getShipmentTracking, type CourierCredentials } from "./courier-guy";
import { sendMail } from "./mailer";
import { storage } from "./storage";
import { normalizeWhatsAppNumber, sendWhatsAppTemplate } from "./whatsapp";

type NotificationKind = NotificationJob["kind"];
type NotificationChannel = NotificationJob["channel"];

const johannesburgOffset = "+02:00";
let processingJobs = false;
let processingTracking = false;
let workersStarted = false;

function money(amountKobo: number) {
  return `R ${(amountKobo / 100).toFixed(2)}`;
}

function deliveryDescription(order: ShopOrder) {
  if (order.delivery.method === "collection") return "Collection";
  if (order.delivery.method === "locker") {
    return `Courier Guy locker: ${order.delivery.pickupPoint?.name ?? "selected pickup point"}`;
  }
  const address = order.delivery.address;
  return address
    ? `Courier Guy delivery to ${[address.street_address, address.local_area, address.city, address.zone, address.code].filter(Boolean).join(", ")}`
    : "Courier Guy home delivery";
}

function itemDescription(order: ShopOrder) {
  return order.items.map((item) => `${item.quantity} x ${item.name}`).join(", ").slice(0, 900);
}

function orderReceiptText(shop: Shop, order: ShopOrder) {
  const sellerAddress = [
    shop.originAddress.company,
    shop.originAddress.street_address,
    shop.originAddress.local_area,
    shop.originAddress.city,
    shop.originAddress.zone,
    shop.originAddress.code,
  ].filter(Boolean).join(", ");
  const items = order.items.map((item) =>
    `  ${item.quantity} x ${item.name} @ ${money(Math.round(item.unitPrice * 100))} = ${money(Math.round(item.unitPrice * item.quantity * 100))}`,
  ).join("\n");
  return [
    `PAYMENT RECEIPT / ORDER CONFIRMATION`,
    `${shop.name}`,
    sellerAddress,
    shop.senderEmail,
    "",
    `Order reference: ${order.reference}`,
    `Order date: ${order.createdAt.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}`,
    `Customer: ${order.customer.name}`,
    "",
    "Items:",
    items,
    "",
    `Delivery: ${deliveryDescription(order)}`,
    `Delivery charge: ${money(order.delivery.feeKobo)}`,
    `Amount paid: ${money(order.amountKobo)} ${order.currency}`,
    "",
    order.delivery.method === "collection"
      ? "The shop will contact you to arrange collection."
      : "The shop will book your Courier Guy shipment and share delivery progress when available.",
    "",
    "This payment receipt confirms payment and is not a VAT tax invoice.",
  ].join("\n");
}

function waSettingsReady(shop: Shop) {
  return !!shop.whatsappPhoneNumberId && !!shop.whatsappAccessTokenEncrypted;
}

async function enqueue(
  shop: Shop,
  order: ShopOrder,
  channel: NotificationChannel,
  kind: NotificationKind,
  recipient: string,
  payload: Record<string, string | string[]>,
  runAt = new Date(),
  dedupeSuffix: string = kind,
) {
  await storage.enqueueNotification({
    dedupeKey: `${order.reference}:${dedupeSuffix}:${channel}`,
    shopId: shop.id,
    orderReference: order.reference,
    channel,
    kind,
    recipient,
    payload,
    runAt,
    status: "queued",
    attempts: 0,
    lastError: null,
  });
}

export async function enqueuePaidOrderNotifications(shop: Shop, order: ShopOrder) {
  const text = orderReceiptText(shop, order);
  await enqueue(shop, order, "email", "order_receipt", order.customer.email, {
    subject: `Payment received · ${shop.name} · ${order.reference}`,
    text,
  }, new Date(), "paid-receipt");
  if (order.customer.whatsappUpdates) {
    await enqueue(shop, order, "whatsapp", "order_receipt", order.customer.phone, {
      parameters: [
        shop.name,
        order.reference,
        itemDescription(order) || "Your order",
        money(order.amountKobo),
        deliveryDescription(order),
      ],
    }, new Date(), "paid-whatsapp");
  }
}

function pickupDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00${johannesburgOffset}`);
}

export async function enqueuePickupReminders(shop: Shop, order: ShopOrder) {
  const schedule = order.delivery.pickupSchedule;
  if (!schedule) return;
  const pickupAt = pickupDateTime(schedule.date, schedule.after);
  if (!Number.isFinite(pickupAt.getTime())) throw new Error("The saved Courier Guy pickup date/time is invalid.");
  for (const [label, leadMs] of [["24h", 24 * 60 * 60 * 1000], ["2h", 2 * 60 * 60 * 1000]] as const) {
    const runAt = new Date(pickupAt.getTime() - leadMs);
    if (runAt <= new Date()) continue;
    const pickupText = `${schedule.date}, ${schedule.after}–${schedule.before} (South African time)`;
    const emailText = [
      `Courier Guy pickup reminder for ${shop.name}`,
      `Order: ${order.reference}`,
      `Pickup window: ${pickupText}`,
      `Customer: ${order.customer.name}`,
      `Contents: ${itemDescription(order)}`,
      order.delivery.method === "locker"
        ? `This shipment is going to ${order.delivery.pickupPoint?.name ?? "a Courier Guy locker"}. Make sure the parcel is prepared for collection.`
        : "Prepare the parcel for the scheduled Courier Guy collection.",
    ].join("\n");
    if (shop.senderEmail) {
      await enqueue(shop, order, "email", "pickup_reminder", shop.senderEmail, {
        subject: `${label === "24h" ? "Tomorrow" : "In 2 hours"}: Courier Guy pickup · ${order.reference}`,
        text: emailText,
      }, runAt, `pickup-${label}-email`);
    }
    if (shop.senderPhone && waSettingsReady(shop)) {
      let recipient: string;
      try {
        recipient = normalizeWhatsAppNumber(shop.senderPhone);
      } catch (error) {
        console.error(`WhatsApp pickup reminder not queued for ${order.reference}:`, error);
        continue;
      }
      await enqueue(shop, order, "whatsapp", "pickup_reminder", recipient, {
        parameters: [
          shop.name,
          order.reference,
          pickupText,
          itemDescription(order) || "Order parcel",
          order.delivery.method === "locker" ? "Prepare the parcel for locker delivery." : "Prepare the parcel for courier collection.",
        ],
      }, runAt, `pickup-${label}-whatsapp`);
    }
  }
}

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function recordTree(value: unknown, maxDepth = 4): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const visit = (item: unknown, depth: number) => {
    if (depth > maxDepth) return;
    const record = objectRecord(item);
    if (!record) {
      if (Array.isArray(item)) item.forEach((child) => visit(child, depth + 1));
      return;
    }
    result.push(record);
    Object.values(record).forEach((child) => visit(child, depth + 1));
  };
  visit(value, 0);
  return result;
}

function findText(records: Record<string, unknown>[], names: string[]) {
  for (const record of records) {
    for (const name of names) {
      const value = record[name];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

export function extractShipmentTrackingReference(shipment: unknown) {
  return findText(recordTree(shipment), ["tracking_reference", "trackingReference", "tracking_number", "trackingNumber"]);
}

function trackingSummary(response: unknown) {
  const records = recordTree(response);
  const events = records.filter((record) =>
    typeof record.status === "string" || typeof record.description === "string" || typeof record.message === "string",
  );
  const latest = events.at(-1);
  const status = findText(records, ["current_status", "tracking_status", "shipment_status", "status"]);
  const latestEvent = latest
    ? [latest.description, latest.message, latest.status].find((value) => typeof value === "string" && value.trim())?.toString().trim() ?? ""
    : "";
  const estimatedDelivery = findText(records, [
    "estimated_delivery",
    "estimated_delivery_date",
    "delivery_estimate",
    "delivery_eta",
    "expected_delivery",
    "expected_delivery_date",
  ]);
  return { status, latestEvent, estimatedDelivery };
}

async function enqueueTrackingUpdate(shop: Shop, order: ShopOrder, status: string, latestEvent: string, eta: string) {
  if (!order.customer.whatsappUpdates) return;
  await enqueue(shop, order, "whatsapp", "tracking_update", order.customer.phone, {
    parameters: [
      order.reference,
      status || latestEvent || "Shipment update",
      eta || "Not provided by Courier Guy yet",
      latestEvent || status || "Please contact the shop if you need help.",
    ],
  }, new Date(), `tracking-${Buffer.from(`${status}|${latestEvent}|${eta}`).toString("base64url").slice(0, 64)}`);
}

async function processTrackingUpdates() {
  if (processingTracking) return;
  processingTracking = true;
  try {
    const entries = await storage.listOrdersForTracking();
    const now = Date.now();
    for (const { shop, order } of entries) {
      const delivery = order.delivery;
      if (delivery.tracking?.lastCheckedAt && now - Date.parse(delivery.tracking.lastCheckedAt) < 30 * 60 * 1000) continue;
      if (/delivered|cancelled|returned|failed/i.test(delivery.tracking?.status ?? "")) continue;
      const reference = delivery.trackingReference ?? extractShipmentTrackingReference(delivery.shipment);
      if (!reference || !shop.courierAccessKeyEncrypted || !shop.courierSecretEncrypted) continue;
      try {
        const credentials: CourierCredentials = {
          accessKey: decryptShopSecret(shop.courierAccessKeyEncrypted),
          secretKey: decryptShopSecret(shop.courierSecretEncrypted),
        };
        const response = await getShipmentTracking(credentials, reference);
        const summary = trackingSummary(response);
        const previous = delivery.tracking;
        const changed = previous
          ? summary.status !== previous.status ||
            summary.latestEvent !== previous.latestEvent ||
            summary.estimatedDelivery !== previous.estimatedDelivery
          : !!(summary.status || summary.latestEvent || summary.estimatedDelivery);
        const updated = await storage.updateShopOrder(order.reference, {
          delivery: {
            ...delivery,
            trackingReference: reference,
            tracking: { ...summary, lastCheckedAt: new Date().toISOString() },
          },
        });
        if (updated && changed) {
          await enqueueTrackingUpdate(shop, updated, summary.status, summary.latestEvent, summary.estimatedDelivery);
        }
      } catch (error) {
        await storage.updateShopOrder(order.reference, {
          delivery: {
            ...delivery,
            tracking: {
              status: delivery.tracking?.status ?? "",
              latestEvent: delivery.tracking?.latestEvent ?? "",
              estimatedDelivery: delivery.tracking?.estimatedDelivery ?? "",
              lastCheckedAt: new Date().toISOString(),
            },
          },
        });
        console.error(`Courier Guy tracking failed for ${order.reference}:`, error);
      }
    }
  } catch (error) {
    console.error("Courier Guy tracking poll failed:", error);
  } finally {
    processingTracking = false;
  }
}

function templateFor(shop: Shop, kind: NotificationKind) {
  switch (kind) {
    case "order_receipt": return shop.whatsappOrderTemplate;
    case "tracking_update": return shop.whatsappTrackingTemplate;
    case "pickup_reminder": return shop.whatsappReminderTemplate;
  }
}

async function deliver(job: NotificationJob) {
  if (job.channel === "email") {
    const subject = job.payload.subject;
    const text = job.payload.text;
    if (typeof subject !== "string" || typeof text !== "string") throw new Error("The queued email content is invalid.");
    await sendMail({ to: job.recipient, subject, text });
    return;
  }
  const shop = await storage.getShopById(job.shopId);
  if (!shop || !waSettingsReady(shop)) throw new Error("Configure this shop's WhatsApp Cloud API credentials before sending messages.");
  const templateName = templateFor(shop, job.kind);
  if (!templateName) throw new Error(`Set an approved WhatsApp template for ${job.kind.replaceAll("_", " ")} in Shop settings.`);
  const parameters = job.payload.parameters;
  if (!Array.isArray(parameters) || parameters.some((value) => typeof value !== "string")) {
    throw new Error("The queued WhatsApp template parameters are invalid.");
  }
  await sendWhatsAppTemplate(
    decryptShopSecret(shop.whatsappAccessTokenEncrypted!),
    shop.whatsappPhoneNumberId!,
    job.recipient,
    templateName,
    shop.whatsappTemplateLanguage,
    parameters,
  );
}

async function processNotificationJobs() {
  if (processingJobs) return;
  processingJobs = true;
  try {
    const jobs = await storage.claimDueNotificationJobs(new Date(), 20);
    for (const job of jobs) {
      try {
        await deliver(job);
        await storage.updateNotificationJob(job.id, { status: "sent", lastError: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Notification delivery failed.";
        const terminal = job.attempts >= 20;
        const delayMs = Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** Math.min(job.attempts - 1, 8));
        await storage.updateNotificationJob(job.id, {
          status: terminal ? "failed" : "queued",
          runAt: terminal ? job.runAt : new Date(Date.now() + delayMs),
          lastError: message.slice(0, 1000),
        });
        console.error(`Could not deliver ${job.channel} ${job.kind} for ${job.orderReference}: ${message}`);
      }
    }
  } catch (error) {
    console.error("Notification queue processing failed:", error);
  } finally {
    processingJobs = false;
  }
}

export function startNotificationWorkers() {
  if (workersStarted || process.env.NODE_ENV === "test") return;
  workersStarted = true;
  const queueTimer = setInterval(() => void processNotificationJobs(), 30_000);
  const trackingTimer = setInterval(() => void processTrackingUpdates(), 60_000);
  queueTimer.unref();
  trackingTimer.unref();
  void processNotificationJobs();
  void processTrackingUpdates();
}
