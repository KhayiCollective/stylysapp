import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getJwtKey() {
  const secret = Deno.env.get("WIDGET_JWT_SECRET");
  if (!secret) throw new Error("WIDGET_JWT_SECRET not configured");
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createJwt(payload: Record<string, unknown>) {
  const key = await getJwtKey();
  return await create({ alg: "HS256", typ: "JWT" }, {
    ...payload,
    exp: getNumericDate(60 * 60), // 1 hour
  }, key);
}

async function verifyJwt(token: string) {
  const key = await getJwtKey();
  return await verify(token, key);
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    if (req.method !== "POST" && path !== "me") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();

    // --- SIGNUP ---
    if (path === "signup") {
      const { email, password, brand_id, name } = await req.json();
      if (!email || !password || !brand_id) {
        return new Response(JSON.stringify({ error: "email, password, and brand_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 8) {
        return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if brand exists
      const { data: brand } = await supabase.from("brands").select("id").eq("id", brand_id).single();
      if (!brand) {
        return new Response(JSON.stringify({ error: "Invalid brand" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for existing account
      const { data: existing } = await supabase
        .from("customer_accounts")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("brand_id", brand_id)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ error: "An account with this email already exists" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const password_hash = await bcrypt.hash(password);
      const { data: account, error } = await supabase
        .from("customer_accounts")
        .insert({ email: email.toLowerCase(), password_hash, brand_id, name: name || null })
        .select("id, email, name, brand_id")
        .single();

      if (error) {
        console.error("Signup insert error:", error);
        return new Response(JSON.stringify({ error: "Failed to create account" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = await createJwt({ sub: account.id, brand_id: account.brand_id, email: account.email });

      return new Response(JSON.stringify({ token, user: { id: account.id, email: account.email, name: account.name } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- LOGIN ---
    if (path === "login") {
      const { email, password, brand_id } = await req.json();
      if (!email || !password || !brand_id) {
        return new Response(JSON.stringify({ error: "email, password, and brand_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: account } = await supabase
        .from("customer_accounts")
        .select("id, email, name, password_hash, brand_id")
        .eq("email", email.toLowerCase())
        .eq("brand_id", brand_id)
        .single();

      if (!account) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await bcrypt.compare(password, account.password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid email or password" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = await createJwt({ sub: account.id, brand_id: account.brand_id, email: account.email });

      return new Response(JSON.stringify({ token, user: { id: account.id, email: account.email, name: account.name } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ME ---
    if (path === "me") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const payload = await verifyJwt(authHeader.replace("Bearer ", ""));
        const { data: account } = await supabase
          .from("customer_accounts")
          .select("id, email, name, brand_id, created_at")
          .eq("id", payload.sub as string)
          .single();

        if (!account) {
          return new Response(JSON.stringify({ error: "Account not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ user: account }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("widget-customer-auth error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
