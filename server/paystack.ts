import crypto from "node:crypto";

const PAYSTACK_API = "https://api.paystack.co";

export function isPaystackTestModeConfigured() {
  return process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_test_") ?? false;
}

function getTestSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Online checkout is not configured. Add a Paystack test secret key.");
  if (!secret.startsWith("sk_test_")) {
    throw new Error("CrochetNook checkout is restricted to Paystack test keys until live payments are explicitly enabled.");
  }
  return secret;
}

export function createCheckoutQuoteToken(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", getTestSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readCheckoutQuoteToken<T>(token: string): T {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) throw new Error("Invalid or expired delivery quote. Please request a new quote.");
  const expected = crypto.createHmac("sha256", getTestSecret()).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("Invalid or expired delivery quote. Please request a new quote.");
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    throw new Error("Invalid or expired delivery quote. Please request a new quote.");
  }
}

export function verifyPaystackWebhookSignature(body: Buffer, signature: string | undefined): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac("sha512", getTestSecret()).update(body).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

async function requestPaystack<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getTestSecret()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => null) as {
    status?: boolean;
    message?: string;
    data?: T;
  } | null;
  if (!response.ok || body?.status !== true || body.data === undefined) {
    throw new Error(body?.message ?? `Paystack request failed with status ${response.status}`);
  }
  return body.data;
}

export async function initializePaystackTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, string | number>;
}) {
  return requestPaystack<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "ZAR",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export async function verifyPaystackTransaction(reference: string) {
  return requestPaystack<{
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
}
