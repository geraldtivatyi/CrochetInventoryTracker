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
  ShopProduct,
} from "@shared/schema";

export type ShopRecord = Omit<Shop, "id" | "userId" | "createdAt" | "updatedAt">;
export type ShopProductRecord = Omit<
  ShopProduct,
  "id" | "shopId" | "imageData" | "imageMimeType" | "createdAt" | "updatedAt"
>;
export type ShopProductView = Omit<ShopProduct, "imageData">;
export type ShopProductImage = { data: Buffer; mimeType: string };
export type ShopBrandingImage = ShopProductImage;

function withoutProductImageData(product: ShopProduct): ShopProductView {
  const { imageData, ...view } = product;
  void imageData;
  return view;
}

export interface IStorage {
  // Auth Methods
  countUsers(): Promise<number>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  createUser(email: string, passwordHash: string, isOwner?: boolean): Promise<User>;
  deleteUser(id: number): Promise<void>;
  updateUser(
    id: number,
    data: Partial<Pick<User, "passwordHash" | "otpEnabled" | "failedLoginAttempts" | "lockedUntil">>
  ): Promise<void>;
  // Replaces any existing token with the same user and purpose
  saveToken(userId: number, purpose: TokenPurpose, tokenHash: string, expiresAt: Date): Promise<void>;
  getToken(userId: number, purpose: TokenPurpose): Promise<AuthToken | undefined>;
  incrementTokenAttempts(id: number): Promise<void>;
  deleteTokens(userId: number, purpose?: TokenPurpose): Promise<void>;

  // Each account owns an isolated shop and product catalogue
  getShopForUser(userId: number): Promise<Shop | undefined>;
  getShopById(shopId: number): Promise<Shop | undefined>;
  getShopBySlug(slug: string, liveOnly?: boolean): Promise<Shop | undefined>;
  getShopByDomain(domain: string): Promise<Shop | undefined>;
  saveShop(userId: number, shop: ShopRecord, brandingImage?: ShopBrandingImage | null): Promise<Shop>;
  getShopBrandingImage(shopId: number): Promise<ShopBrandingImage | undefined>;
  listShopProducts(shopId: number, publishedOnly?: boolean): Promise<ShopProductView[]>;
  createShopProduct(shopId: number, product: ShopProductRecord, image?: ShopProductImage): Promise<ShopProductView>;
  updateShopProduct(
    shopId: number,
    id: number,
    product: Partial<ShopProductRecord>,
    image?: ShopProductImage | null,
  ): Promise<ShopProductView | undefined>;
  getShopProductImage(shopId: number, id: number): Promise<ShopProductImage | undefined>;
  deleteShopProduct(shopId: number, id: number): Promise<boolean>;
  createShopOrder(order: Omit<ShopOrder, "id" | "createdAt" | "updatedAt">): Promise<ShopOrder>;
  getShopOrderByReference(reference: string): Promise<ShopOrder | undefined>;
  listShopOrders(shopId: number): Promise<ShopOrder[]>;
  updateShopOrder(
    reference: string,
    data: Partial<Pick<ShopOrder, "status" | "paystackTransactionId" | "paystackAuthorizationUrl" | "delivery">>,
  ): Promise<ShopOrder | undefined>;
  enqueueNotification(job: Omit<NotificationJob, "id" | "createdAt" | "updatedAt">): Promise<void>;
  claimDueNotificationJobs(now: Date, limit: number): Promise<NotificationJob[]>;
  updateNotificationJob(
    id: number,
    data: Partial<Pick<NotificationJob, "status" | "runAt" | "lastError">>,
  ): Promise<void>;
  listOrdersForTracking(): Promise<Array<{ shop: Shop; order: ShopOrder }>>;

  // Yarn Methods
  getAllYarns(): Promise<Yarn[]>;
  getYarn(id: number): Promise<Yarn | undefined>;
  createYarn(yarn: InsertYarn): Promise<Yarn>;
  updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined>;
  deleteYarn(id: number): Promise<boolean>;
  getLowStockYarns(threshold: number): Promise<Yarn[]>;
  
