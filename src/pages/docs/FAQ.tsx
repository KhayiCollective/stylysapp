import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DocsLayout } from "@/components/docs/DocsLayout";

export default function FAQ() {
  const generalFaqs = [
    {
      question: "What is STYLYS?",
      answer: "STYLYS is an AI-powered outfit recommendation platform for e-commerce stores. It analyzes your product catalog and generates personalized outfit suggestions for your customers — including virtual try-on — helping increase average order value and customer engagement. A STYLYS AI styling chatbot is also included on the Pro plan."
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
      answer: "Install STYLYS from the Shopify App Store (apps.shopify.com/stylys) and approve the permissions when Shopify asks. Your store connects automatically and your products start syncing right away. There's no separate sign-up or store URL to enter."
    },
    {
      question: "What Shopify permissions does STYLYS need?",
      answer: "STYLYS only requests read-only access — to your products, inventory, and theme settings — to sync your catalog and confirm the widget is properly embedded. We never access customer personal data or payment information."
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
      answer: "The STYLYS widget appears automatically as a floating button in the bottom-right corner of your storefront — no manual placement needed. When a customer clicks it, a panel slides in from the right showing outfit recommendations. On the Pro plan, a second floating button for the AI styling chatbot appears just above it."
    },
    {
      question: "Can I customize the widget appearance?",
      answer: "Widget appearance customization isn't available yet — the widget currently uses a standard, pre-designed look on your storefront."
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
      answer: "Yes! Every plan starts with a 3-day free trial with full access to all features. After the trial, charges appear on your regular Shopify bill."
    },
    {
      question: "What happens when my trial ends?",
      answer: "You choose your plan and approve it in Shopify when you install. When the 3-day trial ends, the plan you picked starts automatically and appears on your regular Shopify bill. If you uninstall before the trial ends, you won't be charged."
    },
    {
      question: "Can I cancel my subscription?",
      answer: "Yes. To cancel, uninstall STYLYS from your Shopify admin (Settings → Apps). Shopify stops the subscription automatically, and billing is handled through your Shopify account."
    },
    {
      question: "Do you offer refunds?",
      answer: "Subscriptions are billed month-to-month, and you can cancel anytime — you'll retain access until the end of your current billing period. We don't offer refunds for partial billing periods. Contact support@stylysapp.com with any billing questions."
    }
  ];

  const troubleshootingFaqs = [
    {
      question: "The widget isn't appearing on my store",
      answer: "First, ensure your Shopify store is connected and products are synced. Then, in your Shopify admin, go to Online Store → Themes → Customize → App embeds, and make sure STYLYS is toggled on. Check the browser console for any JavaScript errors. If issues persist, contact support."
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
      answer: "The 'Add to Cart' button uses your store's built-in cart API directly, so no special permissions are required. If it's not working, check that the product or variant is in stock and available for sale, and check the browser console for errors. If issues persist, contact support."
    }
  ];

  // FAQPage structured data: lets Google read every answer (the accordion only
  // renders answers when opened) and can show them as rich results.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [...generalFaqs, ...integrationFaqs, ...widgetFaqs, ...billingFaqs, ...troubleshootingFaqs].map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <DocsLayout
      title="Frequently Asked Questions"
      description="Find answers to common questions about STYLYS."
    >
      <section className="space-y-8">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
        />
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
