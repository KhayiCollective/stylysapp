import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
        <h1 className="font-display text-4xl font-medium mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: February 28, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="font-display text-2xl font-medium mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              STYLYS ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered outfit recommendation platform and Shopify app.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              For store customer data, we act as a <strong>data processor</strong> on behalf of merchants (data controllers). Merchants are responsible for ensuring they have appropriate legal bases for collecting customer data through our widget.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">2. Information We Collect</h2>
            <h3 className="font-medium text-lg mb-2">2.1 Information from Merchants</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Account information (email, business name, contact details)</li>
              <li>Shopify store data (products, inventory, pricing)</li>
              <li>Widget configuration preferences</li>
              <li>Usage analytics and performance metrics</li>
            </ul>

            <h3 className="font-medium text-lg mb-2 mt-4">2.2 Information from Store Customers</h3>
            <p className="text-muted-foreground leading-relaxed mb-2">
              We do not access Shopify customer records directly. All customer data is collected through our widget interface and includes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Email address (voluntarily provided when creating a widget account)</li>
              <li>Name (optional, self-reported)</li>
              <li>Style preferences (colors, fits, occasions)</li>
              <li>Body shape preferences (optional, self-reported)</li>
              <li>Outfit interaction data (views, saves, purchases)</li>
              <li>Quiz responses for personalization</li>
            </ul>

            <h3 className="font-medium text-lg mb-2 mt-4">2.3 Automatically Collected Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Device and browser information</li>
              <li>IP address and approximate location</li>
              <li>Usage patterns and interaction data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use the information we collect for the following purposes:
            </p>

            <h3 className="font-medium text-lg mb-2">3.1 Customer Service</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Respond to support inquiries and troubleshoot issues</li>
              <li>Provide customer support via our support chat and ticketing system</li>
            </ul>

            <h3 className="font-medium text-lg mb-2 mt-4">3.2 App Functionality</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Authenticate widget accounts (email and password)</li>
              <li>Process merchant subscriptions and billing</li>
              <li>Sync product catalogs from your Shopify store</li>
              <li>Ensure security and prevent fraud</li>
            </ul>

            <h3 className="font-medium text-lg mb-2 mt-4">3.3 Analytics</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Measure recommendation performance and accuracy</li>
              <li>Track sync history and widget metrics</li>
              <li>Analyze usage patterns to improve our platform</li>
            </ul>

            <h3 className="font-medium text-lg mb-2 mt-4">3.4 Personalization</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Generate AI-powered outfit recommendations based on style preferences</li>
              <li>Customize the shopping experience using quiz responses and saved preferences</li>
              <li>Improve our AI algorithms and recommendation accuracy</li>
            </ul>

            <p className="text-muted-foreground leading-relaxed mt-4 font-medium">
              We do not use customer data for marketing or advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Cloud hosting, analytics, and AI processing services</li>
              <li><strong>Shopify:</strong> As required for app functionality and compliance</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with mergers or acquisitions</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement industry-standard security measures to protect your personal information, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Encryption in transit:</strong> All data is transmitted using TLS 1.2 or higher</li>
              <li><strong>Encryption at rest:</strong> Stored data is encrypted using AES-256</li>
              <li><strong>Multi-tenant isolation:</strong> Row-level security (RLS) policies ensure strict data separation between merchants</li>
              <li><strong>Data masking:</strong> Masked database views prevent bulk exposure of sensitive information such as email addresses and access tokens</li>
              <li><strong>Password security:</strong> Customer widget passwords are hashed using bcrypt</li>
              <li><strong>Access logging:</strong> All backend function invocations are logged for audit purposes</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              While no method of transmission over the Internet is 100% secure, we continuously review and improve our security practices.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide services. Merchants can request data deletion at any time. Customer preference data is retained for 24 months of inactivity, after which it is automatically deleted.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Upon app uninstallation, all merchant and associated customer data is permanently deleted in response to Shopify's <code className="text-sm bg-muted px-1 rounded">shop/redact</code> webhook. Individual customer data is deleted upon receiving a <code className="text-sm bg-muted px-1 rounded">customers/redact</code> request from Shopify.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Receive your data in a portable format</li>
              <li><strong>Opt-out:</strong> Decline certain data collection practices</li>
              <li><strong>Do Not Sell My Information:</strong> Request that we do not sell your personal information (we never do)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">8. GDPR Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              For users in the European Economic Area (EEA), we process personal data based on legitimate interests, consent, or contractual necessity. You have the right to lodge a complaint with a supervisory authority.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">9. CCPA Compliance</h2>
            <p className="text-muted-foreground leading-relaxed">
              California residents have specific rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information is collected, the right to delete personal information, and the right to opt-out of the sale of personal information. We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">10. Shopify Compliance</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We comply with Shopify's mandatory data protection requirements for apps. Specifically:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>We handle <code className="text-sm bg-muted px-1 rounded">customers/data_request</code> webhooks to provide customer data reports within 30 days</li>
              <li>We handle <code className="text-sm bg-muted px-1 rounded">customers/redact</code> webhooks to permanently delete individual customer data upon request</li>
              <li>We handle <code className="text-sm bg-muted px-1 rounded">shop/redact</code> webhooks to purge all merchant and customer data upon app uninstallation</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              All compliance webhooks are verified using HMAC signatures to ensure request authenticity.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">11. No Sale of Personal Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We never sell, rent, or trade your personal information to third parties for monetary or other valuable consideration. This applies to all users, including merchants, their customers, and visitors.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">12. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies for authentication and functionality, and optional analytics cookies to understand usage patterns. You can control cookie preferences through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">13. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not directed to individuals under 16 years of age. We do not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">14. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="font-display text-2xl font-medium mb-4">15. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>STYLYS</strong><br />
                Email: support@stylysapp.com<br />
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
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
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
