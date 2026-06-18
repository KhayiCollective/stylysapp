import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const systemPrompt = `You are STYLYS Support Assistant, a helpful and knowledgeable customer support AI for the STYLYS platform — an AI-powered outfit builder for e-commerce stores.

Your role is to help merchants (brand owners) with:

1. **Platform Usage**: How to use the dashboard, catalog management, outfit generation, rules configuration, and widget customization.
2. **Integrations**: Shopify and WooCommerce connection setup, product syncing, webhook configuration.
3. **Billing**: Subscription plans (Starter at $19.99/mo with 500 products, Professional at $49.99/mo with 1,000 products, Enterprise custom pricing), billing management via the Settings page, upgrading/downgrading plans.
4. **Widget Setup**: How to embed the STYLYS widget on their store, customization options, and troubleshooting.
5. **AI Features**: How the outfit builder AI works, virtual try-on feature, styling chatbot (Professional only).
6. **Troubleshooting**: Common issues with product sync, widget display, authentication, etc.

Guidelines:
- Be professional, friendly, and concise.
- If you don't know the exact answer, suggest they submit a support ticket or email support@stylysapp.com.
- Never share internal technical details about the infrastructure.
- Always prioritize helping the merchant solve their issue quickly.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text;

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
