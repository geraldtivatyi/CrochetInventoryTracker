import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  Yarn,
  InsertYarn,
  Project,
  InsertProject,
  PriceCalculation,
  InsertPriceCalculation,
  ActivityLog,
  InsertActivityLog,
  User,
  AuthToken,
  TokenPurpose,
  Shop,
  ShopOrder,
  NotificationJob,
  users,
  authTokens,
  shops,
  shopProducts,
  shopOrders,
  notificationJobs,
  yarns,
  projects,
  priceCalculations,
  activityLogs
} from "@shared/schema";
import { eq, lte, desc, and, or, sql, count } from "drizzle-orm";
import {
  IStorage,
  type ShopRecord,
  type ShopBrandingImage,
  type ShopProductImage,
  type ShopProductRecord,
  type ShopProductView,
} from "./storage";

const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("A database connection string is required.");
}

// Support both Neon (neon-http) and a local Postgres connection using node-postgres.
export let db: any;

if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
  // Use node-postgres + drizzle node-postgres adapter for local Postgres
  const { Pool } = await import("pg");
  const { drizzle: drizzlePg } = await import("drizzle-orm/node-postgres");
  const pool = new Pool({ connectionString: databaseUrl });
  db = drizzlePg(pool);
} else {
  // Assume Neon HTTP connection string
  const sql = neon(databaseUrl);
  db = drizzleNeon(sql);
}

