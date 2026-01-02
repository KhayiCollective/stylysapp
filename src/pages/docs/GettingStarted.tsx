import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocsLayout } from "@/components/docs/DocsLayout";

export default function GettingStarted() {
  return (
    <DocsLayout
      title="Getting Started"
      description="Set up STYLYS for your Shopify store in under 5 minutes."
    >
      <section className="space-y-6">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <h3 className="font-medium text-primary mb-2">Quick Start</h3>
          <p className="text-sm text-muted-foreground">
            Follow these steps to start showing AI-powered outfit recommendations on your store.
          </p>
        </div>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <CardTitle className="text-lg">Create Your Account</CardTitle>
                <CardDescription>Sign up and set up your brand profile</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Visit the signup page and create your account</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Enter your brand name and basic information</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Verify your email address</span>
              </li>
            </ul>
            <Link to="/auth">
              <Button className="mt-4 gap-2">
                Sign Up <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <CardTitle className="text-lg">Connect Your Shopify Store</CardTitle>
                <CardDescription>Link your store to sync products automatically</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Navigate to the Shopify Connection page</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Enter your Shopify store URL (e.g., mystore.myshopify.com)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Authorize STYLYS to access your product catalog</span>
              </li>
            </ul>
            <Link to="/docs/shopify-setup">
              <Button variant="outline" className="mt-4 gap-2">
                View Setup Guide <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <CardTitle className="text-lg">Configure Your Widget</CardTitle>
                <CardDescription>Customize the look and behavior of recommendations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Go to Widget Settings in your dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Set your brand colors and fonts</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Choose the number of recommendations to show</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step 4 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <CardTitle className="text-lg">Embed on Your Store</CardTitle>
                <CardDescription>Add the widget code to your Shopify theme</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Copy your unique embed code from the Widget page</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Add it to your product page template in Shopify</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-green-500 mt-0.5" />
                <span>Preview and publish your changes</span>
              </li>
            </ul>
            <Link to="/docs/widget-embed">
              <Button variant="outline" className="mt-4 gap-2">
                Embedding Guide <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <div className="pt-8 border-t">
          <h3 className="font-display text-xl font-medium mb-4">What's Next?</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/docs/shopify-setup">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">Shopify Setup Details</CardTitle>
                  <CardDescription>
                    Learn about OAuth, webhooks, and app proxy configuration
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
            <Link to="/docs/api">
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">API Reference</CardTitle>
                  <CardDescription>
                    Advanced integration options for developers
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </DocsLayout>
  );
}
