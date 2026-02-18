

# Fix: Customer Signup "Internal Server Error" + Persistent Sessions

## Problem
The `widget-customer-auth` edge function crashes with `Worker is not defined` because the bcrypt library's async methods (`hash`, `compare`) spawn Web Workers, which are not available in the edge runtime.

## Fix
A two-line change in `supabase/functions/widget-customer-auth/index.ts`:

1. **Line 92**: Change `await bcrypt.hash(password)` to `bcrypt.hashSync(password)`
2. **Line 131**: Change `await bcrypt.compare(password, account.password_hash)` to `bcrypt.compareSync(password, account.password_hash)`

These synchronous variants do not use Web Workers and work correctly in the edge runtime.

## Customer Credentials Persistence
Customer sessions are already persisted -- the JWT token is saved to `localStorage` under a brand-specific key (`stylys_customer_token_{brandId}`). On widget load, the `AccountTab` checks for a stored token and auto-restores the session. No additional changes are needed here.

## Technical Details

### File to modify:
- **`supabase/functions/widget-customer-auth/index.ts`** -- Replace two async bcrypt calls with their sync equivalents

### No other files change.

### Result:
- Customer signup and login will work without errors
- Sessions persist across page reloads and revisits (already working via localStorage)

