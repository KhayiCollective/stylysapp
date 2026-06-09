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
    exp: getNumericDate(30 * 24 * 60 * 60),
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

async function getCustomerFromAuth(req: Request): Promise<{ sub: string; brand_id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyJwt(authHeader.replace("Bearer ", ""));
    return { sub: payload.sub as string, brand_id: payload.brand_id as string, email: payload.email as string };
  } catch {
    return null;
  }
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function resolveBrandId(supabase: ReturnType<typeof getSupabaseAdmin>, brand_id?: string, shop?: string): Promise<string | null> {
  if (brand_id) {
    const { data } = await supabase.from("brands").select("id").eq("id", brand_id).maybeSingle();
    if (data?.id) return data.id;
  }
  if (shop) {
    const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
    const { data } = await supabase.from("brands").select("id").eq("shopify_store_domain", shopDomain).maybeSingle();
    if (data?.id) return data.id;
  }
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    const supabase = getSupabaseAdmin();

    // --- SIGNUP ---
    if (path === "signup" && req.method === "POST") {
      const { email, password, brand_id, shop, name } = await req.json();
      if (!email || !password || (!brand_id && !shop)) {
        return json({ error: "email, password, and brand_id (or shop) are required" }, 400);
      }
      if (password.length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }

      const resolvedBrandId = await resolveBrandId(supabase, brand_id, shop);
      if (!resolvedBrandId) return json({ error: "Invalid brand" }, 400);


      const { data: existing } = await supabase
        .from("customer_accounts")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("brand_id", resolvedBrandId)
        .maybeSingle();

      if (existing) {
        return json({ error: "An account with this email already exists" }, 409);
      }

      const password_hash = bcrypt.hashSync(password);

      // Create a linked customer record for style preferences
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({ email: email.toLowerCase(), brand_id: resolvedBrandId })
        .select("id")
        .single();

      if (custErr) {
        console.error("Customer record error:", custErr);
      }

      const { data: account, error } = await supabase
        .from("customer_accounts")
        .insert({
          email: email.toLowerCase(),
          password_hash,
          brand_id: resolvedBrandId,
          name: name || null,
          customer_id: customer?.id || null,
        })
        .select("id, email, name, brand_id, customer_id")
        .single();


      if (error) {
        console.error("Signup insert error:", error);
        return json({ error: "Failed to create account" }, 500);
      }

      const token = await createJwt({ sub: account.id, brand_id: account.brand_id, email: account.email, customer_id: account.customer_id });

      return json({ token, user: { id: account.id, email: account.email, name: account.name, customer_id: account.customer_id } });
    }

    // --- LOGIN ---
    if (path === "login" && req.method === "POST") {
      const { email, password, brand_id, shop } = await req.json();
      if (!email || !password || (!brand_id && !shop)) {
        return json({ error: "email, password, and brand_id (or shop) are required" }, 400);
      }

      const resolvedBrandId = await resolveBrandId(supabase, brand_id, shop);
      if (!resolvedBrandId) return json({ error: "Invalid brand" }, 400);

      const { data: account } = await supabase
        .from("customer_accounts")
        .select("id, email, name, password_hash, brand_id, customer_id")
        .eq("email", email.toLowerCase())
        .eq("brand_id", resolvedBrandId)
        .maybeSingle();


      if (!account) {
        return json({ error: "Invalid email or password" }, 401);
      }

      const valid = bcrypt.compareSync(password, account.password_hash);
      if (!valid) {
        return json({ error: "Invalid email or password" }, 401);
      }

      const token = await createJwt({ sub: account.id, brand_id: account.brand_id, email: account.email, customer_id: account.customer_id });

      return json({ token, user: { id: account.id, email: account.email, name: account.name, customer_id: account.customer_id } });
    }

    // --- ME ---
    if (path === "me") {
      const customer = await getCustomerFromAuth(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const { data: account } = await supabase
        .from("customer_accounts")
        .select("id, email, name, brand_id, customer_id, created_at, photo_url")
        .eq("id", customer.sub)
        .single();

      if (!account) return json({ error: "Account not found" }, 404);

      // Refresh signed photo URL if we have one stored (path-based)
      if (account.photo_url) {
        for (const ext of ["jpg", "png", "webp"]) {
          const filePath = `${customer.sub}/photo.${ext}`;
          const { data: signed } = await supabase.storage
            .from("customer-photos")
            .createSignedUrl(filePath, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) {
            account.photo_url = signed.signedUrl;
            break;
          }
        }
      }

      // Also fetch style profile if linked
      let styleProfile = null;
      if (account.customer_id) {
        const { data: cust } = await supabase
          .from("customers")
          .select("style_preferences, preferred_colors, avoided_colors, body_shape, size_info, occasions, budget_range, quiz_completed_at")
          .eq("id", account.customer_id)
          .single();
        styleProfile = cust;
      }

      return json({ user: { ...account, styleProfile } });
    }

    // --- PHOTO UPLOAD ---
    if (path === "photo" && req.method === "POST") {
      const customer = await getCustomerFromAuth(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const { photoBase64 } = await req.json();
      if (!photoBase64) return json({ error: "photoBase64 is required" }, 400);

      // Extract base64 data and detect content type
      const base64Match = photoBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
      if (!base64Match && !photoBase64.match(/^[A-Za-z0-9+/=]+$/)) {
        return json({ error: "Invalid image format. Accepted: JPG, PNG, WebP." }, 400);
      }
      const detectedType = base64Match ? base64Match[1] : "jpeg";
      const rawBase64 = base64Match ? base64Match[2] : photoBase64;

      // Decode base64 to Uint8Array
      const binaryString = atob(rawBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Validate file size (10MB max)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (bytes.length > MAX_SIZE) {
        return json({ error: "Image must be under 10MB" }, 400);
      }

      // Determine content type and extension
      const mimeMap: Record<string, string> = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
      const extMap: Record<string, string> = { jpeg: "jpg", jpg: "jpg", png: "png", webp: "webp" };
      const contentType = mimeMap[detectedType] || "image/jpeg";
      const ext = extMap[detectedType] || "jpg";
      const filePath = `${customer.sub}/photo.${ext}`;

      // Delete any previous photos with different extensions to avoid orphans
      const otherExts = ["jpg", "png", "webp"].filter(e => e !== ext);
      for (const oldExt of otherExts) {
        await supabase.storage.from("customer-photos").remove([`${customer.sub}/photo.${oldExt}`]);
      }

      // Upload to storage (upsert)
      const { error: uploadErr } = await supabase.storage
        .from("customer-photos")
        .upload(filePath, bytes, {
          contentType,
          upsert: true,
        });

      if (uploadErr) {
        console.error("Photo upload error:", uploadErr);
        return json({ error: "Failed to upload photo" }, 500);
      }

      // Generate a signed URL (7 days). Bucket is private to protect biometric data.
      const { data: urlData, error: signErr } = await supabase.storage
        .from("customer-photos")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (signErr || !urlData?.signedUrl) {
        console.error("Signed URL error:", signErr);
        return json({ error: "Failed to generate photo URL" }, 500);
      }

      const photo_url = urlData.signedUrl;

      // Update customer_accounts
      await supabase
        .from("customer_accounts")
        .update({ photo_url })
        .eq("id", customer.sub);

      return json({ photo_url });
    }

    // --- UPDATE PROFILE (style preferences & sizing) ---
    if (path === "profile" && req.method === "POST") {
      const customer = await getCustomerFromAuth(req);
      if (!customer) return json({ error: "Unauthorized" }, 401);

      const body = await req.json();
      const { name, style_preferences, preferred_colors, avoided_colors, body_shape, size_info, occasions, budget_range } = body;

      // Update name on customer_accounts
      if (name !== undefined) {
        await supabase
          .from("customer_accounts")
          .update({ name })
          .eq("id", customer.sub);
      }

      // Get or create linked customer record
      const { data: account } = await supabase
        .from("customer_accounts")
        .select("customer_id, brand_id")
        .eq("id", customer.sub)
        .single();

      if (!account) return json({ error: "Account not found" }, 404);

      let customerId = account.customer_id;

      if (!customerId) {
        const { data: newCust, error: custErr } = await supabase
          .from("customers")
          .insert({ email: customer.email, brand_id: account.brand_id })
          .select("id")
          .single();

        if (custErr) {
          console.error("Create customer error:", custErr);
          return json({ error: "Failed to create style profile" }, 500);
        }
        customerId = newCust.id;
        await supabase.from("customer_accounts").update({ customer_id: customerId }).eq("id", customer.sub);
      }

      // Update customer style profile
      const updateData: Record<string, unknown> = {};
      if (style_preferences !== undefined) updateData.style_preferences = style_preferences;
      if (preferred_colors !== undefined) updateData.preferred_colors = preferred_colors;
      if (avoided_colors !== undefined) updateData.avoided_colors = avoided_colors;
      if (body_shape !== undefined) updateData.body_shape = body_shape;
      if (size_info !== undefined) updateData.size_info = size_info;
      if (occasions !== undefined) updateData.occasions = occasions;
      if (budget_range !== undefined) updateData.budget_range = budget_range;
      if (Object.keys(updateData).length > 0) {
        updateData.quiz_completed_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        const { error: upErr } = await supabase
          .from("customers")
          .update(updateData)
          .eq("id", customerId);

        if (upErr) {
          console.error("Update customer error:", upErr);
          return json({ error: "Failed to update profile" }, 500);
        }
      }

      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("widget-customer-auth error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
