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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are STYLYS Support Assistant, a helpful and knowledgeable customer support AI for the STYLYS platform — an AI-powered outfit builder for e-commerce stores.

Your role is to help merchants (brand owners) with:

1. **Platform Usage**: How to use the dashboard, catalog management, outfit generation, rules configuration, and widget customization.
2. **Integrations**: Shopify and WooCommerce connection setup, product syncing, webhook configuration.
3. **Billing**: Subscription plans (Starter at $14.99/mo with 500 products, Professional at $29.99/mo with 1,000 products), billing management via the Settings page, upgrading/downgrading plans.
4. **Widget Setup**: How to embed the STYLYS widget on their store, customization options, and troubleshooting.
5. **AI Features**: How the outfit builder AI works, virtual try-on feature, styling chatbot (Professional only).
6. **Troubleshooting**: Common issues with product sync, widget display, authentication, etc.

Guidelines:
- Be professional, friendly, and concise.
- If you don't know the exact answer, suggest they submit a support ticket or email info@hausofkhayi.com.
- Never share internal technical details about the infrastructure.
- Always prioritize helping the merchant solve their issue quickly.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