  // Project Methods
  getAllProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  
  // Price Calculation Methods
  getAllCalculations(): Promise<PriceCalculation[]>;
  getCalculation(id: number): Promise<PriceCalculation | undefined>;
  createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation>;
  
  // Activity Log Methods
  getRecentActivity(limit: number): Promise<ActivityLog[]>;
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
}

export class MemStorage implements IStorage {
  private yarns: Map<number, Yarn>;
  private projects: Map<number, Project>;
  private calculations: Map<number, PriceCalculation>;
  private activities: Map<number, ActivityLog>;
  private yarnsCurrentId: number;
  private projectsCurrentId: number;
  private calculationsCurrentId: number;
  private activitiesCurrentId: number;
  private users: User[] = [];
  private tokens: AuthToken[] = [];
  private authId = 1;
  private shops: Shop[] = [];
  private shopProducts: ShopProduct[] = [];
  private shopOrders: ShopOrder[] = [];
  private notificationJobs: NotificationJob[] = [];
  private shopBrandingImages = new Map<number, ShopBrandingImage>();
  private shopId = 1;
  private shopProductId = 1;
  private notificationJobId = 1;

  async getShopForUser(userId: number) {
    return this.shops.find((shop) => shop.userId === userId);
  }
  async getShopById(shopId: number) {
    return this.shops.find((shop) => shop.id === shopId);
  }
  async getShopBySlug(slug: string, liveOnly = false) {
    return this.shops.find((shop) => shop.slug === slug && (!liveOnly || shop.isLive));
  }
  async getShopByDomain(domain: string) {
    return this.shops.find((shop) => shop.customDomain === domain);
  }
  async saveShop(userId: number, data: ShopRecord, brandingImage?: ShopBrandingImage | null) {
    if (brandingImage !== undefined) {
      const shopId = this.shops.find((shop) => shop.userId === userId)?.id;
      if (shopId !== undefined) {
        if (brandingImage) this.shopBrandingImages.set(shopId, brandingImage);
        else this.shopBrandingImages.delete(shopId);
      }
    }
    const existing = this.shops.find((shop) => shop.userId === userId);
    const now = new Date();
    if (existing) {
      Object.assign(existing, data, { updatedAt: now });
      return existing;
    }
    const shop: Shop = {
      ...data,
      id: this.shopId++,
      userId,
      createdAt: now,
      updatedAt: now,
    };
    this.shops.push(shop);
    if (brandingImage) this.shopBrandingImages.set(shop.id, brandingImage);
    return shop;
  }
  async getShopBrandingImage(shopId: number) {
    return this.shopBrandingImages.get(shopId);
  }
  async listShopProducts(shopId: number, publishedOnly = false) {
    return this.shopProducts
      .filter((product) => product.shopId === shopId && (!publishedOnly || product.isPublished))
      .map(withoutProductImageData);
  }
  async createShopProduct(shopId: number, data: ShopProductRecord, image?: ShopProductImage) {
    const now = new Date();
    const product: ShopProduct = {
      ...data,
      imageData: image?.data ?? null,
      imageMimeType: image?.mimeType ?? null,
      id: this.shopProductId++,
      shopId,
      createdAt: now,
      updatedAt: now,
    };
    this.shopProducts.push(product);
    return withoutProductImageData(product);
  }
  async updateShopProduct(
    shopId: number,
    id: number,
    data: Partial<ShopProductRecord>,
    image?: ShopProductImage | null,
  ) {
    const product = this.shopProducts.find((item) => item.shopId === shopId && item.id === id);
    if (!product) return undefined;
    Object.assign(
      product,
      data,
      image !== undefined
        ? { imageData: image?.data ?? null, imageMimeType: image?.mimeType ?? null }
        : {},
      { updatedAt: new Date() },
    );
    return withoutProductImageData(product);
  }
  async getShopProductImage(shopId: number, id: number) {
    const product = this.shopProducts.find((item) => item.shopId === shopId && item.id === id);
    if (!product?.imageData || !product.imageMimeType) return undefined;
    return { data: product.imageData, mimeType: product.imageMimeType };
  }
  async deleteShopProduct(shopId: number, id: number) {
    const original = this.shopProducts.length;
    this.shopProducts = this.shopProducts.filter((item) => item.shopId !== shopId || item.id !== id);
    return this.shopProducts.length < original;
  }
  async createShopOrder(data: Omit<ShopOrder, "id" | "createdAt" | "updatedAt">) {
    const now = new Date();
    const order: ShopOrder = { ...data, id: this.shopOrders.length + 1, createdAt: now, updatedAt: now };
    this.shopOrders.push(order);
    return order;
  }
  async getShopOrderByReference(reference: string) {
    return this.shopOrders.find((order) => order.reference === reference);
  }
  async listShopOrders(shopId: number) {
    return this.shopOrders.filter((order) => order.shopId === shopId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async updateShopOrder(
    reference: string,
    data: Partial<Pick<ShopOrder, "status" | "paystackTransactionId" | "paystackAuthorizationUrl" | "delivery">>,
  ) {
    const order = this.shopOrders.find((item) => item.reference === reference);
    if (!order) return undefined;
    Object.assign(order, data, { updatedAt: new Date() });
    return order;
  }
  async enqueueNotification(data: Omit<NotificationJob, "id" | "createdAt" | "updatedAt">) {
    if (this.notificationJobs.some((job) => job.dedupeKey === data.dedupeKey)) return;
    const now = new Date();
    this.notificationJobs.push({ ...data, id: this.notificationJobId++, createdAt: now, updatedAt: now });
  }
  async claimDueNotificationJobs(now: Date, limit: number) {
    const due = this.notificationJobs
      .filter((job) =>
        (job.status === "queued" && job.runAt <= now) ||
        (job.status === "sending" && now.getTime() - job.updatedAt.getTime() >= 5 * 60 * 1000),
      )
      .sort((a, b) => a.runAt.getTime() - b.runAt.getTime())
      .slice(0, limit);
    for (const job of due) {
      job.status = "sending";
      job.attempts += 1;
      job.updatedAt = now;
    }
    return due;
  }
  async updateNotificationJob(
    id: number,
    data: Partial<Pick<NotificationJob, "status" | "runAt" | "lastError">>,
  ) {
    const job = this.notificationJobs.find((item) => item.id === id);
    if (job) Object.assign(job, data, { updatedAt: new Date() });
  }
  async listOrdersForTracking() {
    return this.shopOrders.flatMap((order) => {
      const shop = this.shops.find((candidate) => candidate.id === order.shopId);
      return shop && order.status === "paid" && order.delivery.shipment
        ? [{ shop, order }]
        : [];
    });
  }
  async countUsers() {
    return this.users.length;
  }
  async getUserById(id: number) {
    return this.users.find((u) => u.id === id);
  }
  async getUserByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }
  async listUsers() {
    return [...this.users];
  }
  async deleteUser(id: number) {
    this.users = this.users.filter((u) => u.id !== id);
    await this.deleteTokens(id);
  }
  async createUser(email: string, passwordHash: string, isOwner = false) {
    const user: User = {
      id: this.authId++,
      email,
      passwordHash,
      otpEnabled: false,
      isOwner,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    };
    this.users.push(user);
    return user;
  }
  async updateUser(id: number, data: Partial<User>) {
    const user = this.users.find((u) => u.id === id);
    if (user) Object.assign(user, data);
  }
  async saveToken(userId: number, purpose: TokenPurpose, tokenHash: string, expiresAt: Date) {
    await this.deleteTokens(userId, purpose);
    this.tokens.push({
      id: this.authId++,
      userId,
      purpose,
      tokenHash,
      attempts: 0,
      expiresAt,
      createdAt: new Date(),
    });
  }
  async getToken(userId: number, purpose: TokenPurpose) {
    return this.tokens.find((t) => t.userId === userId && t.purpose === purpose);
  }
  async incrementTokenAttempts(id: number) {
    const t = this.tokens.find((t) => t.id === id);
    if (t) t.attempts++;
  }
  async deleteTokens(userId: number, purpose?: TokenPurpose) {
    this.tokens = this.tokens.filter((t) => !(t.userId === userId && (!purpose || t.purpose === purpose)));
  }

  constructor() {
    this.yarns = new Map();
    this.projects = new Map();
    this.calculations = new Map();
    this.activities = new Map();
    this.yarnsCurrentId = 1;
    this.projectsCurrentId = 1;
    this.calculationsCurrentId = 1;
    this.activitiesCurrentId = 1;
  }

  // Yarn methods
  async getAllYarns(): Promise<Yarn[]> {
    return Array.from(this.yarns.values());
  }

  async getYarn(id: number): Promise<Yarn | undefined> {
    return this.yarns.get(id);
  }

  async createYarn(yarn: InsertYarn): Promise<Yarn> {
    const id = this.yarnsCurrentId++;
    const newYarn: Yarn = { ...yarn, id };
    this.yarns.set(id, newYarn);
    return newYarn;
  }

  async updateYarn(id: number, yarn: Partial<InsertYarn>): Promise<Yarn | undefined> {
    const existingYarn = this.yarns.get(id);
    if (!existingYarn) return undefined;

    const updatedYarn = { ...existingYarn, ...yarn };
    this.yarns.set(id, updatedYarn);
    return updatedYarn;
  }

  async deleteYarn(id: number): Promise<boolean> {
    return this.yarns.delete(id);
  }

  async getLowStockYarns(threshold: number): Promise<Yarn[]> {
    return Array.from(this.yarns.values()).filter(yarn => yarn.quantityInStock <= threshold);
  }

  // Project methods
  async getAllProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(id: number): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = this.projectsCurrentId++;
    const newProject: Project = { ...project, id };
    this.projects.set(id, newProject);
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const existingProject = this.projects.get(id);
    if (!existingProject) return undefined;

    const updatedProject = { ...existingProject, ...project };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Price calculation methods
  async getAllCalculations(): Promise<PriceCalculation[]> {
    return Array.from(this.calculations.values());
  }

  async getCalculation(id: number): Promise<PriceCalculation | undefined> {
    return this.calculations.get(id);
  }

  async createCalculation(calculation: InsertPriceCalculation): Promise<PriceCalculation> {
    const id = this.calculationsCurrentId++;
    
    // Calculate the prices
    const materialCost = calculation.ballsUsed * (calculation.yarnId ? 
      (this.yarns.get(calculation.yarnId)?.costPerBall || 0) : 0) + calculation.additionalCosts;
    
    const laborCost = calculation.laborHours * calculation.hourlyRate;
    const baseCost = materialCost + laborCost;
    const markup = baseCost * (calculation.markupPercentage / 100);
    let finalPrice = baseCost + markup;
    
    // Round to nearest $5 if requested
    if (calculation.roundToNearest) {
      finalPrice = Math.ceil(finalPrice / 5) * 5;
    }
    
    const newCalculation: PriceCalculation = {
      ...calculation,
      id,
      materialCost,
      laborCost,
      baseCost,
      markup,
      finalPrice,
      createdAt: new Date()
    };
    
    this.calculations.set(id, newCalculation);
    return newCalculation;
  }

  // Activity log methods
  async getRecentActivity(limit: number): Promise<ActivityLog[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const id = this.activitiesCurrentId++;
    const newActivity: ActivityLog = {
      ...activity,
      id,
      timestamp: new Date()
    };
    this.activities.set(id, newActivity);
    return newActivity;
  }
}

// Initialize storage based on presence of a database URL.
const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
export const dataPersistence = databaseUrl ? "database" : "memory";

let storageInstance: IStorage;

if (databaseUrl) {
  const { DatabaseStorage } = await import("./db");
  storageInstance = new DatabaseStorage();
} else {
  console.warn("No database URL found; using empty, non-persistent in-memory storage.");
  storageInstance = new MemStorage();
}

export const storage = storageInstance;
