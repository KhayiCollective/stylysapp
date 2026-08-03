/**
 * Shopify App Bridge session token (JWT) verification.
 * Used in edge functions called from the embedded Shopify Admin context.
 */

import { timingSafeEqual } from "./verify.ts";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ShopifySessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf?: number;
  iat: number;
  jti: string;
  sid?: string;
}

function decodeBase64url(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

function encodeBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Verify a Shopify App Bridge session token and resolve the authenticated brand.
// Throws a descriptive Error on any failure; callers map caught errors to HTTP 401.
export async function verifyShopifySessionToken(
  token: string,
  supabase: SupabaseClient,
  clientId: string,
  clientSecret: string,
): Promise<{ shop: string; brandId: string }> {
  // Step 1: parse JWT structure
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid session token format");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Step 2: verify HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(signingInput),
  );
  const computedSignature = encodeBase64url(signatureBuffer);
  if (!timingSafeEqual(computedSignature, encodedSignature)) {
    throw new Error("Invalid session token signature");
  }

  // Step 3: decode and parse payload
  let payload: ShopifySessionTokenPayload;
  try {
    payload = JSON.parse(decodeBase64url(encodedPayload));
  } catch {
    throw new Error("Invalid session token payload");
  }

  // Step 4: validate claims
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new Error("Session token expired");
  }
  if (payload.nbf !== undefined && payload.nbf > now) {
    throw new Error("Session token not yet valid");
  }
  if (payload.aud !== clientId) {
    throw new Error("Session token audience mismatch");
  }

  // Step 5: extract and validate shop domain
  let shop: string;
  try {
    shop = new URL(payload.dest).hostname;
  } catch {
    throw new Error("Invalid dest claim in session token");
  }
  if (!shop.endsWith(".myshopify.com")) {
    throw new Error("Invalid shop domain in session token");
  }

  // Step 6: resolve brand — requires both matching domain and completed OAuth
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .eq("shopify_store_domain", shop)
    .not("shopify_connected_at", "is", null)
    .single();

  if (error || !data) {
    throw new Error("Shop not connected");
  }

  return { shop, brandId: data.id };
}
