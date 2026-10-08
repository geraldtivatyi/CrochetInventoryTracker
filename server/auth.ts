import crypto from "crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import createMemoryStore from "memorystore";
import { z } from "zod";
import {
  type PublicUser,
  type TokenPurpose,
  type User,
  loginSchema,
  setupSchema,
  forgotPasswordSchema,
  inviteSchema,
  resetPasswordSchema,
  otpCodeSchema,
  changePasswordSchema,
  disableOtpSchema,
} from "@shared/schema";
import { storage } from "./storage";
import { sendMail, passwordResetEmail, inviteEmail, otpEmail, APP_URL } from "./mailer";
import { log } from "./vite";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    pendingUserId?: number; // password verified, waiting for OTP
    pendingAt?: number;
  }
}

const isProd = process.env.NODE_ENV === "production";
const secureCookies = APP_URL.startsWith("https://");
const RESET_TTL_MS = 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_TOKEN_ATTEMPTS = 5;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProd) throw new Error("SESSION_SECRET must be set in production.");
  sessionSecret = crypto.randomBytes(32).toString("hex");
  log("SESSION_SECRET not set: using a random one (sessions reset on restart).");
}

// ---- crypto helpers ----
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString("hex"));

const hashToken = (token: string) => crypto.createHmac("sha256", sessionSecret!).update(token).digest("hex");

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

// Returns true if the token matched (and consumes it); counts failed attempts
async function consumeToken(userId: number, purpose: TokenPurpose, value: string): Promise<boolean> {
  const token = await storage.getToken(userId, purpose);
  if (!token) return false;
  if (token.expiresAt.getTime() < Date.now() || token.attempts >= MAX_TOKEN_ATTEMPTS) {
    await storage.deleteTokens(userId, purpose);
    return false;
  }
  if (!safeEqual(token.tokenHash, hashToken(value))) {
    await storage.incrementTokenAttempts(token.id);
    return false;
  }
  await storage.deleteTokens(userId, purpose);
  return true;
}

async function sendOtp(user: User, purpose: "login_otp" | "enable_otp") {
  const code = generateOtp();
  await storage.saveToken(user.id, purpose, hashToken(code), new Date(Date.now() + OTP_TTL_MS));
  await sendMail(otpEmail(user.email, code, purpose === "login_otp" ? "sign in" : "enable two-step verification"));
}

// ---- simple in-memory rate limiter ----
function rateLimit(name: string, max: number, windowMs: number) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ message: "Too many attempts. Please try again later." });
    }
    next();
  };
}

const toPublic = (u: User): PublicUser => ({ id: u.id, email: u.email, otpEnabled: u.otpEnabled, isOwner: u.isOwner });

function logIn(req: Request, user: User): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

const destroySession = (req: Request): Promise<void> =>
  new Promise((resolve) => req.session.destroy(() => resolve()));

async function currentUser(req: Request): Promise<User | undefined> {
  return req.session.userId ? storage.getUserById(req.session.userId) : undefined;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    (req as any).user = user;
    next();
  } catch (err) {
    next(err);
  }
}

const handle =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch((err) => {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.issues[0]?.message ?? "Invalid input" });
      }
      next(err);
    });

export async function setupSession(app: Express) {
  if (secureCookies) app.set("trust proxy", 1);

  const databaseUrl = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  let store: session.Store;
  if (databaseUrl && /^postgres(ql)?:\/\//.test(databaseUrl)) {
    const { Pool } = await import("pg");
    const PgStore = connectPgSimple(session);
    store = new PgStore({ pool: new Pool({ connectionString: databaseUrl }), createTableIfMissing: true });
  } else {
    store = new (createMemoryStore(session))({ checkPeriod: 24 * 60 * 60 * 1000 });
  }

  app.use(
    session({
      store,
      secret: sessionSecret!,
      name: "crochet.sid",
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax", secure: secureCookies, maxAge: SESSION_MAX_AGE_MS },
    }),
  );
}

async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as User;
  if (!user.isOwner) return res.status(403).json({ message: "Only the account owner can do this" });
  next();
}

