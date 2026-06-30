// Customer widget auth token helpers.
// IMPORTANT: We use a single generic localStorage key that does NOT contain
// the brand_id. Previously we stored tokens as `stylys_customer_token_<brandId>`
// which caused stale brand_ids to leak between sessions/domains. The brand_id
// must ALWAYS be resolved fresh from the current shop domain on every widget
// load — never cached and never derived from the token storage key.

const TOKEN_KEY = "stylys_customer_token_agvobtjeizdoppzkvyyu";
// LEGACY_PREFIX intentionally broad — catches old generic key AND old brand-scoped keys
const LEGACY_PREFIX = "stylys_customer_token";

let migrated = false;

function migrateLegacyKeys() {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // Exclude the current key so we never accidentally delete our own token
      if (k && k.startsWith(LEGACY_PREFIX) && k !== TOKEN_KEY) keys.push(k);
    }
    // Don't promote old tokens — they were issued by a different Supabase project
    // and would fail auth. Users will simply be asked to log in again.
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
