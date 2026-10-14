import { DocsLayout } from "@/components/docs/DocsLayout";

export default function WidgetEmbed() {
  return (
    <DocsLayout
      title="Widget Embed"
      description="Learn how to activate the STYLYS outfit widget and the Complete the Look section on your store."
    >
      <section className="space-y-10">
        <div>
          <p className="text-muted-foreground mb-6">
            STYLYS has two parts that you turn on in your Shopify theme — no code required: the floating STYLYS widget (an app embed) and the Complete the Look section for product pages (an app block).
          </p>

          <h2 className="font-display text-2xl font-medium mb-4">1. The floating STYLYS widget</h2>
          <p className="text-muted-foreground mb-3">
            Shoppers open it to get outfits built from their profile and style quiz, try outfits on, and manage their wishlist. On product pages it also adds a Try On button on the product photo.
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-2">
            <li>In your Shopify admin, go to Online Store → Themes → Customize</li>
            <li>Open the App embeds panel (bottom-left icon)</li>
            <li>Toggle on STYLYS</li>
            <li>Save</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            To verify it's working, visit any page on your storefront and look for the floating STYLYS button in the bottom-right corner.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-medium mb-4">2. Complete the Look on product pages</h2>
          <p className="text-muted-foreground mb-3">
            An inline section that shows three AI-built outfits around the product the shopper is viewing, each with Try On and Add All buttons. It is available on every plan.
          </p>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-2">
            <li>Go to Online Store → Themes → Customize and open a Product page template</li>
            <li>In the product information section, click Add block → Apps → STYLYS Complete the Look</li>
            <li>Drag the block to where you want it (for example, below the product description)</li>
            <li>Save</li>
          </ol>
          <p className="text-muted-foreground mt-4">
            Don't see STYLYS under Apps? Make sure you've approved the latest version of the app in your Shopify admin and reload the theme editor.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Pro plan: wishlist and pick-your-own try-on</h2>
          <p className="text-muted-foreground">
            On the Professional plan, hearts appear automatically on the product photo, on each item in Complete the Look, and inside the widget. Signed-in shoppers save individual pieces, then pick the ones they like from the Wishlist tab and try them on together. No extra setup is needed beyond the two steps above.
          </p>
        </div>
      </section>
    </DocsLayout>
  );
}
