// Shared helpers for Shopify expiring offline access tokens.
//
// Shopify requires public apps to use expiring offline tokens (1-hour access
// token + 90-day rotating refresh token). Every function that calls the Shopify
// Admin API should obtain its token through getShopifyAuth() instead of reading
// brands.shopify_access_token directly, so the token is refreshed on demand.
//
// brands columns used:
//   shopify_access_token, shopify_refresh_token,
//   shopify_token_expires_at, shopify_refresh_token_expires_at
// A NULL shopify_token_expires_at = legacy non-expiring token (not yet migrated).

const SHOPIFY_CLIENT_ID = Deno.env.get("SHOPIFY_CLIENT_ID") || "";
const SHOPIFY_CLIENT_SECRET = Deno.env.get("SHOPIFY_CLIENT_SECRET") || "";

// Refresh a little early so a token never expires mid-request.
const REFRESH_SKEW_MS = 2 * 60 * 1000;

export interface ShopifyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

export interface ShopifyAuth {
  domain: string;
  token: string;
}

/** Columns to merge into a brands UPDATE after receiving a token response. */
export function tokenFields(data: ShopifyTokenResponse): Record<string, unknown> {
  const now = Date.now();
  const fields: Record<string, unknown> = { shopify_access_token: data.access_token };
  if (data.refresh_token && data.expires_in) {
    fields.shopify_refresh_token = data.refresh_token;
    fields.shopify_token_expires_at = new Date(now + data.expires_in * 1000).toISOString();
    fields.shopify_refresh_token_expires_at = data.refresh_token_expires_in
      ? new Date(now + data.refresh_token_expires_in * 1000).toISOString()
      : null;
  } else {
    // Non-expiring token response (legacy): clear any stale expiring fields.
    fields.shopify_refresh_token = null;
    fields.shopify_token_expires_at = null;
    fields.shopify_refresh_token_expires_at = null;
  }
  return fields;
}

/** Fields to null out on uninstall. */
export const CLEARED_TOKEN_FIELDS = {
  shopify_access_token: null,
  shopify_refresh_token: null,
  shopify_token_expires_at: null,
  shopify_refresh_token_expires_at: null,
};

async function readBrand(supabase: any, brandId: string) {
  const { data } = await supabase
    .from("brands")
    .select("shopify_store_domain, shopify_access_token, shopify_refresh_token, shopify_token_expires_at")
    .eq("id", brandId)
    .maybeSingle();
  return data as
    | {
        shopify_store_domain: string | null;
        shopify_access_token: string | null;
        shopify_refresh_token: string | null;
        shopify_token_expires_at: string | null;
      }
    | null;
}

function isFresh(expiresAt: string | null): boolean {
  if (!expiresAt) return true; // legacy non-expiring token
  return new Date(expiresAt).getTime() - Date.now() > REFRESH_SKEW_MS;
}

/**
 * Returns a valid { domain, token } for the brand, refreshing the access token
 * when it is expired or about to expire. Returns null if Shopify isn't connected.
 */
export async function getShopifyAuth(supabase: any, brandId: string): Promise<ShopifyAuth | null> {
  const brand = await readBrand(supabase, brandId);
  if (!brand?.shopify_store_domain || !brand.shopify_access_token) return null;

  if (isFresh(brand.shopify_token_expires_at)) {
    return { domain: brand.shopify_store_domain, token: brand.shopify_access_token };
  }

  if (!brand.shopify_refresh_token) {
    console.error("[shopify-token] token expired and no refresh token stored for brand", brandId);
    return null;
  }

  const resp = await fetch(`https://${brand.shopify_store_domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: brand.shopify_refresh_token,
    }).toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[shopify-token] refresh failed", resp.status, errText);
    // Another concurrent request may have just refreshed (refresh tokens rotate),
    // so re-read before giving up.
    const again = await readBrand(supabase, brandId);
    if (again?.shopify_access_token && again.shopify_store_domain && isFresh(again.shopify_token_expires_at)) {
      return { domain: again.shopify_store_domain, token: again.shopify_access_token };
    }
    return null;
  }

  const data = (await resp.json()) as ShopifyTokenResponse;
  if (!data.access_token) return null;

  const { error } = await supabase.from("brands").update(tokenFields(data)).eq("id", brandId);
  if (error) console.error("[shopify-token] failed to store refreshed token:", error.message);

  return { domain: brand.shopify_store_domain, token: data.access_token };
}

/**
 * One-time migration of a legacy non-expiring token to an expiring pair
 * (Shopify "Option 2"). Irreversible: the old token stops working for the
 * Admin API. Returns the stored result or throws with Shopify's error body.
 */
export async function migrateLegacyToken(
  supabase: any,
  brandId: string,
  domain: string,
  legacyToken: string,
): Promise<{ expires_in?: number }> {
  const resp = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: legacyToken,
      subject_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
    }).toString(),
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`Shopify ${resp.status}: ${text}`);

  const data = JSON.parse(text) as ShopifyTokenResponse;
  if (!data.access_token || !data.refresh_token) throw new Error(`Unexpected response: ${text}`);

  const { error } = await supabase.from("brands").update(tokenFields(data)).eq("id", brandId);
  if (error) {
    // Don't lose the new pair if the DB write fails.
    throw new Error(`DB update failed (${error.message}). NEW TOKEN PAIR: ${text}`);
  }
  return { expires_in: data.expires_in };
}
