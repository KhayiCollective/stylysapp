import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DocsLayout } from "@/components/docs/DocsLayout";

export default function FAQ() {
  const generalFaqs = [
    {
      question: "What is STYLYS?",
      answer: "STYLYS is an AI-powered outfit recommendation platform for e-commerce stores. It analyzes your product catalog and generates personalized outfit suggestions for your customers, helping increase average order value and customer engagement."
    },
    {
      question: "Which platforms does STYLYS support?",
      answer: "Currently, STYLYS integrates with Shopify stores. We're working on adding support for other platforms like WooCommerce and BigCommerce. Contact us if you'd like to be notified when your platform is supported."
    },
    {
      question: "How does the AI generate outfit recommendations?",
      answer: "Our AI analyzes your product catalog to understand categories, colors, styles, and patterns. It then uses fashion rules and customer preferences to create cohesive outfit combinations that complement each other stylistically."
    },
    {
      question: "Can I customize the recommendations?",
      answer: "Yes! You can configure rules like color harmony, category balance, price ranges, and seasonal relevance. The widget appearance is also fully customizable to match your brand's look and feel."
    }
  ];

  const integrationFaqs = [
    {
      question: "How do I connect my Shopify store?",
      answer: "From your dashboard, go to Settings → Shopify Connection. Enter your store URL (e.g., mystore.myshopify.com) and authorize STYLYS to access your product catalog. Products will sync automatically."
    },
    {
      question: "What Shopify permissions does STYLYS need?",
      answer: "STYLYS requires read access to products and product listings to sync your catalog, plus write access to checkouts to enable the 'Add to Cart' functionality. We never access customer personal data or payment information."
    },
    {
      question: "How often does my catalog sync?",
      answer: "Your catalog syncs in real-time using Shopify webhooks. When you add, update, or delete products in Shopify, the changes are automatically reflected in STYLYS within seconds."
    },
    {
      question: "Can I manually trigger a sync?",
      answer: "Yes, you can force a full catalog sync from Settings → Sync Status by clicking the 'Sync Now' button. This is useful if you suspect any products are out of sync."
    }
  ];

  const widgetFaqs = [
    {
      question: "Where should I place the widget on my product pages?",
      answer: "We recommend placing the widget below the product description or after the add-to-cart button. This ensures customers see recommendations after viewing the main product details."
    },
    {
      question: "Can I customize the widget appearance?",
      answer: "Yes! You can customize colors, fonts, layout style (grid/carousel/list), number of recommendations, and whether to show prices and add-to-cart buttons. All settings are available in the Widget page."
    },
    {
      question: "Does the widget work on mobile devices?",
      answer: "Absolutely. The widget is fully responsive and optimized for all screen sizes. It automatically adjusts its layout for mobile, tablet, and desktop views."
    },
    {
      question: "Will the widget slow down my store?",
      answer: "No. The widget loads asynchronously and doesn't block your page from rendering. It's optimized for performance with lazy loading and minimal resource usage."
    }
  ];

  const billingFaqs = [
    {
      question: "Is there a free trial?",
      answer: "Yes! All new accounts start with a 14-day free trial with full access to all features. No credit card required to start."
    },
    {
      question: "What happens when my trial ends?",
      answer: "After your trial, you'll be prompted to choose a plan. If you don't subscribe, your widget will stop showing on your store, but your data will be preserved for 30 days."
    },
    {
      question: "Can I cancel my subscription?",
      answer: "Yes, you can cancel anytime from Settings. Your subscription will remain active until the end of your current billing period."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer refunds within 7 days of your initial subscription. Contact support@stylys.app with your request."
    }
  ];

  const troubleshootingFaqs = [
    {
      question: "The widget isn't appearing on my store",
      answer: "First, ensure your Shopify store is connected and products are synced. Then verify the embed code is correctly placed in your theme. Check the browser console for any JavaScript errors. If issues persist, contact support."
    },
    {
      question: "Products aren't syncing from Shopify",
      answer: "Check your Shopify connection status in Settings. If it shows as disconnected, try reconnecting. Also verify that your Shopify store has products with 'Active' status. You can trigger a manual sync from the Sync Status section."
    },
    {
      question: "Recommendations seem irrelevant",
      answer: "STYLYS improves over time as it learns your catalog. Make sure your products have proper categories, colors, and tags in Shopify. You can also adjust the matching rules in Settings → Rules."
    },
    {
      question: "The 'Add to Cart' button isn't working",
      answer: "Ensure your Shopify integration has 'write_checkouts' permission. Try disconnecting and reconnecting your store to refresh permissions. The button requires products to be in stock and available for sale."
    }
  ];

  return (
    <DocsLayout
      title="Frequently Asked Questions"
      description="Find answers to common questions about STYLYS."
    >
      <section className="space-y-8">
        {/* General */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">General</h2>
          <Accordion type="single" collapsible className="w-full">
            {generalFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`general-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Integration */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Integration</h2>
          <Accordion type="single" collapsible className="w-full">
            {integrationFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`integration-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Widget */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Widget</h2>
          <Accordion type="single" collapsible className="w-full">
            {widgetFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`widget-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Billing */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Billing</h2>
          <Accordion type="single" collapsible className="w-full">
            {billingFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`billing-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Troubleshooting */}
        <div>
          <h2 className="font-display text-2xl font-medium mb-4">Troubleshooting</h2>
          <Accordion type="single" collapsible className="w-full">
            {troubleshootingFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`troubleshooting-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Still need help */}
        <div className="pt-8 border-t">
          <div className="text-center">
            <h3 className="font-display text-xl font-medium mb-2">Still have questions?</h3>
            <p className="text-muted-foreground mb-4">
              Our support team is here to help.
            </p>
            <Link to="/support">
              <Button>Contact Support</Button>
            </Link>
          </div>
        </div>
      </section>
    </DocsLayout>
  );
}
