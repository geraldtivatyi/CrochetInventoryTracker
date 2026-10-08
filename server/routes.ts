import crypto from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { dataPersistence, storage } from "./storage";
import { z } from "zod";
import { authRouter, requireAuth, setupSession } from "./auth";
import { createShipment, getPickupPoints, getRates } from "./courier-guy";
import { decryptShopCredential, encryptShopCredential, encryptShopSecret } from "./shop-secrets";
import { 
  insertYarnSchema, 
  insertProjectSchema, 
  insertPriceCalculationSchema,
  insertActivityLogSchema,
  courierPickupQuerySchema,
  courierRateSchema,
  courierShipmentSchema,
  shopProductSchema,
  shopProductRequestSchema,
  shopProductImageSchema,
  shopSettingsSchema,
  checkoutQuoteSchema,
  checkoutPaymentSchema,
  type ShopOrder,
  type ShopProduct,
} from "@shared/schema";
import type { ShopBrandingImage, ShopProductImage, ShopProductView } from "./storage";
import { APP_URL } from "./mailer";
import {
  createCheckoutQuoteToken,
  initializePaystackTransaction,
  isPaystackTestModeConfigured,
  readCheckoutQuoteToken,
  verifyPaystackWebhookSignature,
  verifyPaystackTransaction,
} from "./paystack";
import {
  enqueuePaidOrderNotifications,
  enqueuePickupReminders,
  extractShipmentTrackingReference,
  startNotificationWorkers,
} from "./notifications";

const yarnUpdateRequestSchema = insertYarnSchema.partial().extend({
  adjustmentReason: z.string().trim().min(2).max(300).optional(),
});

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch((error) => {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid input" });
      }
      next(error);
    });

async function publicShop(shop: NonNullable<Awaited<ReturnType<typeof storage.getShopForUser>>>) {
  return {
    slug: shop.slug,
    name: shop.name,
    description: shop.description,
    themeColor: shop.themeColor,
    brandingImageUrl: await storage.getShopBrandingImage(shop.id) ? "/api/shop/branding-image" : "",
    isLive: shop.isLive,
    customDomain: shop.customDomain,
    collectionEnabled: shop.collectionEnabled,
    courierEnabled: shop.courierEnabled,
    lockersEnabled: shop.lockersEnabled,
    originAddress: shop.originAddress,
    senderName: shop.senderName,
    senderEmail: shop.senderEmail,
    senderPhone: shop.senderPhone,
    courierCredentialsConfigured: !!shop.courierAccessKeyEncrypted && !!shop.courierSecretEncrypted,
    whatsappConfigured: !!shop.whatsappPhoneNumberId && !!shop.whatsappAccessTokenEncrypted,
    whatsappPhoneNumberId: shop.whatsappPhoneNumberId ?? "",
    whatsappOrderTemplate: shop.whatsappOrderTemplate,
    whatsappTrackingTemplate: shop.whatsappTrackingTemplate,
    whatsappReminderTemplate: shop.whatsappReminderTemplate,
    whatsappTemplateLanguage: shop.whatsappTemplateLanguage,
  };
}

function courierCredentials(
  shop: NonNullable<Awaited<ReturnType<typeof storage.getShopForUser>>>,
  allowDisabledService = false,
) {
  if (!allowDisabledService && !shop.courierEnabled && !shop.lockersEnabled) {
    throw new Error("Enable Courier Guy delivery or lockers in Shop settings first.");
  }
  if (!shop.courierAccessKeyEncrypted || !shop.courierSecretEncrypted) {
    throw new Error("Courier Guy credentials are not configured for this shop.");
  }
  return {
    accessKey: decryptShopCredential(shop.courierAccessKeyEncrypted),
    secretKey: decryptShopCredential(shop.courierSecretEncrypted),
  };
}

function providerError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Courier Guy request failed";
  const status =
    message.startsWith("Courier Guy returned ") || message.startsWith("Could not reach Courier Guy") ? 502 : 400;
  return res.status(status).json({ message });
}

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

