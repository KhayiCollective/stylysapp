import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Image, FileText, ExternalLink } from "lucide-react";

const AppStoreAssets = () => {
  const assets = [
    {
      title: "App Icon",
      description: "1024x1024px PNG for Shopify App Store listing",
      dimensions: "1024 × 1024",
      format: "PNG",
      icon: Image,
    },
    {
      title: "Feature Banner",
      description: "1600x900px hero image for app listing",
      dimensions: "1600 × 900",
      format: "PNG",
    },
    {
      title: "Screenshot 1 - Dashboard",
      description: "Analytics dashboard view",
      dimensions: "1920 × 1080",
      format: "PNG",
    },
    {
      title: "Screenshot 2 - Outfit Generator",
      description: "AI outfit generation interface",
      dimensions: "1920 × 1080",
      format: "PNG",
    },
    {
      title: "Screenshot 3 - Widget Preview",
      description: "Embedded widget on storefront",
      dimensions: "1920 × 1080",
      format: "PNG",
    },
    {
      title: "Screenshot 4 - Catalog Management",
      description: "Product catalog sync view",
      dimensions: "1920 × 1080",
      format: "PNG",
    },
  ];

  const copyAssets = [
    {
      title: "App Name",
      content: "STYLYS - AI Outfit Builder",
    },
    {
      title: "Tagline",
      content: "Boost sales with AI-powered outfit recommendations",
    },
    {
      title: "Short Description",
      content: "STYLYS helps fashion brands increase average order value by 35% with intelligent outfit recommendations. Our AI creates personalized complete looks that help customers discover and buy more products.",
    },
    {
      title: "Key Benefits",
      content: `• Increase AOV by 35% with complete outfit suggestions
• AI-powered style matching based on color, fit, and trends
• Seamless integration - setup in under 5 minutes
• Customer preference tracking and personalization
• Real-time analytics and conversion tracking`,
    },
  ];

  return (
    <DashboardLayout
      title="App Store Assets"
      description="Marketing assets for Shopify App Store submission"
    >
      <div className="space-y-8">
        {/* Image Assets */}
        <section>
          <h2 className="text-xl font-display font-semibold mb-4">Image Assets</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset, index) => (
              <Card key={index} className="card-editorial">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{asset.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {asset.dimensions} • {asset.format}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{asset.description}</p>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
                    <span className="text-xs text-muted-foreground">Preview placeholder</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Asset
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Copy Assets */}
        <section>
          <h2 className="text-xl font-display font-semibold mb-4">Marketing Copy</h2>
          <div className="space-y-4">
            {copyAssets.map((copy, index) => (
              <Card key={index} className="card-editorial">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{copy.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(copy.content)}
                    >
                      Copy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {copy.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Submission Checklist */}
        <section>
          <h2 className="text-xl font-display font-semibold mb-4">Submission Checklist</h2>
          <Card className="card-editorial">
            <CardContent className="pt-6">
              <ul className="space-y-3">
                {[
                  "App icon uploaded (1024x1024)",
                  "Feature banner uploaded (1600x900)",
                  "At least 3 screenshots uploaded",
                  "App name and tagline finalized",
                  "Short and detailed descriptions written",
                  "Privacy policy URL configured",
                  "Support contact email verified",
                  "OAuth redirect URLs configured",
                  "Webhook endpoints tested",
                  "App proxy endpoint verified",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded border border-border" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* External Links */}
        <section>
          <h2 className="text-xl font-display font-semibold mb-4">Useful Links</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="card-editorial">
              <CardContent className="pt-6">
                <a
                  href="https://partners.shopify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">Shopify Partners</p>
                      <p className="text-sm text-muted-foreground">Submit your app for review</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              </CardContent>
            </Card>
            <Card className="card-editorial">
              <CardContent className="pt-6">
                <a
                  href="https://shopify.dev/docs/apps/store/requirements"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium group-hover:text-primary transition-colors">App Requirements</p>
                      <p className="text-sm text-muted-foreground">Review submission guidelines</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default AppStoreAssets;
