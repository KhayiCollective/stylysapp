// Customer widget auth token helpers.
// IMPORTANT: We use a single generic localStorage key that does NOT contain
// the brand_id. Previously we stored tokens as `stylys_customer_token_<brandId>`
// which caused stale brand_ids to leak between sessions/domains. The brand_id
// must ALWAYS be resolved fresh from the current shop domain on every widget
// load — never cached and never derived from the token storage key.

const TOKEN_KEY = "stylys_customer_token";
const LEGACY_PREFIX = "stylys_customer_token_";

let migrated = false;

function migrateLegacyKeys() {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_PREFIX)) keys.push(k);
    }
    // If a generic token already exists, just clean up legacy ones.
    const hasGeneric = !!localStorage.getItem(TOKEN_KEY);
    if (!hasGeneric && keys.length > 0) {
      // Promote the first legacy token to the generic key as a best-effort
      // migration so signed-in users stay signed in. Backend `/me` will
      // re-validate the token against the current brand on next call.
      const promoted = localStorage.getItem(keys[0]);
      if (promoted) localStorage.setItem(TOKEN_KEY, promoted);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyKeys();
  return localStorage.getItem(TOKEN_KEY);
}

export function setCustomerToken(token: string) {
  if (typeof window === "undefined") return;
  migrateLegacyKeys();
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearCustomerToken() {
  if (typeof window === "undefined") return;
  migrateLegacyKeys();
  localStorage.removeItem(TOKEN_KEY);
}