const ensureAuthTables = (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    otp_enabled boolean NOT NULL DEFAULT false,
    is_owner boolean NOT NULL DEFAULT false,
    failed_login_attempts integer NOT NULL DEFAULT 0,
    locked_until timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false`);
  // The earliest account is the owner if none has been flagged yet
  await db.execute(sql`UPDATE users SET is_owner = true
    WHERE id = (SELECT MIN(id) FROM users) AND NOT EXISTS (SELECT 1 FROM users WHERE is_owner)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS auth_tokens (
    id serial PRIMARY KEY,
    user_id integer NOT NULL,
    purpose text NOT NULL,
    token_hash text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`);
})();

const ensureShopTables = (async () => {
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shops (
    id serial PRIMARY KEY,
    user_id integer NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    theme_color text NOT NULL DEFAULT '#6b4f3f',
    is_live boolean NOT NULL DEFAULT false,
    custom_domain text UNIQUE,
    collection_enabled boolean NOT NULL DEFAULT true,
    courier_enabled boolean NOT NULL DEFAULT false,
    lockers_enabled boolean NOT NULL DEFAULT false,
    origin_address jsonb NOT NULL,
    sender_name text NOT NULL,
    sender_email text NOT NULL,
    sender_phone text NOT NULL,
    courier_access_key_encrypted text,
    courier_secret_encrypted text,
    whatsapp_phone_number_id text,
    whatsapp_access_token_encrypted text,
    whatsapp_order_template text NOT NULL DEFAULT '',
    whatsapp_tracking_template text NOT NULL DEFAULT '',
    whatsapp_reminder_template text NOT NULL DEFAULT '',
    whatsapp_template_language text NOT NULL DEFAULT 'en_ZA',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_products (
    id serial PRIMARY KEY,
    shop_id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    price real NOT NULL,
    image_url text NOT NULL DEFAULT '',
    image_data bytea,
    image_mime_type text,
    is_published boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS image_data bytea`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS image_mime_type text`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT '#6b4f3f'`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id text`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_access_token_encrypted text`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_order_template text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_tracking_template text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_reminder_template text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE shops ADD COLUMN IF NOT EXISTS whatsapp_template_language text NOT NULL DEFAULT 'en_ZA'`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS parcel_length_cm real`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS parcel_width_cm real`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS parcel_height_cm real`);
  await db.execute(sql`ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS parcel_weight_kg real`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_branding_images (
    shop_id integer PRIMARY KEY,
    image_data bytea NOT NULL,
    image_mime_type text NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS shop_orders (
    id serial PRIMARY KEY,
    shop_id integer NOT NULL,
    quote_id text NOT NULL UNIQUE,
    reference text NOT NULL UNIQUE,
    status text NOT NULL DEFAULT 'pending',
    amount_kobo integer NOT NULL,
    currency text NOT NULL DEFAULT 'ZAR',
    customer jsonb NOT NULL,
    items jsonb NOT NULL,
    delivery jsonb NOT NULL,
    paystack_transaction_id text,
    paystack_authorization_url text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS notification_jobs (
    id serial PRIMARY KEY,
    dedupe_key text NOT NULL UNIQUE,
    shop_id integer NOT NULL,
    order_reference text NOT NULL,
    channel text NOT NULL,
    kind text NOT NULL,
    recipient text NOT NULL,
    payload jsonb NOT NULL,
    run_at timestamp NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`);
})();

export class DatabaseStorage implements IStorage {
  async countUsers() {
    await ensureAuthTables;
    const r = await db.select({ n: count() }).from(users);
    return Number(r[0].n);
  }
  async getUserById(id: number): Promise<User | undefined> {
    await ensureAuthTables;
    return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    await ensureAuthTables;
    return (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  }
  async listUsers(): Promise<User[]> {
    await ensureAuthTables;
    return await db.select().from(users).orderBy(users.id);
  }
  async createUser(email: string, passwordHash: string, isOwner = false): Promise<User> {
    await ensureAuthTables;
    return (await db.insert(users).values({ email, passwordHash, isOwner }).returning())[0];
  }
  async deleteUser(id: number) {
    await this.deleteTokens(id);
    await db.delete(users).where(eq(users.id, id));
  }
  async updateUser(id: number, data: Partial<User>) {
    await db.update(users).set(data).where(eq(users.id, id));
  }
  async saveToken(userId: number, purpose: TokenPurpose, tokenHash: string, expiresAt: Date) {
    await this.deleteTokens(userId, purpose);
    await db.insert(authTokens).values({ userId, purpose, tokenHash, expiresAt });
  }
  async getToken(userId: number, purpose: TokenPurpose): Promise<AuthToken | undefined> {
    return (
      await db
        .select()
        .from(authTokens)
        .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)))
        .limit(1)
    )[0];
  }
  async incrementTokenAttempts(id: number) {
    await db.update(authTokens).set({ attempts: sql`${authTokens.attempts} + 1` }).where(eq(authTokens.id, id));
  }
  async deleteTokens(userId: number, purpose?: TokenPurpose) {
    await ensureAuthTables;
    await db
      .delete(authTokens)
      .where(purpose ? and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)) : eq(authTokens.userId, userId));
  }

  async getShopForUser(userId: number): Promise<Shop | undefined> {
    await ensureShopTables;
    return (await db.select().from(shops).where(eq(shops.userId, userId)).limit(1))[0];
  }
  async getShopById(shopId: number): Promise<Shop | undefined> {
    await ensureShopTables;
    return (await db.select().from(shops).where(eq(shops.id, shopId)).limit(1))[0];
  }
  async getShopBySlug(slug: string, liveOnly = false): Promise<Shop | undefined> {
    await ensureShopTables;
    return (
      await db
        .select()
        .from(shops)
        .where(liveOnly ? and(eq(shops.slug, slug), eq(shops.isLive, true)) : eq(shops.slug, slug))
        .limit(1)
    )[0];
  }
  async getShopByDomain(domain: string): Promise<Shop | undefined> {
    await ensureShopTables;
    return (await db.select().from(shops).where(eq(shops.customDomain, domain)).limit(1))[0];
  }
  async saveShop(
    userId: number,
    data: ShopRecord,
    brandingImage?: ShopBrandingImage | null,
  ): Promise<Shop> {
    await ensureShopTables;
    const values = { ...data, userId, updatedAt: new Date() };
    const rows = await db
      .insert(shops)
      .values(values)
      .onConflictDoUpdate({ target: shops.userId, set: values })
      .returning();
    if (brandingImage !== undefined) {
      if (brandingImage) {
        await db.execute(sql`INSERT INTO shop_branding_images
          (shop_id, image_data, image_mime_type, updated_at)
          VALUES (${rows[0].id}, decode(${brandingImage.data.toString("base64")}, 'base64'), ${brandingImage.mimeType}, now())
          ON CONFLICT (shop_id) DO UPDATE SET
            image_data = EXCLUDED.image_data,
            image_mime_type = EXCLUDED.image_mime_type,
            updated_at = now()`);
      } else {
        await db.execute(sql`DELETE FROM shop_branding_images WHERE shop_id = ${rows[0].id}`);
      }
    }
    return rows[0];
  }
  async getShopBrandingImage(shopId: number): Promise<ShopBrandingImage | undefined> {
    await ensureShopTables;
    const image = (
      await db.execute(sql`SELECT encode(image_data, 'base64') AS data, image_mime_type AS "mimeType"
        FROM shop_branding_images WHERE shop_id = ${shopId} LIMIT 1`)
    ).rows[0] as { data: string; mimeType: string } | undefined;
    if (!image?.data || !image.mimeType) return undefined;
    return { data: Buffer.from(image.data, "base64"), mimeType: image.mimeType };
  }
  async listShopProducts(shopId: number, publishedOnly = false): Promise<ShopProductView[]> {
    await ensureShopTables;
    return await db
      .select({
        id: shopProducts.id,
        shopId: shopProducts.shopId,
        name: shopProducts.name,
        description: shopProducts.description,
        price: shopProducts.price,
        parcelLengthCm: shopProducts.parcelLengthCm,
        parcelWidthCm: shopProducts.parcelWidthCm,
        parcelHeightCm: shopProducts.parcelHeightCm,
        parcelWeightKg: shopProducts.parcelWeightKg,
        imageUrl: shopProducts.imageUrl,
        imageMimeType: shopProducts.imageMimeType,
        isPublished: shopProducts.isPublished,
        createdAt: shopProducts.createdAt,
        updatedAt: shopProducts.updatedAt,
      })
      .from(shopProducts)
      .where(publishedOnly ? and(eq(shopProducts.shopId, shopId), eq(shopProducts.isPublished, true)) : eq(shopProducts.shopId, shopId))
      .orderBy(desc(shopProducts.createdAt));
  }
  async createShopProduct(
    shopId: number,
    data: ShopProductRecord,
    image?: ShopProductImage,
  ): Promise<ShopProductView> {
    await ensureShopTables;
    const created = (
      await db
        .insert(shopProducts)
        .values({
          ...data,
          shopId,
          ...(image
            ? {
                imageData: sql`decode(${image.data.toString("base64")}, 'base64')`,
                imageMimeType: image.mimeType,
              }
            : {}),
        })
        .returning({ id: shopProducts.id })
    )[0];
    return (await this.listShopProducts(shopId)).find((product) => product.id === created.id)!;
  }
  async updateShopProduct(
    shopId: number,
    id: number,
    data: Partial<ShopProductRecord>,
    image?: ShopProductImage | null,
  ): Promise<ShopProductView | undefined> {
    await ensureShopTables;
    const updated =     await db
      .update(shopProducts)
      .set({
        ...data,
        ...(image !== undefined
          ? {
              imageData: image ? sql`decode(${image.data.toString("base64")}, 'base64')` : null,
              imageMimeType: image?.mimeType ?? null,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(shopProducts.shopId, shopId), eq(shopProducts.id, id)))
      .returning({ id: shopProducts.id });
    if (!updated.length) return undefined;
    return (await this.listShopProducts(shopId)).find((product) => product.id === id);
  }
  async getShopProductImage(shopId: number, id: number): Promise<ShopProductImage | undefined> {
    await ensureShopTables;
    const image = (
      await db
        .select({
          data: sql<string>`encode(${shopProducts.imageData}, 'base64')`,
          mimeType: shopProducts.imageMimeType,
        })
        .from(shopProducts)
        .where(and(eq(shopProducts.shopId, shopId), eq(shopProducts.id, id)))
        .limit(1)
    )[0];
    if (!image?.data || !image.mimeType) return undefined;
    return { data: Buffer.from(image.data, "base64"), mimeType: image.mimeType };
  }
  async deleteShopProduct(shopId: number, id: number): Promise<boolean> {
    await ensureShopTables;
    return (
      await db.delete(shopProducts).where(and(eq(shopProducts.shopId, shopId), eq(shopProducts.id, id))).returning()
    ).length > 0;
  }
  async createShopOrder(data: Omit<ShopOrder, "id" | "createdAt" | "updatedAt">): Promise<ShopOrder> {
    await ensureShopTables;
    return (await db.insert(shopOrders).values(data).returning())[0];
  }
  async getShopOrderByReference(reference: string): Promise<ShopOrder | undefined> {
    await ensureShopTables;
    return (await db.select().from(shopOrders).where(eq(shopOrders.reference, reference)).limit(1))[0];
  }
  async listShopOrders(shopId: number): Promise<ShopOrder[]> {
    await ensureShopTables;
    return await db.select().from(shopOrders).where(eq(shopOrders.shopId, shopId)).orderBy(desc(shopOrders.createdAt));
  }
  async updateShopOrder(
    reference: string,
    data: Partial<Pick<ShopOrder, "status" | "paystackTransactionId" | "paystackAuthorizationUrl" | "delivery">>,
  ): Promise<ShopOrder | undefined> {
    await ensureShopTables;
    return (await db.update(shopOrders).set({ ...data, updatedAt: new Date() })
      .where(eq(shopOrders.reference, reference)).returning())[0];
  }
  async enqueueNotification(data: Omit<NotificationJob, "id" | "createdAt" | "updatedAt">): Promise<void> {
    await ensureShopTables;
    await db.insert(notificationJobs).values(data).onConflictDoNothing({ target: notificationJobs.dedupeKey });
  }
  async claimDueNotificationJobs(now: Date, limit: number): Promise<NotificationJob[]> {
    await ensureShopTables;
    const reclaimBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const candidates = await db.select().from(notificationJobs)
      .where(or(
        and(eq(notificationJobs.status, "queued"), lte(notificationJobs.runAt, now)),
        and(eq(notificationJobs.status, "sending"), lte(notificationJobs.updatedAt, reclaimBefore)),
      ))
      .orderBy(notificationJobs.runAt).limit(limit);
    const claimed: NotificationJob[] = [];
    for (const candidate of candidates) {
      const job = (await db.update(notificationJobs)
        .set({ status: "sending", attempts: candidate.attempts + 1, updatedAt: now })
        .where(and(
          eq(notificationJobs.id, candidate.id),
          eq(notificationJobs.status, candidate.status),
          candidate.status === "queued"
            ? lte(notificationJobs.runAt, now)
            : lte(notificationJobs.updatedAt, reclaimBefore),
        ))
        .returning())[0];
      if (job) claimed.push(job);
    }
    return claimed;
  }
  async updateNotificationJob(
    id: number,
    data: Partial<Pick<NotificationJob, "status" | "runAt" | "lastError">>,
  ): Promise<void> {
    await ensureShopTables;
    await db.update(notificationJobs).set({ ...data, updatedAt: new Date() })
      .where(eq(notificationJobs.id, id));
  }
  async listOrdersForTracking(): Promise<Array<{ shop: Shop; order: ShopOrder }>> {
    await ensureShopTables;
    const [orders, allShops] = await Promise.all([
      db.select().from(shopOrders).where(eq(shopOrders.status, "paid")),
      db.select().from(shops),
    ]);
    const shopById = new Map<number, Shop>(allShops.map((shop: Shop) => [shop.id, shop]));
    return orders.flatMap((order: ShopOrder) => {
      const shop = shopById.get(order.shopId);
      return shop && order.delivery.shipment ? [{ shop, order }] : [];
    });
  }

  // Yarn methods
  async getAllYarns(): Promise<Yarn[]> {
    return await db.select().from(yarns);
  }

  async getYarn(id: number): Promise<Yarn | undefined> {
    const result = await db.select().from(yarns).where(eq(yarns.id, id)).limit(1);
    return result[0];
  }

  async createYarn(yarn: InsertYarn): Promise<Yarn> {
    const result = await db.insert(yarns).values(yarn).returning();
    return result[0];
  }

  async updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined> {
    const result = await db.update(yarns).set(yarn).where(eq(yarns.id, id)).returning();
    return result[0];
  }

  async deleteYarn(id: number): Promise<boolean> {
    const result = await db.delete(yarns).where(eq(yarns.id, id));
    return result.rowCount > 0;
  }

  async getLowStockYarns(threshold: number): Promise<Yarn[]> {
    return await db.select().from(yarns).where(lte(yarns.quantityInStock, threshold));
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0];
  }

  async createProject(project: InsertProject): Promise<Project> {
    const result = await db.insert(projects).values(project).returning();
    return result[0];
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
    return result[0];
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  // Price calculation methods
  async getAllCalculations(): Promise<PriceCalculation[]> {
    return await db.select().from(priceCalculations);
  }

  async getCalculation(id: number): Promise<PriceCalculation | undefined> {
    const result = await db.select().from(priceCalculations).where(eq(priceCalculations.id, id)).limit(1);
    return result[0];
  }

  async createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation> {
    // Calculate the prices
    let materialCost = calculation.additionalCosts || 0;
    
    if (calculation.yarnId) {
      const yarn = await this.getYarn(calculation.yarnId);
      if (yarn) {
        materialCost += calculation.ballsUsed * yarn.costPerBall;
      }
    }
    
    const laborCost = calculation.laborHours * calculation.hourlyRate;
    const baseCost = materialCost + laborCost;
    const markup = baseCost * (calculation.markupPercentage / 100);
    let finalPrice = baseCost + markup;
    
    // Round to nearest R5 if requested
    if (calculation.roundToNearest) {
      finalPrice = Math.ceil(finalPrice / 5) * 5;
    }
    
    const calculationWithPrices = {
      ...calculation,
      materialCost,
      laborCost,
      baseCost,
      markup,
      finalPrice
    };
    
    const result = await db.insert(priceCalculations).values([calculationWithPrices]).returning();
    return result[0];
  }

  // Activity log methods
  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs).orderBy(desc(activityLogs.timestamp)).limit(limit);
  }

  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(activity).returning();
    return result[0];
  }
}