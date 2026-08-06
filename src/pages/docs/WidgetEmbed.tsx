import { DocsLayout } from "@/components/docs/DocsLayout";

export default function WidgetEmbed() {
  return (
    <DocsLayout
      title="Widget Embed"
      description="Learn how to activate the STYLYS outfit widget on your store."
    >
      <section className="space-y-8">
        <div>
          <p className="text-muted-foreground mb-6">
            STYLYS uses a Shopify theme app embed — no code required.
          </p>

          <h2 className="font-display text-2xl font-medium mb-4">To activate the widget</h2>
          <ol className="list-decimal list-inside text-muted-foreground space-y-2 ml-2">
            <li>In your Shopify admin, go to Online Store → Themes → Customize</li>
            <li>Open the App embeds panel (bottom-left icon)</li>
            <li>Toggle on STYLYS</li>
          </ol>

          <p className="text-muted-foreground mt-6">
            To verify it's working, visit any page on your storefront and look for the floating STYLYS button in the bottom-right corner.
          </p>
        </div>
      </section>
    </DocsLayout>
  );
}
