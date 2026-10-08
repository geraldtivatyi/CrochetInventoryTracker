import crypto from "crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(variable: string, fallbackVariable: string | undefined, label: string) {
  const configured = process.env[variable] || (fallbackVariable ? process.env[fallbackVariable] : undefined);
  if (!configured || !/^[a-f0-9]{64}$/i.test(configured)) {
    const fallback = fallbackVariable ? ` (or ${fallbackVariable})` : "";
    throw new Error(`${variable}${fallback} must be set to 64 hexadecimal characters to store ${label}.`);
  }
  return Buffer.from(configured, "hex");
}

function encrypt(value: string, key: Buffer) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${ciphertext.toString("hex")}`;
}

function decrypt(value: string, key: Buffer) {
  const [version, ivHex, tagHex, ciphertextHex] = value.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !ciphertextHex) {
    throw new Error("Stored shop credentials are invalid; re-enter them in Shop settings.");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptShopCredential(value: string) {
  return encrypt(value, encryptionKey("COURIERGUY_ENCRYPTION_KEY", undefined, "Courier Guy credentials"));
}

export function decryptShopCredential(value: string) {
  return decrypt(value, encryptionKey("COURIERGUY_ENCRYPTION_KEY", undefined, "Courier Guy credentials"));
}

export function encryptShopSecret(value: string) {
  return encrypt(value, encryptionKey("SHOP_SECRETS_ENCRYPTION_KEY", "COURIERGUY_ENCRYPTION_KEY", "shop secrets"));
}

export function decryptShopSecret(value: string) {
  return decrypt(value, encryptionKey("SHOP_SECRETS_ENCRYPTION_KEY", "COURIERGUY_ENCRYPTION_KEY", "shop secrets"));
}
