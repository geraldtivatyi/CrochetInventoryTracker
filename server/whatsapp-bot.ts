import crypto from "node:crypto";
import type { ShopOrder } from "@shared/schema";
import { storage } from "./storage";
import { decryptShopSecret } from "./shop-secrets";
import { normalizeWhatsAppNumber, sendWhatsAppList, sendWhatsAppText } from "./whatsapp";
import { enqueueManualOrderResolutionNotification } from "./notifications";

type WhatsAppMessage = {
  id?: string;
  from?: string;
  text?: { body?: string };
  interactive?: { list_reply?: { id?: string }; button_reply?: { id?: string } };
};

function messagesFromWebhook(body: unknown): WhatsAppMessage[] {
  if (!body || typeof body !== "object") return [];
  const messages: WhatsAppMessage[] = [];
  const entries = (body as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return messages;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const value = (change as { value?: { messages?: unknown } }).value;
      if (Array.isArray(value?.messages)) messages.push(...value.messages);
    }
  }
  return messages;
}

export function verifyWhatsAppSignature(body: Buffer, signature: string | undefined, appSecret: string) {
  if (!signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(body).digest();
  const actual = Buffer.from(signature.slice("sha256=".length), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function sendList(to: string, body: string, rows: Array<{ id: string; title: string; description?: string }>) {
  const settings = await storage.getPlatformIntegrations();
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessTokenEncrypted) {
    throw new Error("The shared WhatsApp Cloud API settings are not configured.");
  }
  await sendWhatsAppList(
    decryptShopSecret(settings.whatsappAccessTokenEncrypted),
    settings.whatsappPhoneNumberId,
    to,
    body,
    rows,
  );
}

async function sendText(to: string, text: string) {
  const settings = await storage.getPlatformIntegrations();
  if (!settings.whatsappPhoneNumberId || !settings.whatsappAccessTokenEncrypted) {
    throw new Error("The shared WhatsApp Cloud API settings are not configured.");
  }
  await sendWhatsAppText(
    decryptShopSecret(settings.whatsappAccessTokenEncrypted),
    settings.whatsappPhoneNumberId,
    to,
    text,
  );
}

async function showMenu(to: string, owner: boolean) {
  if (owner) {
    await sendList(to, "Owner menu — choose an action.", [
      { id: "owner:pending", title: "Pending requests", description: "Review your new orders" },
      { id: "menu", title: "Show this menu", description: "Choose another action" },
    ]);
    return;
  }
  await sendList(to, "Customer menu — choose an action.", [
    { id: "customer:check", title: "Check an order", description: "Look up an order using its reference" },
    { id: "customer:how", title: "How ordering works", description: "Payment and delivery information" },
  ]);
}

function summarizeOrder(order: ShopOrder) {
  const lines = order.items.map((item) => `${item.quantity} × ${item.name} — R ${(item.unitPrice * item.quantity).toFixed(2)}`);
  const fulfilment = order.delivery.method === "collection"
    ? "Collection requested"
    : order.delivery.method === "locker"
      ? `Locker requested: ${order.delivery.pickupPoint?.name ?? "location to be agreed"}`
      : `Address delivery requested: ${[
          order.delivery.address?.street_address,
          order.delivery.address?.local_area,
          order.delivery.address?.city,
          order.delivery.address?.zone,
          order.delivery.address?.code,
        ].filter(Boolean).join(", ")}`;
  return [
    `Order ${order.reference}`,
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone}`,
    ...lines,
    `Product subtotal: R ${(order.amountKobo / 100).toFixed(2)}`,
    fulfilment,
    "Shipping cost has not been collected or confirmed.",
    "Check your payment records before confirming a manual payment.",
  ].join("\n");
}

async function handleOwnerMessage(to: string, userId: number, action: string, text: string) {
  const shop = await storage.getShopForUser(userId);
  if (!shop) {
    await sendText(to, "Your account does not have a shop set up yet.");
    return;
  }
  if (action === "owner:pending") {
    const pending = (await storage.listShopOrders(shop.id))
      .filter((order) => order.paymentMethod === "manual" && order.status === "pending")
      .slice(0, 10);
    if (!pending.length) {
      await sendText(to, "You have no pending manual order requests.");
      return;
    }
    await sendList(to, "Select a pending request. Check payment in your own records before confirming it.", pending.map((order) => ({
      id: `owner:view:${order.reference}`,
      title: `#${order.reference.slice(-12)}`,
      description: `${order.customer.name} · R ${(order.amountKobo / 100).toFixed(2)}`.slice(0, 72),
    })));
    return;
  }
  const viewMatch = action.match(/^owner:view:(CN_[A-Z0-9]{8,80})$/i);
  if (viewMatch) {
    const order = await storage.getShopOrderByReference(viewMatch[1]);
    if (!order || order.shopId !== shop.id || order.paymentMethod !== "manual" || order.status !== "pending") {
      await sendText(to, "That order request is no longer pending or is unavailable.");
      return;
    }
    await sendText(to, summarizeOrder(order));
    await sendList(to, "Choose an action. Only confirm payment after checking your records.", [
      { id: `owner:paid:${order.reference}`, title: "Confirm received" },
      { id: `owner:cancel:${order.reference}`, title: "Cancel request" },
      { id: "owner:pending", title: "Back to requests" },
    ]);
    return;
  }
  const resolution = action.match(/^owner:(paid|cancel):(CN_[A-Z0-9]{8,80})$/i);
  if (resolution) {
    const order = await storage.getShopOrderByReference(resolution[2]);
    if (!order || order.shopId !== shop.id || order.paymentMethod !== "manual") {
      await sendText(to, "That order request is unavailable.");
      return;
    }
    const status = resolution[1].toLowerCase() === "paid" ? "paid" : "cancelled";
    const updated = await storage.resolveManualShopOrder(shop.id, order.reference, status);
    if (!updated) {
      await sendText(to, "That request has already been resolved.");
      return;
    }
    await enqueueManualOrderResolutionNotification(shop, updated, status);
    await sendText(to, status === "paid"
      ? `Payment marked as received by the shop for ${order.reference}. The customer has been notified where configured.`
      : `Order request ${order.reference} was cancelled.`);
    return;
  }
  if (text.trim().toLowerCase() === "menu" || action === "menu" || !action) {
    await showMenu(to, true);
    return;
  }
  await showMenu(to, true);
}

