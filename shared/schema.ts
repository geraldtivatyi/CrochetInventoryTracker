import { pgTable, text, serial, integer, real, boolean, timestamp, jsonb, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

// Yarn inventory table
export const yarns = pgTable("yarns", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  color: text("color").notNull(),
  colorHex: text("color_hex").notNull(),
  costPerBall: real("cost_per_ball").notNull(),
  quantityInStock: integer("quantity_in_stock").notNull(),
  notes: text("notes"),
});

export const insertYarnSchema = createInsertSchema(yarns).omit({
  id: true,
});

export type InsertYarn = z.infer<typeof insertYarnSchema>;
export type Yarn = typeof yarns.$inferSelect;

// Project templates table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  ballsNeeded: integer("balls_needed").notNull(),
  preferredYarnType: text("preferred_yarn_type"),
  timeToMake: real("time_to_make").notNull(),
  notes: text("notes"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Price calculations table
export const priceCalculations = pgTable("price_calculations", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  projectId: integer("project_id"),
  yarnId: integer("yarn_id"),
  ballsUsed: integer("balls_used").notNull(),
  additionalCosts: real("additional_costs").notNull().default(0),
  laborHours: real("labor_hours").notNull(),
  hourlyRate: real("hourly_rate").notNull(),
  markupPercentage: real("markup_percentage").notNull(),
  roundToNearest: boolean("round_to_nearest").notNull().default(false),
  materialCost: real("material_cost").notNull(),
  laborCost: real("labor_cost").notNull(),
  baseCost: real("base_cost").notNull(),
  markup: real("markup").notNull(),
  finalPrice: real("final_price").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPriceCalculationSchema = createInsertSchema(priceCalculations).omit({
  id: true,
  createdAt: true,
  // These will be calculated on the server
  materialCost: true,
  laborCost: true,
  baseCost: true,
  markup: true,
  finalPrice: true,
});

export type InsertPriceCalculation = z.infer<typeof insertPriceCalculationSchema>;
export type PriceCalculation = typeof priceCalculations.$inferSelect;

// Activity log table
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "add_yarn", "update_yarn", "delete_yarn", "add_project", etc.
  entityId: integer("entity_id").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  timestamp: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  otpEnabled: boolean("otp_enabled").notNull().default(false),
  isOwner: boolean("is_owner").notNull().default(false),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type PublicUser = Pick<User, "id" | "email" | "otpEnabled" | "isOwner">;

// One-time tokens: password resets and email OTP codes (only hashes are stored)
export const authTokens = pgTable("auth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  purpose: text("purpose").notNull(), // "password_reset" | "login_otp" | "enable_otp"
  tokenHash: text("token_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuthToken = typeof authTokens.$inferSelect;
export type TokenPurpose = "password_reset" | "login_otp" | "enable_otp";

export const shopAddressSchema = z.object({
  type: z.enum(["business", "residential"]).default("business"),
  company: z.string().trim().max(120).default(""),
  street_address: z.string().trim().max(180),
  local_area: z.string().trim().max(100),
  city: z.string().trim().max(100),
  zone: z.string().trim().max(100),
  country: z.string().trim().length(2).default("ZA"),
  code: z.string().trim().max(20),
});

export type ShopAddress = z.infer<typeof shopAddressSchema>;

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  themeColor: text("theme_color").notNull().default("#6b4f3f"),
  isLive: boolean("is_live").notNull().default(false),
  customDomain: text("custom_domain").unique(),
  collectionEnabled: boolean("collection_enabled").notNull().default(true),
  courierEnabled: boolean("courier_enabled").notNull().default(false),
  lockersEnabled: boolean("lockers_enabled").notNull().default(false),
  originAddress: jsonb("origin_address").$type<ShopAddress>().notNull(),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  senderPhone: text("sender_phone").notNull(),
  courierAccessKeyEncrypted: text("courier_access_key_encrypted"),
  courierSecretEncrypted: text("courier_secret_encrypted"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessTokenEncrypted: text("whatsapp_access_token_encrypted"),
  whatsappOrderTemplate: text("whatsapp_order_template").notNull().default(""),
  whatsappTrackingTemplate: text("whatsapp_tracking_template").notNull().default(""),
  whatsappReminderTemplate: text("whatsapp_reminder_template").notNull().default(""),
  whatsappTemplateLanguage: text("whatsapp_template_language").notNull().default("en_ZA"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Shop = typeof shops.$inferSelect;
export type ShopProduct = typeof shopProducts.$inferSelect;
export type ShopInput = Omit<
  Shop,
  | "id"
  | "userId"
  | "courierAccessKeyEncrypted"
  | "courierSecretEncrypted"
  | "whatsappAccessTokenEncrypted"
  | "createdAt"
  | "updatedAt"
>;

export const shopProducts = pgTable("shop_products", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: real("price").notNull(),
  parcelLengthCm: real("parcel_length_cm"),
  parcelWidthCm: real("parcel_width_cm"),
  parcelHeightCm: real("parcel_height_cm"),
  parcelWeightKg: real("parcel_weight_kg"),
  imageUrl: text("image_url").notNull().default(""),
  imageData: customType<{ data: Buffer | null; driverData: Buffer | null }>({
    dataType: () => "bytea",
  })("image_data"),
  imageMimeType: text("image_mime_type"),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const shopOrders = pgTable("shop_orders", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").notNull(),
  quoteId: text("quote_id").notNull().unique(),
  reference: text("reference").notNull().unique(),
  status: text("status").$type<"pending" | "paid" | "failed">().notNull().default("pending"),
  amountKobo: integer("amount_kobo").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  customer: jsonb("customer").$type<{
    name: string;
    email: string;
    phone: string;
    whatsappUpdates: boolean;
    whatsappConsentAt?: string;
  }>().notNull(),
  items: jsonb("items").$type<Array<{
    productId: number;
    name: string;
    unitPrice: number;
    quantity: number;
  }>>().notNull(),
  delivery: jsonb("delivery").$type<{
    method: "collection" | "courier" | "locker";
    feeKobo: number;
    address?: ShopAddress;
    pickupPoint?: { id: string | number; name: string; address?: string };
    serviceLevelCode?: string;
    serviceLevelName?: string;
    parcels?: Array<{
      parcel_description: string;
      submitted_length_cm: number;
      submitted_width_cm: number;
      submitted_height_cm: number;
      submitted_weight_kg: number;
    }>;
    deliveryContact?: { name: string; mobile_number: string; email: string };
    shipment?: unknown;
    trackingReference?: string;
    pickupSchedule?: {
      date: string;
      after: string;
      before: string;
      timezone: "Africa/Johannesburg";
    };
    tracking?: {
      status: string;
      latestEvent: string;
      estimatedDelivery: string;
      lastCheckedAt: string;
    };
  }>().notNull(),
  paystackTransactionId: text("paystack_transaction_id"),
  paystackAuthorizationUrl: text("paystack_authorization_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ShopOrder = typeof shopOrders.$inferSelect;

export const notificationJobs = pgTable("notification_jobs", {
  id: serial("id").primaryKey(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  shopId: integer("shop_id").notNull(),
  orderReference: text("order_reference").notNull(),
  channel: text("channel").$type<"email" | "whatsapp">().notNull(),
  kind: text("kind").$type<"order_receipt" | "tracking_update" | "pickup_reminder">().notNull(),
  recipient: text("recipient").notNull(),
  payload: jsonb("payload").$type<Record<string, string | string[]>>().notNull(),
  runAt: timestamp("run_at").notNull(),
  status: text("status").$type<"queued" | "sending" | "sent" | "failed">().notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type NotificationJob = typeof notificationJobs.$inferSelect;

export const shopSettingsSchema = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(""),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid 6-digit hex color").default("#6b4f3f"),
  brandingImage: z.object({
    data: z.string().min(1).max(7_000_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  }).optional(),
  removeBrandingImage: z.boolean().optional(),
  isLive: z.boolean(),
  customDomain: z.string().trim().toLowerCase().max(253).nullable().optional(),
  collectionEnabled: z.boolean(),
  courierEnabled: z.boolean(),
  lockersEnabled: z.boolean(),
  originAddress: shopAddressSchema,
  senderName: z.string().trim().max(120).default(""),
  senderEmail: z.union([emailSchema, z.literal("")]).default(""),
  senderPhone: z.string().trim().max(30).default(""),
  courierAccessKey: z.string().trim().max(200).optional(),
  courierSecret: z.string().max(500).optional(),
  clearCourierCredentials: z.boolean().optional(),
  whatsappPhoneNumberId: z.string().trim().max(100).default(""),
  whatsappAccessToken: z.string().trim().max(2000).optional(),
  clearWhatsAppCredentials: z.boolean().optional(),
  whatsappOrderTemplate: z.string().trim().max(512).default(""),
  whatsappTrackingTemplate: z.string().trim().max(512).default(""),
  whatsappReminderTemplate: z.string().trim().max(512).default(""),
  whatsappTemplateLanguage: z.string().trim().regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/).default("en_ZA"),
}).refine(
  (shop) => !shop.isLive || shop.collectionEnabled || shop.courierEnabled || shop.lockersEnabled,
  { message: "Enable at least one fulfilment option before publishing", path: ["isLive"] },
).refine(
  (shop) => !shop.customDomain || /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(shop.customDomain),
  { message: "Enter a valid custom hostname", path: ["customDomain"] },
).superRefine((shop, ctx) => {
  if (shop.brandingImage && shop.removeBrandingImage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a new branding image or remove the current one, not both",
      path: ["brandingImage"],
    });
  }
  if (!shop.courierEnabled && !shop.lockersEnabled) return;
  const requiredFields: Array<[keyof ShopAddress, string]> = [
    ["street_address", "Street address"],
    ["local_area", "Local area"],
    ["city", "City"],
    ["zone", "Province or zone"],
    ["code", "Postal code"],
  ];
  for (const [field, label] of requiredFields) {
    if (!shop.originAddress[field].trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required for Courier Guy delivery`, path: ["originAddress", field] });
    }
  }
  if (!shop.senderName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sender contact name is required for Courier Guy delivery", path: ["senderName"] });
  }
  if (!emailSchema.safeParse(shop.senderEmail).success) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid sender email for Courier Guy delivery", path: ["senderEmail"] });
  }
  if (shop.senderPhone.length < 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Sender phone is required for Courier Guy delivery", path: ["senderPhone"] });
  }
});

export const shopProductSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  price: z.number().finite().positive().max(10000000),
  parcelLengthCm: z.number().finite().positive().max(300).nullable().default(null),
  parcelWidthCm: z.number().finite().positive().max(300).nullable().default(null),
  parcelHeightCm: z.number().finite().positive().max(300).nullable().default(null),
  parcelWeightKg: z.number().finite().positive().max(70).nullable().default(null),
  imageUrl: z.string().trim().url().max(2048).refine((url) => /^https?:\/\//i.test(url)).or(z.literal("")).default(""),
  isPublished: z.boolean().default(false),
});

export const checkoutCartItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
});

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  phone: z.string().trim().min(5).max(30),
  whatsappUpdates: z.boolean().default(false),
});

export const checkoutQuoteSchema = z.object({
  items: z.array(checkoutCartItemSchema).min(1).max(20),
  method: z.enum(["collection", "courier", "locker"]),
  address: shopAddressSchema.optional(),
  pickupPoint: z.object({
    id: z.union([z.string().min(1).max(100), z.number().int().positive()]),
    name: z.string().trim().min(1).max(180),
    address: z.string().trim().max(500).optional(),
  }).optional(),
  deliveryContact: checkoutCustomerSchema,
}).superRefine((checkout, ctx) => {
  if (checkout.method === "courier" && !checkout.address) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a delivery address", path: ["address"] });
  }
  if (checkout.method === "locker" && !checkout.pickupPoint) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose a pickup point", path: ["pickupPoint"] });
  }
});

export const checkoutPaymentSchema = z.object({
  quoteToken: z.string().min(20).max(10000),
  customer: checkoutCustomerSchema,
  serviceLevelCode: z.string().max(100).optional(),
});

export const shopProductImageSchema = z.object({
  data: z.string().min(1).max(7_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

export const shopProductRequestSchema = shopProductSchema.extend({
  image: shopProductImageSchema.optional(),
  removeImage: z.boolean().optional(),
}).refine((product) => !(product.image && product.removeImage), {
  message: "Choose an image or remove the current one, not both",
});

export const courierParcelSchema = z.object({
  parcel_description: z.string().trim().max(120).default("Crochet item"),
  submitted_length_cm: z.number().positive().max(300),
  submitted_width_cm: z.number().positive().max(300),
  submitted_height_cm: z.number().positive().max(300),
  submitted_weight_kg: z.number().positive().max(70),
});

const courierRateFields = z.object({
  deliveryAddress: shopAddressSchema.optional(),
  deliveryPickupPointId: z.union([z.string(), z.number()]).optional(),
  parcels: z.array(courierParcelSchema).min(1).max(20),
  declaredValue: z.number().nonnegative().max(10000000).optional(),
  collectionMinDate: z.string().date().optional(),
  deliveryMinDate: z.string().date().optional(),
});

const courierDeliveryChoice = (value: z.infer<typeof courierRateFields>) =>
  !!value.deliveryAddress !== (value.deliveryPickupPointId !== undefined);
const courierDeliveryChoiceError = {
  message: "Choose either a delivery address or a Courier Guy pickup point",
};

export const courierRateSchema = courierRateFields.refine(courierDeliveryChoice, courierDeliveryChoiceError);

export const courierShipmentSchema = courierRateFields.extend({
  deliveryContact: z.object({
    name: z.string().trim().min(1).max(120),
    mobile_number: z.string().trim().min(5).max(30),
    email: emailSchema,
  }),
  customerReference: z.string().trim().max(100).optional(),
  serviceLevelCode: z.string().trim().max(80).optional(),
  specialInstructions: z.string().trim().max(500).optional(),
}).refine(courierDeliveryChoice, courierDeliveryChoiceError);

export const courierPickupQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  type: z.enum(["locker", "counter", "point"]).default("locker"),
});

export const PASSWORD_MIN_LENGTH = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export const setupSchema = z.object({ email: emailSchema, password: passwordSchema });
export const inviteSchema = z.object({ email: emailSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  email: emailSchema,
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
export const otpCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
export const disableOtpSchema = z.object({ password: z.string().min(1).max(200) });
