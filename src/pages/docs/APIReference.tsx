import { DocsLayout } from "@/components/docs/DocsLayout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Badge } from "@/components/ui/badge";

export default function APIReference() {
  const generateOutfitsCode = `// Generate outfit recommendations
const response = await fetch('https://api.stylys.app/v1/outfits/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    product_id: 'prod_123',
    max_items: 3,
    occasion: 'casual'
  })
});

const { outfits } = await response.json();`;

  const customerPreferencesCode = `// Save customer preferences
const response = await fetch('https://api.stylys.app/v1/customers/preferences', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_id: 'cust_456',
    preferred_colors: ['black', 'navy', 'white'],
    avoided_colors: ['yellow'],
    body_shape: 'hourglass',
    occasions: ['work', 'casual', 'evening']
  })
});`;

  const webhookPayloadCode = `// Webhook payload for new recommendation
{
  "event": "recommendation.created",
  "data": {
    "id": "rec_789",
    "customer_id": "cust_456",
    "outfit_id": "out_123",
    "products": [
      { "id": "prod_1", "title": "Silk Blouse", "price": 89.00 },
      { "id": "prod_2", "title": "Tailored Pants", "price": 129.00 }
    ],
    "total_price": 218.00,
    "created_at": "2026-01-02T10:30:00Z"
  }
}`;

  return (
    <DocsLayout
      title="API Reference"
      description="Complete reference for the STYLYS REST API."
    >
      <section className="space-y-8">
        {/* Introduction */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Introduction</h2>
          <p className="text-muted-foreground mb-4">
            The STYLYS API allows you to programmatically generate outfit recommendations, 
            manage customer preferences, and integrate styling features into your applications.
          </p>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Base URL</p>
            <code className="text-sm">https://api.stylys.app/v1</code>
          </div>
        </div>

        {/* Authentication */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Authentication</h2>
          <p className="text-muted-foreground mb-4">
            All API requests require authentication using a Bearer token. Include your 
            API key in the Authorization header:
          </p>
          <CodeBlock
            code={`Authorization: Bearer YOUR_API_KEY`}
            language="text"
            title="Authorization Header"
          />
          <p className="text-sm text-muted-foreground mt-4">
            Generate API keys in your dashboard under Settings → API Keys.
          </p>
        </div>

        {/* Endpoints */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Endpoints</h2>

          {/* Generate Outfits */}
          <div className="border rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-green-500">POST</Badge>
              <code className="text-sm">/outfits/generate</code>
            </div>
            <p className="text-muted-foreground mb-4">
              Generate AI-powered outfit recommendations based on a product.
            </p>

            <h4 className="font-medium mb-2">Request Body</h4>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>product_id</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Required. The anchor product ID</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>max_items</code></td>
                    <td className="py-2 pr-4">integer</td>
                    <td className="py-2">Max items per outfit (1-6, default: 3)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>occasion</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Filter by occasion (casual, work, evening)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code>customer_id</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Optional. Use customer preferences</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-medium mb-2">Example</h4>
            <CodeBlock code={generateOutfitsCode} language="javascript" />
          </div>

          {/* Customer Preferences */}
          <div className="border rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-green-500">POST</Badge>
              <code className="text-sm">/customers/preferences</code>
            </div>
            <p className="text-muted-foreground mb-4">
              Save or update customer style preferences for personalized recommendations.
            </p>

            <h4 className="font-medium mb-2">Request Body</h4>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>customer_id</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Required. Unique customer identifier</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>preferred_colors</code></td>
                    <td className="py-2 pr-4">array</td>
                    <td className="py-2">Colors the customer prefers</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>avoided_colors</code></td>
                    <td className="py-2 pr-4">array</td>
                    <td className="py-2">Colors to exclude from recommendations</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>body_shape</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Body shape for fit recommendations</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code>occasions</code></td>
                    <td className="py-2 pr-4">array</td>
                    <td className="py-2">Primary occasions for outfit suggestions</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="font-medium mb-2">Example</h4>
            <CodeBlock code={customerPreferencesCode} language="javascript" />
          </div>

          {/* Get Products */}
          <div className="border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-blue-500">GET</Badge>
              <code className="text-sm">/products</code>
            </div>
            <p className="text-muted-foreground mb-4">
              List all synced products from your catalog.
            </p>

            <h4 className="font-medium mb-2">Query Parameters</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Parameter</th>
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>limit</code></td>
                    <td className="py-2 pr-4">integer</td>
                    <td className="py-2">Max results (1-100, default: 20)</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4"><code>offset</code></td>
                    <td className="py-2 pr-4">integer</td>
                    <td className="py-2">Pagination offset</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4"><code>category</code></td>
                    <td className="py-2 pr-4">string</td>
                    <td className="py-2">Filter by category</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Webhooks</h2>
          <p className="text-muted-foreground mb-4">
            Configure webhooks to receive real-time notifications about events in your STYLYS account.
          </p>

          <h4 className="font-medium mb-2">Available Events</h4>
          <ul className="list-disc list-inside text-muted-foreground space-y-1 mb-4">
            <li><code>recommendation.created</code> - New recommendation generated</li>
            <li><code>recommendation.viewed</code> - Customer viewed a recommendation</li>
            <li><code>recommendation.purchased</code> - Outfit items purchased</li>
            <li><code>product.synced</code> - Product catalog updated</li>
          </ul>

          <h4 className="font-medium mb-2">Webhook Payload Example</h4>
          <CodeBlock code={webhookPayloadCode} language="json" />
        </div>

        {/* Rate Limits */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Plan</th>
                  <th className="text-left py-2 pr-4 font-medium">Requests/min</th>
                  <th className="text-left py-2 font-medium">Requests/day</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 pr-4">Starter</td>
                  <td className="py-2 pr-4">60</td>
                  <td className="py-2">10,000</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4">Growth</td>
                  <td className="py-2 pr-4">300</td>
                  <td className="py-2">100,000</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Enterprise</td>
                  <td className="py-2 pr-4">Custom</td>
                  <td className="py-2">Unlimited</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Error Codes */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Error Codes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Code</th>
                  <th className="text-left py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>400</code></td>
                  <td className="py-2">Bad Request - Invalid parameters</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>401</code></td>
                  <td className="py-2">Unauthorized - Invalid or missing API key</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>404</code></td>
                  <td className="py-2">Not Found - Resource doesn't exist</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>429</code></td>
                  <td className="py-2">Rate Limited - Too many requests</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code>500</code></td>
                  <td className="py-2">Server Error - Contact support</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </DocsLayout>
  );
}
