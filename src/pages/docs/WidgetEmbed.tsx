import { DocsLayout } from "@/components/docs/DocsLayout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WidgetEmbed() {
  const embedCode = `<!-- STYLYS Outfit Widget -->
<div id="stylys-widget" data-product-id="{{ product.id }}"></div>
<script src="https://widget.stylys.app/embed.js" async></script>`;

  const liquidCode = `{% comment %} Add this to your product.liquid template {% endcomment %}
<div class="stylys-recommendations">
  <div 
    id="stylys-widget" 
    data-product-id="{{ product.id }}"
    data-brand-id="YOUR_BRAND_ID"
  ></div>
</div>
<script src="https://widget.stylys.app/embed.js" async></script>`;

  const customizationCode = `<div 
  id="stylys-widget" 
  data-product-id="{{ product.id }}"
  data-brand-id="YOUR_BRAND_ID"
  data-max-items="4"
  data-layout="carousel"
  data-show-prices="true"
  data-theme="light"
></div>`;

  return (
    <DocsLayout
      title="Widget Embed"
      description="Learn how to add the STYLYS outfit widget to your Shopify store."
    >
      <section className="space-y-8">
        {/* Quick Start */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Quick Start</h2>
          <p className="text-muted-foreground mb-4">
            Add the STYLYS widget to your product pages in just two steps:
          </p>
          <CodeBlock
            code={embedCode}
            language="html"
            title="Basic Embed Code"
          />
        </div>

        {/* Shopify Theme Integration */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Shopify Theme Integration</h2>
          <p className="text-muted-foreground mb-4">
            For Shopify stores, add the widget to your product template:
          </p>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Step 1: Access Theme Editor</h3>
              <ol className="list-decimal list-inside text-muted-foreground space-y-1 ml-4">
                <li>Go to Shopify Admin → Online Store → Themes</li>
                <li>Click "Actions" → "Edit code"</li>
                <li>Navigate to Templates → product.liquid (or sections/main-product.liquid)</li>
              </ol>
            </div>

            <div>
              <h3 className="font-medium mb-2">Step 2: Add Widget Code</h3>
              <p className="text-muted-foreground mb-3">
                Paste this code where you want the recommendations to appear (usually below the 
                product description or add-to-cart button):
              </p>
              <CodeBlock
                code={liquidCode}
                language="liquid"
                title="Liquid Template Code"
              />
            </div>

            <div>
              <h3 className="font-medium mb-2">Step 3: Save and Preview</h3>
              <p className="text-muted-foreground">
                Click "Save" and preview your changes. The widget will appear on all product pages.
              </p>
            </div>
          </div>
        </div>

        {/* Customization Options */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Customization Options</h2>
          <p className="text-muted-foreground mb-4">
            Customize the widget appearance with data attributes:
          </p>
          <CodeBlock
            code={customizationCode}
            language="html"
            title="Customization Example"
          />

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Attribute</th>
                  <th className="text-left py-2 pr-4 font-medium">Values</th>
                  <th className="text-left py-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>data-max-items</code></td>
                  <td className="py-2 pr-4">1-6</td>
                  <td className="py-2">Number of recommendations to show</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>data-layout</code></td>
                  <td className="py-2 pr-4">grid, carousel, list</td>
                  <td className="py-2">Widget layout style</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>data-show-prices</code></td>
                  <td className="py-2 pr-4">true, false</td>
                  <td className="py-2">Show product prices</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4"><code>data-theme</code></td>
                  <td className="py-2 pr-4">light, dark, auto</td>
                  <td className="py-2">Widget color theme</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code>data-add-to-cart</code></td>
                  <td className="py-2 pr-4">true, false</td>
                  <td className="py-2">Show add to cart buttons</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Placement Best Practices */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Placement Best Practices</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-green-600">✓ Recommended</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Below the product description</p>
                <p>• After the add-to-cart button</p>
                <p>• In a dedicated "Complete the Look" section</p>
                <p>• On cart/checkout pages</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-red-600">✗ Avoid</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>• Above the main product image</p>
                <p>• In pop-ups or modals</p>
                <p>• In the header or footer</p>
                <p>• Alongside unrelated content</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Advanced: CSS Customization */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">CSS Customization</h2>
          <p className="text-muted-foreground mb-4">
            Override default styles by targeting the widget classes:
          </p>
          <CodeBlock
            code={`.stylys-widget {
  /* Container styles */
  --stylys-primary: #000000;
  --stylys-border-radius: 8px;
}

.stylys-widget .product-card {
  /* Product card styles */
  border: 1px solid #e5e5e5;
}

.stylys-widget .add-to-cart-btn {
  /* Button styles */
  background-color: var(--stylys-primary);
}`}
            language="css"
            title="CSS Overrides"
          />
        </div>

        {/* Testing */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Testing Your Widget</h2>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2">
            <li>After adding the code, save your theme changes</li>
            <li>Visit a product page on your store</li>
            <li>Check that recommendations appear correctly</li>
            <li>Test the "Add to Cart" functionality</li>
            <li>Verify the widget looks good on mobile devices</li>
          </ol>

          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Tip:</strong> Use browser developer tools to inspect the widget and 
              troubleshoot any styling issues.
            </p>
          </div>
        </div>
      </section>
    </DocsLayout>
  );
}
