

## Plan: Update shopify.app.toml Webhook Configuration

**File: `shopify.app.toml`**

1. Change `api_version` from `"2024-10"` to `"2025-10"`
2. Split the existing `compliance_topics` block into three individual `[[webhooks.subscriptions]]` entries — one per compliance topic — all pointing to `https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks`
3. Keep the existing product/inventory webhook subscription unchanged

No new files. No Express handlers. The existing `shopify-webhooks` edge function already handles all three compliance topics.

