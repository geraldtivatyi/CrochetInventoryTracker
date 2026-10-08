import crypto from "crypto";
import type { ShopAddress } from "@shared/schema";

const API_ORIGIN = "https://api.portal.thecourierguy.co.za";
const AWS_REGION = process.env.COURIERGUY_AWS_REGION ?? "eu-west-1";
const AWS_SERVICE = "execute-api";

export interface CourierCredentials {
  accessKey: string;
  secretKey: string;
}

function hmac(key: Buffer | string, value: string, encoding?: crypto.BinaryToTextEncoding) {
  const digest = crypto.createHmac("sha256", key).update(value, "utf8");
  return encoding ? digest.digest(encoding) : digest.digest();
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalQuery(url: URL) {
  const params: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => params.push([key, value]));
  return params
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function signedRequest<T>(
  credentials: CourierCredentials,
  method: string,
  path: string,
  query: Record<string, string> = {},
  payload?: unknown,
): Promise<T> {
  const url = new URL(path, API_ORIGIN);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const payloadHash = sha256(body);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (body) headers["content-type"] = "application/json";

  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${headers[key].trim()}\n`)
    .join("");
  const canonicalRequest = [
    method.toUpperCase(),
    url.pathname,
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${credentials.secretKey}`, dateStamp) as Buffer;
  const regionKey = hmac(dateKey, AWS_REGION) as Buffer;
  const serviceKey = hmac(regionKey, AWS_SERVICE) as Buffer;
  const signingKey = hmac(serviceKey, "aws4_request") as Buffer;
  const signature = hmac(signingKey, stringToSign, "hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: body || undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(`Could not reach Courier Guy: ${(error as Error).message}`);
  }
  const responseText = await response.text();
  if (!response.ok) {
    let message = responseText;
    try {
      const parsed = JSON.parse(responseText);
      message = parsed.message ?? parsed.error ?? responseText;
    } catch {
      // Keep the provider response text when it isn't JSON.
    }
    throw new Error(`Courier Guy returned ${response.status}: ${message.slice(0, 500)}`);
  }
  if (!responseText) return undefined as T;
  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error("Courier Guy returned a response that was not valid JSON");
  }
}

export async function getPickupPoints(lat: number, lng: number, type: "locker" | "counter" | "point") {
  const url = new URL("/pickup-points", API_ORIGIN);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("order_closest", "true");
  url.searchParams.set("type", type);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new Error(`Could not reach Courier Guy pickup points: ${(error as Error).message}`);
  }
  const text = await response.text();
  if (!response.ok) throw new Error(`Courier Guy returned ${response.status}: ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Courier Guy returned an invalid pickup-points response");
  }
}

export interface CourierParcel {
  parcel_description: string;
  submitted_length_cm: number;
  submitted_width_cm: number;
  submitted_height_cm: number;
  submitted_weight_kg: number;
}

export interface RateRequest {
  deliveryAddress?: ShopAddress;
  deliveryPickupPointId?: string | number;
  parcels: CourierParcel[];
  declaredValue?: number;
  collectionMinDate?: string;
  deliveryMinDate?: string;
}

function buildAddress(address: ShopAddress) {
  return { ...address, country: address.country.toUpperCase() };
}

export function getRates(credentials: CourierCredentials, origin: ShopAddress, input: RateRequest) {
  if (input.deliveryPickupPointId !== undefined) {
    return signedRequest(
      credentials,
      "POST",
      "/rates",
      {},
      {
        collection_address: buildAddress(origin),
        delivery_pickup_point_id: input.deliveryPickupPointId,
        parcels: input.parcels,
        ...(input.collectionMinDate && { collection_min_date: input.collectionMinDate }),
        ...(input.deliveryMinDate && { delivery_min_date: input.deliveryMinDate }),
      },
    );
  }
  return signedRequest(
    credentials,
    "POST",
    "/rates",
    {},
    {
      collection_address: buildAddress(origin),
      delivery_address: buildAddress(input.deliveryAddress!),
      parcels: input.parcels,
      ...(input.declaredValue !== undefined && { declared_value: input.declaredValue }),
      ...(input.collectionMinDate && { collection_min_date: input.collectionMinDate }),
      ...(input.deliveryMinDate && { delivery_min_date: input.deliveryMinDate }),
    },
  );
}

export interface ShipmentRequest extends RateRequest {
  deliveryContact: { name: string; mobile_number: string; email: string };
  customerReference?: string;
  serviceLevelCode?: string;
  specialInstructions?: string;
  collectionAfter?: string;
  collectionBefore?: string;
}

export function createShipment(
  credentials: CourierCredentials,
  origin: ShopAddress,
  sender: { name: string; mobile_number: string; email: string },
  input: ShipmentRequest,
) {
  return signedRequest(
    credentials,
    "POST",
    "/shipments",
    {},
    {
      collection_address: buildAddress(origin),
      collection_contact: sender,
      ...(input.deliveryPickupPointId !== undefined
        ? { delivery_pickup_point_id: input.deliveryPickupPointId }
        : { delivery_address: buildAddress(input.deliveryAddress!) }),
      delivery_contact: input.deliveryContact,
      parcels: input.parcels,
      ...(input.collectionMinDate && { collection_min_date: input.collectionMinDate }),
      ...(input.collectionAfter && { collection_after: input.collectionAfter }),
      ...(input.collectionBefore && { collection_before: input.collectionBefore }),
      ...(input.deliveryMinDate && { delivery_min_date: input.deliveryMinDate }),
      ...(input.customerReference && { customer_reference: input.customerReference }),
      ...(input.serviceLevelCode && { service_level_code: input.serviceLevelCode }),
      ...(input.specialInstructions && { special_instructions_collection: input.specialInstructions }),
    },
  );
}

export function getShipmentTracking(credentials: CourierCredentials, trackingReference: string) {
  return signedRequest(
    credentials,
    "GET",
    "/tracking/shipments",
    { tracking_reference: trackingReference },
  );
}