function decodeProductImage(image: unknown): ShopProductImage {
  const parsed = shopProductImageSchema.parse(image);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(parsed.data)) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, message: "Image data must be valid base64", path: ["image", "data"] }]);
  }
  const data = Buffer.from(parsed.data, "base64");
  if (!data.length || data.length > MAX_PRODUCT_IMAGE_BYTES || data.toString("base64") !== parsed.data) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, message: "Image must be no larger than 5 MB", path: ["image", "data"] }]);
  }

  const validSignature =
    (parsed.mimeType === "image/jpeg" && data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
    (parsed.mimeType === "image/png" && data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (parsed.mimeType === "image/gif" && data.subarray(0, 3).toString("ascii") === "GIF") ||
    (parsed.mimeType === "image/webp" &&
      data.length >= 12 &&
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP");
  if (!validSignature) {
    throw new z.ZodError([{ code: z.ZodIssueCode.custom, message: "Image content does not match its file type", path: ["image"] }]);
  }
  return { data, mimeType: parsed.mimeType };
}

function decodeBrandingImage(image: unknown): ShopBrandingImage {
  return decodeProductImage(image);
}

function productResponse(product: ShopProductView) {
  const { imageMimeType, ...fields } = product;
  return {
    ...fields,
    imagePreviewUrl: imageMimeType ? `/api/shop/products/${product.id}/image` : product.imageUrl,
  };
}

type CheckoutRate = { code: string; name: string; amountKobo: number };
type CheckoutQuote = {
  quoteId: string;
  shopId: number;
  slug: string;
  expiresAt: number;
  subtotalKobo: number;
  items: Array<{ productId: number; name: string; unitPriceKobo: number; quantity: number }>;
  method: "collection" | "courier" | "locker";
  customerDigest: string;
  delivery: ShopOrder["delivery"];
  rates: CheckoutRate[];
};

function checkoutCustomerDigest(customer: { name: string; email: string; phone: string }) {
  return crypto.createHash("sha256")
    .update(JSON.stringify([customer.name, customer.email, customer.phone]))
    .digest("hex");
}

const pickupWindowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  after: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  before: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
}).superRefine((schedule, ctx) => {
  const calendarDate = new Date(`${schedule.date}T00:00:00.000Z`);
  if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== schedule.date) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a valid pickup date", path: ["date"] });
  }
  if (schedule.before <= schedule.after) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup window end must be after its start", path: ["before"] });
  }
  const pickupAt = new Date(`${schedule.date}T${schedule.after}:00+02:00`);
  if (!Number.isFinite(pickupAt.getTime()) || pickupAt <= new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pickup must be scheduled for a future date and time", path: ["date"] });
  }
});

async function markShopOrderPaid(order: ShopOrder, transactionId: string) {
  if (order.status === "paid") return order;
  const shop = await storage.getShopById(order.shopId);
  if (!shop) throw new Error(`Shop ${order.shopId} for paid order ${order.reference} was not found.`);
  await enqueuePaidOrderNotifications(shop, order);
  return (await storage.updateShopOrder(order.reference, {
    status: "paid",
    paystackTransactionId: transactionId,
  })) ?? order;
}

function extractRateAmount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["amount", "value", "total", "rate", "price"]) {
    const amount = extractRateAmount(record[key]);
    if (amount !== undefined) return amount;
  }
}

function normalizeCourierRates(response: unknown): CheckoutRate[] {
  const rates: CheckoutRate[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const level = record.service_level && typeof record.service_level === "object"
      ? record.service_level as Record<string, unknown>
      : {};
    const code = record.service_level_code ?? record.serviceLevelCode ?? level.code ?? record.code;
    const name = record.service_level_name ?? record.serviceLevelName ?? level.name ?? record.name ?? code;
    const amount = extractRateAmount(record.total ?? record.amount ?? record.rate ?? record.price ?? record.cost);
    if (typeof code === "string" && code && typeof name === "string" && amount !== undefined) {
      const amountKobo = Math.round(amount * 100);
      if (Number.isSafeInteger(amountKobo)) rates.push({ code, name, amountKobo });
    }
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === "object") visit(nested);
    }
  };
  visit(response);
  return [...new Map(rates.map((rate) => [`${rate.code}:${rate.amountKobo}`, rate])).values()];
}

function checkoutParcels(
  items: CheckoutQuote["items"],
  products: Array<Pick<ShopProduct, "id" | "name" | "parcelLengthCm" | "parcelWidthCm" | "parcelHeightCm" | "parcelWeightKg">>,
) {
  const parcels: Array<{
    parcel_description: string;
    submitted_length_cm: number;
    submitted_width_cm: number;
    submitted_height_cm: number;
    submitted_weight_kg: number;
  }> = [];
  for (const item of items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (
      !product?.parcelLengthCm ||
      !product.parcelWidthCm ||
      !product.parcelHeightCm ||
      !product.parcelWeightKg
    ) {
      throw new Error(`Add package dimensions and weight to "${item.name}" before offering courier delivery.`);
    }
    for (let count = 0; count < item.quantity; count++) {
      parcels.push({
        parcel_description: item.name,
        submitted_length_cm: product.parcelLengthCm,
        submitted_width_cm: product.parcelWidthCm,
        submitted_height_cm: product.parcelHeightCm,
        submitted_weight_kg: product.parcelWeightKg,
      });
    }
  }
  if (parcels.length > 20) throw new Error("Courier Guy checkout supports up to 20 parcels per order.");
  return parcels;
}

function publicOrderStatus(order: ShopOrder) {
  return {
    reference: order.reference,
    status: order.status,
    amountKobo: order.amountKobo,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

function checkoutRateLimit(max: number, windowMs: number) {
  const clients = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip;
    const entry = clients.get(key);
    if (!entry || entry.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: "Too many checkout requests. Please try again later." });
    }
    return next();
  };
}

