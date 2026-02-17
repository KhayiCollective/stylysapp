

# Catalog Integration: Import from Shopify or WooCommerce

## What This Does
Adds an "Import Products" flow to the Catalog page so clients can pull their existing product catalog from Shopify or WooCommerce instead of adding products one by one manually.

## How It Works
1. On the Catalog page, an "Import Products" button appears alongside "Add Product"
2. Clicking it opens a dialog where the client chooses their platform (Shopify or WooCommerce)
3. **Shopify path**: If already connected, fetches products via the existing Shopify proxy and imports them into the `products` table. If not connected, links them to the Shopify Connect page.
4. **WooCommerce path**: Client enters their WooCommerce store URL, Consumer Key, and Consumer Secret. A new edge function fetches their products via the WooCommerce REST API and saves them to the `products` table.
5. Imported products are mapped to the existing product schema (name, image, price, category, tags) and marked with their source (`shopify` or `woocommerce`).

## Changes

### 1. Database: Add source tracking columns to `products`
- Add `source` column (text, default `'manual'`) -- values: `manual`, `shopify`, `woocommerce`
- Add `woocommerce_product_id` column (text, nullable) for deduplication

### 2. Database: Add WooCommerce credentials to `brands`
- Add `woocommerce_store_url` (text, nullable)
- Add `woocommerce_consumer_key` (text, nullable)
- Add `woocommerce_consumer_secret` (text, nullable)
- Add `woocommerce_connected_at` (timestamptz, nullable)

### 3. New edge function: `woocommerce-product-sync`
- Accepts brand_id, fetches WooCommerce credentials from `brands` table
- Calls WooCommerce REST API (`/wp-json/wc/v3/products`) using the consumer key/secret
- Maps WooCommerce product fields to the `products` table schema
- Upserts products (using `woocommerce_product_id` for deduplication)

### 4. New component: `ImportProductsDialog` (`src/components/catalog/ImportProductsDialog.tsx`)
- Platform selection step (Shopify or WooCommerce cards)
- **Shopify tab**: Shows "Import from Shopify" button if connected, or "Connect Shopify first" link if not
- **WooCommerce tab**: Form for store URL, consumer key, and consumer secret with a "Connect & Import" button
- Progress/loading states during import
- Summary showing how many products were imported

### 5. Update Catalog page (`src/pages/Catalog.tsx`)
- Add the "Import Products" button in the header actions bar
- Render the new `ImportProductsDialog` component
- Refresh product list after successful import

### 6. Update Shopify product sync to use source column
- Modify the existing `shopify-product-sync` edge function to set `source = 'shopify'` when syncing
- Use the existing `shopify_product_id` for deduplication (already in schema)

## Technical Details

### WooCommerce API Authentication
WooCommerce REST API uses consumer key/secret passed as query params (for HTTPS) or via HTTP Basic Auth. The edge function will use Basic Auth (`Authorization: Basic base64(key:secret)`).

### Product Field Mapping

| Local Field | Shopify Source | WooCommerce Source |
|---|---|---|
| name | title | name |
| image_url | images.edges[0].node.url | images[0].src |
| price | variants.edges[0].node.price.amount | price |
| category | product_type or tags | categories[0].name |
| tags | tags (split by comma) | tags[].name |
| inventory_status | availableForSale -> in_stock/out_of_stock | stock_status |

### Security
- WooCommerce credentials stored in the `brands` table (already protected by RLS)
- The edge function validates the brand belongs to the authenticated user before accessing credentials
- Consumer keys are never exposed to the frontend after initial setup