async function handleCustomerMessage(to: string, action: string, text: string) {
  if (action === "customer:check") {
    await sendText(to, "Please reply with your order reference (for example, CN_ followed by the reference shown after checkout).");
    return;
  }
  if (action === "customer:how") {
    await sendText(to, "Place an order request through the shop website. No payment is taken online. The shop will contact you to confirm availability, the final shipping cost, and how to pay.");
    return;
  }
  const reference = text.trim().match(/^(CN_[A-Z0-9]{8,80})$/i)?.[1];
  if (reference) {
    const order = await storage.getShopOrderByReference(reference);
    if (!order || normalizeWhatsAppNumber(order.customer.phone) !== to) {
      await sendText(to, "We could not find an order for this WhatsApp number and reference. Check the reference or contact the shop directly.");
      return;
    }
    const shop = await storage.getShopById(order.shopId);
    if (!shop) throw new Error(`Shop for order ${order.reference} was not found.`);
    const status = order.status === "pending"
      ? "Your request is awaiting the shop. No payment has been taken; the shop will contact you to agree on payment and delivery."
      : order.status === "paid" && order.paymentMethod === "manual"
        ? "The shop has marked your payment as received. Contact the shop directly about fulfilment."
        : order.status === "paid"
          ? "Payment has been verified for this order."
          : order.status === "cancelled"
            ? "The shop cancelled this order request."
            : "The payment for this order was not completed.";
    await sendText(to, `${shop.name} · ${order.reference}\nStatus: ${status}`);
    return;
  }
  if (action === "menu" || text.trim().toLowerCase() === "menu" || !action) {
    await showMenu(to, false);
    return;
  }
  await showMenu(to, false);
}

export async function processWhatsAppWebhook(body: unknown) {
  for (const message of messagesFromWebhook(body)) {
    if (!message.id || !message.from) continue;
    const messageId = message.id;
    if (!(await storage.claimWhatsAppWebhookMessage(messageId))) continue;
    try {
      const from = normalizeWhatsAppNumber(message.from);
      const action = message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id ?? "";
      const text = message.text?.body ?? "";
      const owner = await storage.getUserByWhatsAppPhone(from);
      if (owner) {
        await handleOwnerMessage(from, owner.id, action, text);
      } else {
        await handleCustomerMessage(from, action, text);
      }
    } catch (error) {
      await storage.releaseWhatsAppWebhookMessage(messageId);
      throw error;
    }
  }
}