function paystackWebhookRouter() {
  const router = express.Router();
  router.post(
    "/",
    asyncRoute(async (req, res) => {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody) return res.status(400).json({ message: "Paystack webhook body is missing" });
      if (!verifyPaystackWebhookSignature(rawBody, req.get("x-paystack-signature"))) {
        return res.status(401).json({ message: "Invalid Paystack webhook signature" });
      }
      const event = req.body as { event?: unknown; data?: { reference?: unknown } };
      if (event.event !== "charge.success" || typeof event.data?.reference !== "string") {
        return res.json({ received: true });
      }
      const order = await storage.getShopOrderByReference(event.data.reference);
      if (!order || order.status === "paid") return res.json({ received: true });
      const payment = await verifyPaystackTransaction(order.reference);
      if (
        payment.status === "success" &&
        payment.reference === order.reference &&
        payment.amount === order.amountKobo &&
        payment.currency === order.currency
      ) {
        await markShopOrderPaid(order, String(payment.id));
      }
      return res.json({ received: true });
    }),
  );
  return router;
}

function storefrontRouter() {
  const router = express.Router();
  const checkoutLimiter = checkoutRateLimit(30, 15 * 60 * 1000);
  const quoteLimiter = checkoutRateLimit(15, 15 * 60 * 1000);
  const responseForShop = async (
    res: Response,
    shop: Awaited<ReturnType<typeof storage.getShopBySlug>>,
    brandingImagePath: string,
  ) => {
    if (!shop?.isLive) return res.status(404).json({ message: "Shop not found" });
    const products = await storage.listShopProducts(shop.id, true);
    const brandingImageUrl = await storage.getShopBrandingImage(shop.id) ? brandingImagePath : "";
    return res.json({
      shop: {
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        themeColor: shop.themeColor,
        brandingImageUrl,
        checkoutEnabled: isPaystackTestModeConfigured(),
        collectionEnabled: shop.collectionEnabled,
        courierEnabled: shop.courierEnabled,
        lockersEnabled: shop.lockersEnabled,
      },
      products: products.map(({ id, name, description, price, imageUrl, imageMimeType }) => ({
        id,
        name,
        description,
        price,
        imageUrl: imageMimeType ? `/api/storefront/${shop.slug}/products/${id}/image` : imageUrl,
      })),
    });
  };

  router.get(
    "/:slug/pickup-points",
    quoteLimiter,
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopBySlug(req.params.slug, true);
      if (!shop?.lockersEnabled) return res.status(404).json({ message: "Locker delivery is not available for this shop" });
      const { lat, lng } = courierPickupQuerySchema.parse({ ...req.query, type: "locker" });
      try {
        return res.json(await getPickupPoints(lat, lng, "locker"));
      } catch (error) {
        return providerError(res, error);
      }
    }),
  );
  router.post(
    "/:slug/checkout/quote",
    quoteLimiter,
    asyncRoute(async (req, res) => {
      const input = checkoutQuoteSchema.parse(req.body);
      const shop = await storage.getShopBySlug(req.params.slug, true);
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      if (!isPaystackTestModeConfigured()) {
        return res.status(503).json({ message: "Online checkout is not configured. The shop owner must add a Paystack test secret key." });
      }
      if (
        (input.method === "collection" && !shop.collectionEnabled) ||
        (input.method === "courier" && !shop.courierEnabled) ||
        (input.method === "locker" && !shop.lockersEnabled)
      ) {
        return res.status(400).json({ message: "That delivery method is not available for this shop" });
      }
      if (
        input.method === "courier" &&
        (!input.address?.street_address.trim() ||
          !input.address.local_area.trim() ||
          !input.address.city.trim() ||
          !input.address.zone.trim() ||
          !input.address.code.trim())
      ) {
        return res.status(400).json({ message: "Complete the delivery street, suburb, city, province and postal code." });
      }

      const quantities = new Map<number, number>();
      for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      const totalQuantity = [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0);
      if (totalQuantity > 20) return res.status(400).json({ message: "Checkout is limited to 20 items per order" });
      const products = await storage.listShopProducts(shop.id, true);
      const items = [...quantities].map(([productId, quantity]) => {
        const product = products.find((candidate) => candidate.id === productId);
        if (!product) throw new Error("A product in your basket is no longer available");
        return {
          productId,
          name: product.name,
          unitPriceKobo: Math.round(product.price * 100),
          quantity,
        };
      });
      const subtotalKobo = items.reduce((sum, item) => sum + item.unitPriceKobo * item.quantity, 0);
      if (!Number.isSafeInteger(subtotalKobo) || subtotalKobo <= 0) {
        return res.status(400).json({ message: "The basket total is invalid" });
      }
      const delivery: ShopOrder["delivery"] = {
        method: input.method,
        feeKobo: 0,
        ...(input.address ? { address: input.address } : {}),
        ...(input.pickupPoint ? { pickupPoint: input.pickupPoint } : {}),
      };

      let rates: CheckoutRate[];
      if (input.method === "collection") {
        rates = [{ code: "collection", name: "Collection", amountKobo: 0 }];
      } else {
        const parcels = checkoutParcels(items, products);
        delivery.parcels = parcels;
        delivery.deliveryContact = {
          name: input.deliveryContact.name,
          email: input.deliveryContact.email,
          mobile_number: input.deliveryContact.phone,
        };
        const credentials = courierCredentials(shop);
        let rawRates: unknown;
        try {
          rawRates = await getRates(credentials, shop.originAddress, {
            ...(input.method === "courier"
              ? { deliveryAddress: input.address }
              : { deliveryPickupPointId: input.pickupPoint!.id }),
            parcels,
            declaredValue: subtotalKobo / 100,
          });
        } catch (error) {
          return providerError(res, error);
        }
        rates = normalizeCourierRates(rawRates);
        if (!rates.length) {
          return res.status(502).json({ message: "Courier Guy did not return a selectable shipping rate. Please try again later." });
        }
      }

      const quote: CheckoutQuote = {
        quoteId: crypto.randomUUID(),
        shopId: shop.id,
        slug: shop.slug,
        expiresAt: Date.now() + 15 * 60 * 1000,
        subtotalKobo,
        items,
        method: input.method,
        customerDigest: checkoutCustomerDigest(input.deliveryContact),
        delivery,
        rates,
      };
      return res.json({
        quoteToken: createCheckoutQuoteToken(quote),
        expiresAt: quote.expiresAt,
        subtotalKobo,
        rates: rates.map(({ code, name, amountKobo }) => ({ code, name, amountKobo })),
      });
    }),
  );
  router.post(
    "/:slug/checkout/initialize",
    checkoutLimiter,
    asyncRoute(async (req, res) => {
      const input = checkoutPaymentSchema.parse(req.body);
      const quote = readCheckoutQuoteToken<CheckoutQuote>(input.quoteToken);
      if (quote.expiresAt < Date.now() || quote.slug !== req.params.slug) {
        return res.status(400).json({ message: "Your quote has expired. Please request a new one." });
      }
      const customerDigest = checkoutCustomerDigest(input.customer);
      if (customerDigest !== quote.customerDigest) {
        return res.status(400).json({ message: "Your contact details changed. Please request a new delivery quote." });
      }
      const shop = await storage.getShopBySlug(req.params.slug, true);
      if (!shop || shop.id !== quote.shopId) return res.status(404).json({ message: "Shop not found" });
      const reference = `CN_${quote.quoteId.replace(/-/g, "")}`;
      const existingOrder = await storage.getShopOrderByReference(reference);
      if (existingOrder) {
        if (existingOrder.paystackAuthorizationUrl && existingOrder.status === "pending") {
          return res.json({ authorizationUrl: existingOrder.paystackAuthorizationUrl, reference });
        }
        return res.status(409).json({ message: "This checkout has already been submitted. Please start a new checkout." });
      }

      const currentProducts = await storage.listShopProducts(shop.id, true);
      for (const item of quote.items) {
        const current = currentProducts.find((product) => product.id === item.productId);
        if (!current || Math.round(current.price * 100) !== item.unitPriceKobo) {
          return res.status(409).json({ message: "A product changed while you were checking out. Please request a new quote." });
        }
      }
      const selectedRate = quote.rates.find((rate) => rate.code === (input.serviceLevelCode ?? "collection"));
      if (!selectedRate) return res.status(400).json({ message: "Choose a valid delivery option from your quote." });
      if (
        (quote.method === "collection" && !shop.collectionEnabled) ||
        (quote.method === "courier" && !shop.courierEnabled) ||
        (quote.method === "locker" && !shop.lockersEnabled)
      ) {
        return res.status(409).json({ message: "This delivery method is no longer available." });
      }
      const delivery: ShopOrder["delivery"] = {
        ...quote.delivery,
        feeKobo: selectedRate.amountKobo,
        ...(quote.method !== "collection"
          ? { serviceLevelCode: selectedRate.code, serviceLevelName: selectedRate.name }
          : {}),
      };
      const amountKobo = quote.subtotalKobo + selectedRate.amountKobo;
      if (!Number.isSafeInteger(amountKobo) || amountKobo < 100) {
        return res.status(400).json({ message: "Paystack requires a payment of at least R1.00." });
      }

      await storage.createShopOrder({
        shopId: shop.id,
        quoteId: quote.quoteId,
        reference,
        status: "pending",
        amountKobo,
        currency: "ZAR",
        customer: {
          ...input.customer,
          ...(input.customer.whatsappUpdates ? { whatsappConsentAt: new Date().toISOString() } : {}),
        },
        items: quote.items.map(({ productId, name, unitPriceKobo, quantity }) => ({
          productId,
          name,
          unitPrice: unitPriceKobo / 100,
          quantity,
        })),
        delivery,
        paystackTransactionId: null,
        paystackAuthorizationUrl: null,
      });
      try {
        const transaction = await initializePaystackTransaction({
          email: input.customer.email,
          amountKobo,
          reference,
          callbackUrl: `${APP_URL}/store/${encodeURIComponent(shop.slug)}?reference=${encodeURIComponent(reference)}`,
          metadata: { shop: shop.slug, reference },
        });
        await storage.updateShopOrder(reference, { paystackAuthorizationUrl: transaction.authorization_url });
        return res.json({ authorizationUrl: transaction.authorization_url, reference });
      } catch (error) {
        await storage.updateShopOrder(reference, { status: "failed" });
        throw error;
      }
    }),
  );
  router.get(
    "/:slug/checkout/verify/:reference",
    checkoutLimiter,
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopBySlug(req.params.slug);
      const order = await storage.getShopOrderByReference(req.params.reference);
      if (!shop || !order || order.shopId !== shop.id) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") {
        const payment = await verifyPaystackTransaction(order.reference);
        if (payment.reference !== order.reference || payment.amount !== order.amountKobo || payment.currency !== order.currency) {
          return res.status(409).json({ message: "The Paystack payment does not match this order." });
        }
        if (payment.status === "success") {
          await markShopOrderPaid(order, String(payment.id));
        } else if (payment.status === "failed" || payment.status === "abandoned") {
          await storage.updateShopOrder(order.reference, { status: "failed" });
        }
      }
      const current = await storage.getShopOrderByReference(order.reference);
      return res.json(publicOrderStatus(current!));
    }),
  );

  router.get(
    "/domain/branding-image",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopByDomain(req.hostname.toLowerCase());
      if (!shop?.isLive) return res.status(404).end();
      const image = await storage.getShopBrandingImage(shop.id);
      if (!image) return res.status(404).end();
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(image.data);
    }),
  );
  router.get(
    "/domain",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopByDomain(req.hostname.toLowerCase());
      if (!shop?.isLive) return res.json({ shop: null, products: [] });
      return responseForShop(res, shop, "/api/storefront/domain/branding-image");
    }),
  );
  router.get(
    "/:slug/products/:id/image",
    asyncRoute(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) return res.status(404).end();
      const shop = await storage.getShopBySlug(req.params.slug, true);
      if (!shop) return res.status(404).end();
      const published = (await storage.listShopProducts(shop.id, true)).some((product) => product.id === id);
      if (!published) return res.status(404).end();
      const image = await storage.getShopProductImage(shop.id, id);
      if (!image) return res.status(404).end();
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(image.data);
    }),
  );

  router.get(
    "/:slug/branding-image",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopBySlug(req.params.slug, true);
      if (!shop) return res.status(404).end();
      const image = await storage.getShopBrandingImage(shop.id);
      if (!image) return res.status(404).end();
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(image.data);
    }),
  );
  router.get(
    "/:slug",
    asyncRoute(async (req, res) =>
      responseForShop(res, await storage.getShopBySlug(req.params.slug, true), `/api/storefront/${req.params.slug}/branding-image`),
    ),
  );
  return router;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupSession(app);
  app.use("/api/auth", authRouter());
  app.use("/api/paystack/webhook", paystackWebhookRouter());
  app.use("/api/storefront", storefrontRouter());

  // Prefix all routes with /api; everything below requires a signed-in user
  const router = express.Router();
  router.use(requireAuth);

  // === Tenant shop settings and catalogue ===
  router.get(
    "/shop",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      res.json(shop ? await publicShop(shop) : null);
    }),
  );
  router.get(
    "/shop/branding-image",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      if (!shop) return res.status(404).end();
      const image = await storage.getShopBrandingImage(shop.id);
      if (!image) return res.status(404).end();
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(image.data);
    }),
  );
  router.put(
    "/shop",
    asyncRoute(async (req, res) => {
      const userId = (req as any).user.id as number;
      const data = shopSettingsSchema.parse(req.body);
      const existing = await storage.getShopForUser(userId);
      const slugOwner = await storage.getShopBySlug(data.slug);
      if (slugOwner && slugOwner.userId !== userId) {
        return res.status(409).json({ message: "That shop address is already in use" });
      }
      if (data.customDomain) {
        const domainOwner = await storage.getShopByDomain(data.customDomain);
        if (domainOwner && domainOwner.userId !== userId) {
          return res.status(409).json({ message: "That custom domain is already connected to another shop" });
        }
      }

      let accessKeyEncrypted = data.clearCourierCredentials
        ? null
        : existing?.courierAccessKeyEncrypted ?? null;
      let secretEncrypted = data.clearCourierCredentials
        ? null
        : existing?.courierSecretEncrypted ?? null;
      if (data.courierAccessKey || data.courierSecret) {
        if (!data.courierAccessKey || !data.courierSecret) {
          return res.status(400).json({ message: "Enter both the Courier Guy access key and secret key" });
        }
        accessKeyEncrypted = encryptShopCredential(data.courierAccessKey);
        secretEncrypted = encryptShopCredential(data.courierSecret);
      }
      const whatsappPhoneNumberId = data.clearWhatsAppCredentials ? "" : data.whatsappPhoneNumberId;
      let whatsappTokenEncrypted = data.clearWhatsAppCredentials
        ? null
        : existing?.whatsappAccessTokenEncrypted ?? null;
      if (data.whatsappAccessToken) {
        if (!whatsappPhoneNumberId) {
          return res.status(400).json({ message: "Enter the WhatsApp phone number ID with its access token" });
        }
        whatsappTokenEncrypted = encryptShopSecret(data.whatsappAccessToken);
      }
      if (data.clearWhatsAppCredentials) whatsappTokenEncrypted = null;
      if (!!whatsappPhoneNumberId !== !!whatsappTokenEncrypted) {
        return res.status(400).json({ message: "WhatsApp phone number ID and access token must be configured or cleared together" });
      }
      for (const [label, template] of [
        ["order confirmation", data.whatsappOrderTemplate],
        ["tracking update", data.whatsappTrackingTemplate],
        ["pickup reminder", data.whatsappReminderTemplate],
      ] as const) {
        if (template && !/^[a-z0-9_]{1,512}$/.test(template)) {
          return res.status(400).json({ message: `Enter a valid approved WhatsApp ${label} template name` });
        }
      }
      if ((data.courierEnabled || data.lockersEnabled) && (!accessKeyEncrypted || !secretEncrypted) && data.isLive) {
        return res.status(400).json({ message: "Add Courier Guy credentials before publishing courier delivery" });
      }

      const {
        courierAccessKey,
        courierSecret,
        clearCourierCredentials,
        whatsappAccessToken,
        clearWhatsAppCredentials,
        ...settings
      } = data;
      const { brandingImage: uploadedBrandingImage, removeBrandingImage, ...shopSettings } = settings;
      if (removeBrandingImage && !existing) {
        return res.status(400).json({ message: "There is no saved branding image to remove" });
      }
      const shop = await storage.saveShop(userId, {
        ...shopSettings,
        customDomain: shopSettings.customDomain || null,
        whatsappPhoneNumberId,
        courierAccessKeyEncrypted: accessKeyEncrypted,
        courierSecretEncrypted: secretEncrypted,
        whatsappAccessTokenEncrypted: whatsappTokenEncrypted,
      }, uploadedBrandingImage
        ? decodeBrandingImage(uploadedBrandingImage)
        : removeBrandingImage
          ? null
          : undefined);
      return res.json(await publicShop(shop));
    }),
  );

  router.get(
    "/shop/products",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      res.json(shop ? (await storage.listShopProducts(shop.id)).map(productResponse) : []);
    }),
  );
  router.get(
    "/shop/products/:id/image",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      const id = Number(req.params.id);
      if (!shop || !Number.isSafeInteger(id) || id < 1) return res.status(404).end();
      const image = await storage.getShopProductImage(shop.id, id);
      if (!image) return res.status(404).end();
      res.set({
        "Content-Type": image.mimeType,
        "Content-Length": String(image.data.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      return res.send(image.data);
    }),
  );
  router.post(
    "/shop/products",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      if (!shop) return res.status(400).json({ message: "Save your shop settings before adding products" });
      const { image: uploadedImage, removeImage, ...product } = shopProductRequestSchema.parse(req.body);
      if (removeImage) return res.status(400).json({ message: "A new product has no existing image to remove" });
      const saved = await storage.createShopProduct(
        shop.id,
        product,
        uploadedImage ? decodeProductImage(uploadedImage) : undefined,
      );
      res.status(201).json(productResponse(saved));
    }),
  );
  router.patch(
    "/shop/products/:id",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      const id = Number(req.params.id);
      if (!shop || !Number.isSafeInteger(id) || id < 1) return res.status(404).json({ message: "Product not found" });
      const requestSchema = shopProductSchema.partial().extend({
        image: shopProductImageSchema.optional(),
        removeImage: z.boolean().optional(),
      }).refine((product) => !(product.image && product.removeImage), {
        message: "Choose an image or remove the current one, not both",
      });
      const { image: uploadedImage, removeImage, ...product } = requestSchema.parse(req.body);
      const imageChange = uploadedImage ? decodeProductImage(uploadedImage) : removeImage ? null : undefined;
      const updated = await storage.updateShopProduct(shop.id, id, product, imageChange);
      if (!updated) return res.status(404).json({ message: "Product not found" });
      res.json(productResponse(updated));
    }),
  );
  router.delete(
    "/shop/products/:id",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      const id = Number(req.params.id);
      if (!shop || !Number.isSafeInteger(id) || id < 1 || !(await storage.deleteShopProduct(shop.id, id))) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ ok: true });
    }),
  );
  router.get(
    "/shop/orders",
    asyncRoute(async (req, res) => {
      const shop = await storage.getShopForUser((req as any).user.id);
      if (!shop) return res.json([]);
      const orders = await storage.listShopOrders(shop.id);
      return res.json(orders.map(({ paystackAuthorizationUrl, ...order }) => order));
    }),
  );
  router.post(
    "/shop/orders/:reference/ship",
    asyncRoute(async (req, res) => {
      const pickupSchedule = pickupWindowSchema.parse(req.body);
      const shop = await storage.getShopForUser((req as any).user.id);
      const order = await storage.getShopOrderByReference(req.params.reference);
      if (!shop || !order || order.shopId !== shop.id) return res.status(404).json({ message: "Order not found" });
      if (order.status !== "paid") return res.status(409).json({ message: "Only paid orders can be shipped" });
      if (order.delivery.method === "collection") return res.status(400).json({ message: "Collection orders do not need a courier shipment" });
      if (order.delivery.shipment) return res.status(409).json({ message: "A Courier Guy shipment has already been created" });
      if (!order.delivery.parcels?.length || !order.delivery.deliveryContact) {
        return res.status(400).json({ message: "This order does not contain the courier details required to create a shipment" });
      }
      try {
        const shipment = await createShipment(
          courierCredentials(shop, true),
          shop.originAddress,
          {
            name: shop.senderName,
            mobile_number: shop.senderPhone,
            email: shop.senderEmail,
          },
          {
            ...(order.delivery.address ? { deliveryAddress: order.delivery.address } : {}),
            ...(order.delivery.pickupPoint ? { deliveryPickupPointId: order.delivery.pickupPoint.id } : {}),
            parcels: order.delivery.parcels,
            deliveryContact: order.delivery.deliveryContact,
            customerReference: order.reference,
            serviceLevelCode: order.delivery.serviceLevelCode,
            collectionMinDate: `${pickupSchedule.date}T00:00:00.000Z`,
            collectionAfter: pickupSchedule.after,
            collectionBefore: pickupSchedule.before,
          },
        );
        const delivery: ShopOrder["delivery"] = {
          ...order.delivery,
          shipment,
          ...(extractShipmentTrackingReference(shipment)
            ? { trackingReference: extractShipmentTrackingReference(shipment) }
            : {}),
          pickupSchedule: {
            ...pickupSchedule,
            timezone: "Africa/Johannesburg",
          },
        };
        const updated = await storage.updateShopOrder(order.reference, {
          delivery,
        });
        if (updated) await enqueuePickupReminders(shop, updated);
        return res.json(updated ? { reference: updated.reference, delivery: updated.delivery } : null);
      } catch (error) {
        return providerError(res, error);
      }
    }),
  );

  // === Courier Guy account API (AWS Signature Version 4) ===
  router.get(
    "/courier/pickup-points",
    asyncRoute(async (req, res) => {
      const { lat, lng, type } = courierPickupQuerySchema.parse(req.query);
      try {
        res.json(await getPickupPoints(lat, lng, type));
      } catch (error) {
        return providerError(res, error);
      }
    }),
  );
  router.post(
    "/courier/rates",
    asyncRoute(async (req, res) => {
      const input = courierRateSchema.parse(req.body);
      const shop = await storage.getShopForUser((req as any).user.id);
      if (!shop) return res.status(400).json({ message: "Set up your shop origin address first" });
      if (input.deliveryPickupPointId !== undefined && !shop.lockersEnabled) {
        return res.status(400).json({ message: "Enable locker delivery in Shop settings first" });
      }
      if (input.deliveryAddress && !shop.courierEnabled) {
        return res.status(400).json({ message: "Enable courier delivery in Shop settings first" });
      }
      try {
        res.json(await getRates(courierCredentials(shop), shop.originAddress, input));
      } catch (error) {
        return providerError(res, error);
      }
    }),
  );
  router.post(
    "/courier/shipments",
    asyncRoute(async (req, res) => {
      const input = courierShipmentSchema.parse(req.body);
      const shop = await storage.getShopForUser((req as any).user.id);
      if (!shop) return res.status(400).json({ message: "Set up your shop origin address first" });
      if (input.deliveryPickupPointId !== undefined && !shop.lockersEnabled) {
        return res.status(400).json({ message: "Enable locker delivery in Shop settings first" });
      }
      if (input.deliveryAddress && !shop.courierEnabled) {
        return res.status(400).json({ message: "Enable courier delivery in Shop settings first" });
      }
      try {
        const response = await createShipment(
          courierCredentials(shop),
          shop.originAddress,
          { name: shop.senderName, email: shop.senderEmail, mobile_number: shop.senderPhone },
          input,
        );
        res.status(201).json(response);
      } catch (error) {
        return providerError(res, error);
      }
    }),
  );
  
  // === Yarn routes ===
  
  // Get all yarns
  router.get("/yarns", async (req, res) => {
    const yarns = await storage.getAllYarns();
    res.json(yarns);
  });
  
  // Get yarn by ID
  router.get("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const yarn = await storage.getYarn(id);
    if (!yarn) {
      return res.status(404).json({ message: "Yarn not found" });
    }
    
    res.json(yarn);
  });
  
  // Create new yarn
  router.post("/yarns", async (req, res) => {
    try {
      const yarnData = insertYarnSchema.parse(req.body);
      const newYarn = await storage.createYarn(yarnData);
      
      // Log activity
      await storage.logActivity({
        type: "add_yarn",
        entityId: newYarn.id,
        description: `Added new yarn: ${newYarn.type} - ${newYarn.color}`
      });
      
      res.status(201).json(newYarn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid yarn data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create yarn" });
    }
  });
  
  // Update yarn
  router.patch("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    try {
      // First check if yarn exists
      const existingYarn = await storage.getYarn(id);
      if (!existingYarn) {
        return res.status(404).json({ message: "Yarn not found" });
      }
      
      // Validate partial data
      const { adjustmentReason, ...yarnData } = yarnUpdateRequestSchema.parse(req.body);
      const updatedYarn = await storage.updateYarn(id, yarnData);
      
      // Log activity
      await storage.logActivity({
        type: adjustmentReason ? "adjust_stock" : "update_yarn",
        entityId: id,
        description: adjustmentReason
          ? `${adjustmentReason}: ${updatedYarn!.type} - ${updatedYarn!.color} stock changed from ${existingYarn.quantityInStock} to ${updatedYarn!.quantityInStock} balls`
          : `Updated yarn: ${updatedYarn!.type} - ${updatedYarn!.color}`
      });
      
      res.json(updatedYarn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid yarn data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update yarn" });
    }
  });
  
  // Delete yarn
  router.delete("/yarns/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    // First check if yarn exists and get details for activity log
    const existingYarn = await storage.getYarn(id);
    if (!existingYarn) {
      return res.status(404).json({ message: "Yarn not found" });
    }
    
    const deleted = await storage.deleteYarn(id);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete yarn" });
    }
    
    // Log activity
    await storage.logActivity({
      type: "delete_yarn",
      entityId: id,
      description: `Deleted yarn: ${existingYarn.type} - ${existingYarn.color}`
    });
    
    res.status(204).end();
  });
  
  // Get low stock yarns
  router.get("/yarns/low-stock/:threshold", async (req, res) => {
    const threshold = parseInt(req.params.threshold);
    if (isNaN(threshold)) {
      return res.status(400).json({ message: "Invalid threshold format" });
    }
    
    const lowStockYarns = await storage.getLowStockYarns(threshold);
    res.json(lowStockYarns);
  });
  
  // === Project routes ===
  
  // Get all projects
  router.get("/projects", async (req, res) => {
    const projects = await storage.getAllProjects();
    res.json(projects);
  });
  
  // Get project by ID
  router.get("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const project = await storage.getProject(id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    res.json(project);
  });
  
  // Create new project
  router.post("/projects", async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const newProject = await storage.createProject(projectData);
      
      // Log activity
      await storage.logActivity({
        type: "add_project",
        entityId: newProject.id,
        description: `Added new project: ${newProject.name}`
      });
      
      res.status(201).json(newProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create project" });
    }
  });
  
  // Update project
  router.patch("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    try {
      // First check if project exists
      const existingProject = await storage.getProject(id);
      if (!existingProject) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Validate partial data
      const projectData = insertProjectSchema.partial().parse(req.body);
      const updatedProject = await storage.updateProject(id, projectData);
      
      // Log activity
      await storage.logActivity({
        type: "update_project",
        entityId: id,
        description: `Updated project: ${updatedProject!.name}`
      });
      
      res.json(updatedProject);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update project" });
    }
  });
  
  // Delete project
  router.delete("/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    // First check if project exists and get details for activity log
    const existingProject = await storage.getProject(id);
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const deleted = await storage.deleteProject(id);
    if (!deleted) {
      return res.status(500).json({ message: "Failed to delete project" });
    }
    
    // Log activity
    await storage.logActivity({
      type: "delete_project",
      entityId: id,
      description: `Deleted project: ${existingProject.name}`
    });
    
    res.status(204).end();
  });
  
  // === Price calculation routes ===
  
  // Get all calculations
  router.get("/calculations", async (req, res) => {
    const calculations = await storage.getAllCalculations();
    res.json(calculations);
  });
  
  // Get calculation by ID
  router.get("/calculations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    
    const calculation = await storage.getCalculation(id);
    if (!calculation) {
      return res.status(404).json({ message: "Calculation not found" });
    }
    
    res.json(calculation);
  });
  
  // Create new calculation
  router.post("/calculations", async (req, res) => {
    try {
      const calculationData = insertPriceCalculationSchema.parse(req.body);
      const newCalculation = await storage.createCalculation(calculationData);
      
      // Log activity
      await storage.logActivity({
        type: "calculate_price",
        entityId: newCalculation.id,
        description: `Calculated price for: ${newCalculation.itemName}`
      });
      
      res.status(201).json(newCalculation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid calculation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create calculation" });
    }
  });
  
  // === Activity log routes ===
  
  // Get recent activity
  router.get("/activity/:limit", async (req, res) => {
    const limit = parseInt(req.params.limit) || 10;
    const activities = await storage.getRecentActivity(limit);
    res.json(activities);
  });
  
  // === Dashboard summary routes ===
  
  // Get dashboard summary data
  router.get("/dashboard", async (req, res) => {
    try {
      const yarns = await storage.getAllYarns();
      const projects = await storage.getAllProjects();
      const calculations = await storage.getAllCalculations();
      const recentActivities = await storage.getRecentActivity(5);
      const lowStockYarns = await storage.getLowStockYarns(5);
      
      const totalYarns = yarns.length;
      const totalProjects = projects.length;
      const totalStockBalls = yarns.reduce((total, yarn) => total + yarn.quantityInStock, 0);
      const averagePrice =
        calculations.length > 0
          ? Number((calculations.reduce((sum, calculation) => sum + calculation.finalPrice, 0) / calculations.length).toFixed(2))
          : null;
      
      res.json({
        dataPersistence,
        totalYarns,
        totalStockBalls,
        totalProjects,
        averagePrice,
        pricingCalculationCount: calculations.length,
        recentActivities,
        lowStockYarns
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      res.status(500).json({ message: "Failed to load dashboard data" });
    }
  });

  // Register the router
  app.use("/api", router);
  startNotificationWorkers();
  
  const httpServer = createServer(app);
  return httpServer;
}
