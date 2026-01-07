import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User client to get user info
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[account-bootstrap] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[account-bootstrap] Bootstrapping account for user:', user.id);

    // Service client for privileged operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if profile already exists
    const { data: existingProfile, error: profileCheckError } = await serviceClient
      .from('profiles')
      .select('id, brand_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileCheckError) {
      console.error('[account-bootstrap] Error checking profile:', profileCheckError);
      throw new Error('Failed to check existing profile');
    }

    // If profile exists with a brand_id, we're done
    if (existingProfile?.brand_id) {
      console.log('[account-bootstrap] Profile already complete, brand_id:', existingProfile.brand_id);
      return new Response(
        JSON.stringify({ ok: true, brandId: existingProfile.brand_id, created: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique brand slug
    const baseSlug = `brand-${user.id.substring(0, 8)}`;
    let brandSlug = baseSlug;
    let slugAttempt = 0;
    
    // Check for slug uniqueness
    while (true) {
      const { data: existingBrand } = await serviceClient
        .from('brands')
        .select('id')
        .eq('slug', brandSlug)
        .maybeSingle();
      
      if (!existingBrand) break;
      slugAttempt++;
      brandSlug = `${baseSlug}-${slugAttempt}`;
      if (slugAttempt > 10) {
        brandSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }

    // Get user metadata for brand name
    const brandName = user.user_metadata?.brand_name || 'My Brand';
    const fullName = user.user_metadata?.full_name || '';

    // Create brand
    console.log('[account-bootstrap] Creating brand with slug:', brandSlug);
    const { data: newBrand, error: brandError } = await serviceClient
      .from('brands')
      .insert({
        name: brandName,
        slug: brandSlug,
      })
      .select('id')
      .single();

    if (brandError) {
      console.error('[account-bootstrap] Error creating brand:', brandError);
      throw new Error('Failed to create brand');
    }

    console.log('[account-bootstrap] Brand created:', newBrand.id);

    // Create or update profile
    if (existingProfile) {
      // Profile exists but without brand_id - update it
      const { error: updateError } = await serviceClient
        .from('profiles')
        .update({ brand_id: newBrand.id, email: user.email, full_name: fullName })
        .eq('id', user.id);

      if (updateError) {
        console.error('[account-bootstrap] Error updating profile:', updateError);
        throw new Error('Failed to update profile');
      }
    } else {
      // Create new profile
      const { error: insertError } = await serviceClient
        .from('profiles')
        .insert({
          id: user.id,
          brand_id: newBrand.id,
          email: user.email,
          full_name: fullName,
        });

      if (insertError) {
        console.error('[account-bootstrap] Error creating profile:', insertError);
        throw new Error('Failed to create profile');
      }
    }

    // Create user_role if not exists
    const { data: existingRole } = await serviceClient
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await serviceClient
        .from('user_roles')
        .insert({ user_id: user.id, role: 'owner' });

      if (roleError) {
        console.error('[account-bootstrap] Error creating role:', roleError);
        // Non-fatal, continue
      }
    }

    // Create default widget config
    const { data: existingConfig } = await serviceClient
      .from('widget_config')
      .select('id')
      .eq('brand_id', newBrand.id)
      .maybeSingle();

    if (!existingConfig) {
      const { error: configError } = await serviceClient
        .from('widget_config')
        .insert({ brand_id: newBrand.id });

      if (configError) {
        console.error('[account-bootstrap] Error creating widget config:', configError);
        // Non-fatal, continue
      }
    }

    // Seed default rules
    const { data: existingRules } = await serviceClient
      .from('rules')
      .select('id')
      .eq('brand_id', newBrand.id)
      .limit(1);

    if (!existingRules || existingRules.length === 0) {
      const defaultRules = [
        { brand_id: newBrand.id, name: 'Category Balance', category: 'styling', description: 'Ensure outfits have complementary categories', enabled: true },
        { brand_id: newBrand.id, name: 'Color Harmony', category: 'styling', description: 'Limit outfits to max 3 dominant colors', enabled: true },
        { brand_id: newBrand.id, name: 'In-Stock Only', category: 'inventory', description: 'Only include products that are in stock', enabled: true },
      ];
      
      await serviceClient.from('rules').insert(defaultRules);
    }

    console.log('[account-bootstrap] Account bootstrap complete');

    return new Response(
      JSON.stringify({ ok: true, brandId: newBrand.id, created: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[account-bootstrap] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Bootstrap failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