async function sendResetLink(user: User, ttlMs: number, mail: (link: string) => ReturnType<typeof passwordResetEmail>) {
  const token = crypto.randomBytes(32).toString("hex");
  await storage.saveToken(user.id, "password_reset", hashToken(token), new Date(Date.now() + ttlMs));
  await sendMail(mail(`${APP_URL}/reset-password?email=${encodeURIComponent(user.email)}&token=${token}`));
}

export function authRouter() {
  const router = express.Router();
  const loginLimit = rateLimit("login", 20, 15 * 60 * 1000);
  const mailLimit = rateLimit("mail", 5, 15 * 60 * 1000);
  const codeLimit = rateLimit("code", 20, 15 * 60 * 1000);

  router.get(
    "/me",
    handle(async (req, res) => {
      const user = await currentUser(req);
      res.json({ user: user ? toPublic(user) : null, needsSetup: !user && (await storage.countUsers()) === 0 });
    }),
  );

  // First-run only: create the owner account when no users exist
  router.post(
    "/setup",
    loginLimit,
    handle(async (req, res) => {
      const { email, password } = setupSchema.parse(req.body);
      if ((await storage.countUsers()) > 0) return res.status(403).json({ message: "Setup already completed" });
      const user = await storage.createUser(email, hashPassword(password), true);
      await logIn(req, user);
      res.status(201).json({ user: toPublic(user) });
    }),
  );

  router.post(
    "/login",
    loginLimit,
    handle(async (req, res) => {
      const { email, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      const valid = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH) && !!user;

      if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json({ message: "Account temporarily locked. Try again later or reset your password." });
      }
      if (!user || !valid) {
        if (user) {
          const attempts = user.failedLoginAttempts + 1;
          await storage.updateUser(user.id, {
            failedLoginAttempts: attempts >= MAX_FAILED_LOGINS ? 0 : attempts,
            lockedUntil: attempts >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MS) : null,
          });
        }
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await storage.updateUser(user.id, { failedLoginAttempts: 0, lockedUntil: null });

      if (user.otpEnabled) {
        await new Promise<void>((resolve, reject) =>
          req.session.regenerate((err) => (err ? reject(err) : resolve())),
        );
        req.session.pendingUserId = user.id;
        req.session.pendingAt = Date.now();
        await sendOtp(user, "login_otp");
        return res.json({ otpRequired: true });
      }

      await logIn(req, user);
      res.json({ user: toPublic(user) });
    }),
  );

  const pendingUser = async (req: Request) => {
    const { pendingUserId, pendingAt } = req.session;
    if (!pendingUserId || !pendingAt || Date.now() - pendingAt > OTP_TTL_MS) return undefined;
    return storage.getUserById(pendingUserId);
  };

  router.post(
    "/login/otp",
    codeLimit,
    handle(async (req, res) => {
      const { code } = otpCodeSchema.parse(req.body);
      const user = await pendingUser(req);
      if (!user) return res.status(401).json({ message: "Login expired. Please sign in again." });
      if (!(await consumeToken(user.id, "login_otp", code))) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }
      await logIn(req, user);
      res.json({ user: toPublic(user) });
    }),
  );

  router.post(
    "/login/otp/resend",
    mailLimit,
    handle(async (req, res) => {
      const user = await pendingUser(req);
      if (!user) return res.status(401).json({ message: "Login expired. Please sign in again." });
      await sendOtp(user, "login_otp");
      res.json({ ok: true });
    }),
  );

  router.post(
    "/logout",
    handle(async (req, res) => {
      await destroySession(req);
      res.clearCookie("crochet.sid");
      res.json({ ok: true });
    }),
  );

  // Always responds the same way so email addresses can't be discovered
  router.post(
    "/forgot-password",
    mailLimit,
    handle(async (req, res) => {
      const { email } = forgotPasswordSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (user) {
        try {
          await sendResetLink(user, RESET_TTL_MS, (link) => passwordResetEmail(user.email, link));
        } catch (err) {
          log(`failed to send password reset email: ${(err as Error).message}`);
        }
      }
      res.json({ message: "If an account exists for that email, a reset link has been sent." });
    }),
  );

  router.post(
    "/reset-password",
    codeLimit,
    handle(async (req, res) => {
      const { email, token, password } = resetPasswordSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !(await consumeToken(user.id, "password_reset", token))) {
        return res.status(400).json({ message: "This reset link is invalid or has expired" });
      }
      await storage.updateUser(user.id, {
        passwordHash: hashPassword(password),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      await storage.deleteTokens(user.id);
      res.json({ message: "Password updated. You can now sign in." });
    }),
  );

  // ---- Authenticated account management ----
  router.post(
    "/change-password",
    requireAuth,
    loginLimit,
    handle(async (req, res) => {
      const user = (req as any).user as User;
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      if (!verifyPassword(currentPassword, user.passwordHash)) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      await storage.updateUser(user.id, { passwordHash: hashPassword(newPassword) });
      res.json({ message: "Password updated" });
    }),
  );

  router.post(
    "/otp/enable/request",
    requireAuth,
    mailLimit,
    handle(async (req, res) => {
      const user = (req as any).user as User;
      if (user.otpEnabled) return res.status(400).json({ message: "Two-step verification is already enabled" });
      await sendOtp(user, "enable_otp");
      res.json({ message: `We sent a 6-digit code to ${user.email}` });
    }),
  );

  router.post(
    "/otp/enable/confirm",
    requireAuth,
    codeLimit,
    handle(async (req, res) => {
      const user = (req as any).user as User;
      const { code } = otpCodeSchema.parse(req.body);
      if (!(await consumeToken(user.id, "enable_otp", code))) {
        return res.status(400).json({ message: "Invalid or expired code" });
      }
      await storage.updateUser(user.id, { otpEnabled: true });
      res.json({ user: { ...toPublic(user), otpEnabled: true } });
    }),
  );

  router.post(
    "/otp/disable",
    requireAuth,
    loginLimit,
    handle(async (req, res) => {
      const user = (req as any).user as User;
      const { password } = disableOtpSchema.parse(req.body);
      if (!verifyPassword(password, user.passwordHash)) {
        return res.status(400).json({ message: "Password is incorrect" });
      }
      await storage.updateUser(user.id, { otpEnabled: false });
      await storage.deleteTokens(user.id, "login_otp");
      res.json({ user: { ...toPublic(user), otpEnabled: false } });
    }),
  );

  // ---- User management (owner only; accounts are invite-only) ----
  router.get(
    "/users",
    requireAuth,
    requireOwner,
    handle(async (_req, res) => {
      res.json((await storage.listUsers()).map(toPublic));
    }),
  );

  router.post(
    "/users/invite",
    requireAuth,
    requireOwner,
    mailLimit,
    handle(async (req, res) => {
      const owner = (req as any).user as User;
      const { email } = inviteSchema.parse(req.body);
      if (await storage.getUserByEmail(email)) {
        return res.status(409).json({ message: "An account with that email already exists" });
      }
      // The invitee can't log in until they set a password through the emailed link
      const user = await storage.createUser(email, hashPassword(crypto.randomBytes(32).toString("hex")));
      try {
        await sendResetLink(user, INVITE_TTL_MS, (link) => inviteEmail(user.email, link, owner.email));
      } catch (err) {
        await storage.deleteUser(user.id);
        log(`failed to send invite email: ${(err as Error).message}`);
        return res.status(502).json({ message: "Could not send the invitation email. Check the email settings." });
      }
      res.status(201).json({ user: toPublic(user) });
    }),
  );

  router.delete(
    "/users/:id",
    requireAuth,
    requireOwner,
    handle(async (req, res) => {
      const owner = (req as any).user as User;
      const id = parseInt(req.params.id);
      if (isNaN(id) || id === owner.id) return res.status(400).json({ message: "You can't remove your own account" });
      await storage.deleteUser(id);
      res.json({ ok: true });
    }),
  );

  return router;
}
