import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="font-display text-4xl font-medium mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 28, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-2xl font-medium mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using STYLYS ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              STYLYS is an AI-powered outfit recommendation platform designed for e-commerce merchants. The Service includes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
              <li>AI-generated outfit recommendations</li>
              <li>Product catalog synchronization with Shopify</li>
              <li>Embeddable widgets for merchant storefronts</li>
              <li>Customer preference and styling quiz tools</li>
              <li>Analytics and performance tracking</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use the Service, you must create an account and provide accurate, complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">4. Shopify Integration</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By connecting your Shopify store to STYLYS, you:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Grant us permission to access your store's product catalog</li>
              <li>Agree to comply with Shopify's API Terms of Service</li>
              <li>Acknowledge that we will receive product, collection, and inventory data</li>
              <li>Understand that widget functionality depends on active Shopify connection</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">5. Data Processing and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              For store customer data, STYLYS acts as a <strong>data processor</strong> on behalf of merchants (data controllers). Our data practices are governed by our{" "}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>, which forms part of these Terms. By using the Service, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>We collect customer data only through our widget interface, not from Shopify customer records</li>
              <li>Customer data is used exclusively for customer service, app functionality, analytics, and personalization</li>
              <li>We do not use customer data for marketing or advertising purposes</li>
              <li>We never sell, rent, or trade personal information to third parties</li>
              <li>All data is encrypted in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>Multi-tenant data isolation is enforced through row-level security policies</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to interfere with or disrupt the Service</li>
              <li>Reverse engineer or decompile any part of the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights of others</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including its original content, features, and functionality, is owned by STYLYS and is protected by international copyright, trademark, and other intellectual property laws. You retain ownership of your product data and content.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">8. Subscription and Billing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              STYLYS offers subscription-based pricing:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>All fees are non-refundable except as required by law</li>
              <li>We reserve the right to modify pricing with 30 days' notice</li>
              <li>Failure to pay may result in suspension or termination of service</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">9. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable for maintenance, updates, or due to circumstances beyond our control.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">10. Shopify Compliance</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We comply with Shopify's mandatory requirements for apps, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Processing <code className="text-sm bg-muted px-1 rounded">customers/data_request</code> webhooks and responding within 30 days</li>
              <li>Processing <code className="text-sm bg-muted px-1 rounded">customers/redact</code> webhooks to permanently delete individual customer data</li>
              <li>Processing <code className="text-sm bg-muted px-1 rounded">shop/redact</code> webhooks to purge all merchant and customer data upon app uninstallation</li>
              <li>Verifying all compliance webhooks using HMAC signatures</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Upon app uninstallation, all merchant data—including synced products, customer accounts, outfit data, and widget configurations—is permanently deleted.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, STYLYS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">12. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE ERROR-FREE OR UNINTERRUPTED.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">13. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless STYLYS and its affiliates from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">14. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account immediately, without prior notice, for any breach of these Terms. Upon termination, your right to use the Service will cease immediately. You may also terminate your account at any time through your account settings. Upon termination, your data will be handled in accordance with our{" "}
              <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and Shopify compliance requirements.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">15. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Material changes will be communicated via email or through the Service. Continued use after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">16. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">17. Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms, please contact us:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>STYLYS</strong><br />
                Email: legal@stylys.app<br />
                Support: <Link to="/support" className="text-primary hover:underline">Contact Support</Link>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <span>•</span>
            <Link to="/docs" className="hover:text-foreground transition-colors">Documentation</Link>
            <span>•</span>
            <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
