import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOP = "stylys-2.myshopify.com";
const OLD_PROJECT = "mggxvtfgakplzzpcclte";
const SHOPIFY_API_VERSION = "2025-01";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch access token from brands table
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, shopify_access_token")
    .eq("shopify_store_domain", SHOP)
    .not("shopify_access_token", "is", null)
    .maybeSingle();

  if (brandError || !brand?.shopify_access_token) {
    return new Response(
      JSON.stringify({ error: "Brand or access token not found", detail: brandError?.message }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const token = brand.shopify_access_token;
  const graphqlUrl = `https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  // Step 1: Query all script tags
  const listQuery = `
    {
      scriptTags(first: 50) {
        edges {
          node {
            id
            src
            displayScope
          }
        }
      }
    }
  `;

  const listResp = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query: listQuery }),
  });

  if (!listResp.ok) {
    return new Response(
      JSON.stringify({ error: "GraphQL list request failed", status: listResp.status }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const listData = await listResp.json();
  const edges = listData?.data?.scriptTags?.edges ?? [];
  const allTags = edges.map((e: { node: { id: string; src: string } }) => ({ id: e.node.id, src: e.node.src }));

  const toDelete = allTags.filter((t: { src: string }) => t.src.includes(OLD_PROJECT));

  if (toDelete.length === 0) {
    return new Response(
      JSON.stringify({ message: "No stale script tags found", all_tags: allTags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Step 2: Delete each matching script tag
  const results = [];
  for (const tag of toDelete) {
    const deleteMutation = `
      mutation {
        scriptTagDelete(id: "${tag.id}") {
          deletedScriptTagId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const delResp = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query: deleteMutation }),
    });

    const delData = await delResp.json();
    const userErrors = delData?.data?.scriptTagDelete?.userErrors ?? [];
    const deletedId = delData?.data?.scriptTagDelete?.deletedScriptTagId;

    results.push({
      id: tag.id,
      src: tag.src,
      deleted: !!deletedId,
      userErrors,
    });
  }

  return new Response(
    JSON.stringify({ deleted: results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
