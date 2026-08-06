import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocsLayout } from "@/components/docs/DocsLayout";

export default function ShopifySetup() {
  return (
    <DocsLayout
      title="Shopify Setup"
      description="Complete guide to connecting your Shopify store with STYLYS."
    >
      <section className="space-y-8">
        {/* Overview */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Overview</h2>
          <p className="text-muted-foreground mb-4">
            STYLYS integrates with Shopify through OAuth 2.0 authentication, enabling secure 
            access to your product catalog without storing your credentials. Once connected, 
            products sync automatically via webhooks.
          </p>
        </div>

        {/* Prerequisites */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Prerequisites</h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-2">
            <li>An active Shopify store (Basic plan or higher)</li>
            <li>A STYLYS account with a verified email</li>
            <li>Admin access to your Shopify store</li>
          </ul>
        </div>

        {/* Connection Steps */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Connection Steps</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-lg mb-2">1. Install from the Shopify App Store</h3>
              <p className="text-muted-foreground mb-3">
                Install STYLYS from the Shopify App Store — this automatically detects your store and starts the connection. If you need to reconnect later, go to Settings → Shopify Connection in your STYLYS dashboard.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">2. Enter Your Store Name</h3>
              <p className="text-muted-foreground mb-3">
                If reconnecting via Settings, enter just your store name (e.g. "mystore") — STYLYS automatically appends .myshopify.com. If you installed from the Shopify App Store, this step is handled automatically and you can skip ahead.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">3. Authorize Access</h3>
              <p className="text-muted-foreground mb-3">
                You'll be redirected to Shopify to approve the following permissions:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><code>read_products</code> — Access product details</li>
                <li><code>read_product_listings</code> — Access how products are listed and organized</li>
                <li><code>read_inventory</code> — Check stock levels</li>
                <li><code>read_themes</code> — Detect whether the STYLYS widget is enabled in your theme</li>
                <li><code>unauthenticated_read_product_listings</code> — Power the storefront-facing widget's product data</li>
                <li><code>unauthenticated_read_product_tags</code> — Power tag-based filtering in the widget</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">STYLYS never requests write access to your store.</p>
            </div>

            <div>
              <h3 className="font-medium text-lg mb-2">4. Automatic Sync</h3>
              <p className="text-muted-foreground">
                Once authorized, your products will begin syncing automatically. Initial sync 
                typically takes 1-5 minutes depending on catalog size.
              </p>
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Webhook Configuration</h2>
          <p className="text-muted-foreground mb-4">
            STYLYS automatically registers webhooks to keep your catalog in sync:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Event</th>
                  <th className="text-left py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>products/create</code></td>
                  <td className="py-2">New products added to STYLYS</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>products/update</code></td>
                  <td className="py-2">Product changes synced automatically</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>products/delete</code></td>
                  <td className="py-2">Removed products archived in STYLYS</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>inventory_levels/update</code></td>
                  <td className="py-2">Stock status updated in real-time</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code>app/uninstalled</code></td>
                  <td className="py-2">Cleanup when app is removed</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* App Proxy */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">App Proxy</h2>
          <p className="text-muted-foreground mb-4">
            STYLYS uses Shopify App Proxy to serve the widget and quiz experience directly on your domain (e.g., <code>yourstore.com/apps/stylys</code>), giving you same-origin requests, better SEO, and seamless integration with your store's theme.
          </p>
        </div>

        {/* Troubleshooting */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Troubleshooting</h2>
          
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">"Connection Failed" Error</h4>
              <p className="text-sm text-muted-foreground">
                Ensure you're using the correct store URL format (mystore.myshopify.com) 
                and that you have admin access to the store.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Products Not Syncing</h4>
              <p className="text-sm text-muted-foreground">
                Check Sync Status in Settings — you'll see total/synced product counts and the last sync time. If products are out of date, click "Sync Products Now" to force a full catalog refresh.
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Popup Blocked</h4>
              <p className="text-sm text-muted-foreground">
                If the authorization window doesn't open, allow popups for STYLYS in 
                your browser settings and try again.
              </p>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="pt-8 border-t">
          <h3 className="font-display text-xl font-medium mb-4">Need More Help?</h3>
          <div className="flex gap-4">
            <Link to="/support">
              <Button>Contact Support</Button>
            </Link>
            <Link to="/docs/faq">
              <Button variant="outline">View FAQ</Button>
            </Link>
          </div>
        </div>
      </section>
    </DocsLayout>
  );
}
