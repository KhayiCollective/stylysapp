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
    const { messages, products } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Styling chat request received:", { messageCount: messages?.length, hasProducts: !!products });

    // Build product context if available
    let productContext = "";
    if (products && products.length > 0) {
      productContext = `\n\nAvailable products in catalog:\n${products.map((p: any) => 
        `- ${p.name} ($${p.price}) - Category: ${p.category}, Color: ${p.color || 'N/A'}, Fit: ${p.fit || 'N/A'}`
      ).join('\n')}`;
    }

    const systemPrompt = `You are a friendly and knowledgeable personal stylist AI assistant for an online fashion store. Your role is to:

1. **Answer styling questions**: Help customers with outfit coordination, color matching, seasonal trends, body type recommendations, and occasion-appropriate dressing.

2. **Recommend products**: When customers describe what they're looking for, suggest specific products from the catalog that match their needs.

3. **Provide outfit ideas**: Create complete outfit suggestions using items from the catalog.

4. **Be conversational and helpful**: Use a warm, professional tone. Keep responses concise but informative.

Guidelines:
- Always be encouraging and positive about fashion choices
- Consider the customer's preferences, budget, and occasion
- When recommending products, mention specific items by name and price
- If asked about something outside fashion/styling, politely redirect to styling topics
- Use fashion terminology but explain it when needed
${productContext}`;

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

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Styling chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
