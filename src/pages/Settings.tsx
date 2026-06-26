import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEmbeddedApp } from '@/components/EmbeddedAppProvider';
import { ShopifyConnection } from '@/components/ShopifyConnection';
import { WidgetStatus } from '@/components/settings/WidgetStatus';
import { ShopifyTestMode } from '@/components/ShopifyTestMode';
import { ShopifySyncStatus } from '@/components/ShopifySyncStatus';
import { WebhookStatusIndicator } from '@/components/catalog/WebhookStatusIndicator';
import { SyncHistoryLog } from '@/components/catalog/SyncHistoryLog';
import { User, Building2, Loader2, Save, LogOut, BookOpen, CreditCard, Crown, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { TIERS, getTierLimits, hasFeature } from '@/lib/tiers';
import { Badge } from '@/components/ui/badge';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { isEmbedded, embeddedBrandId, config } = useEmbeddedApp();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isDevUser } = useUserRole();
  const { subscribed, loading: subLoading, tierName, isTrialing, trialEnd, subscriptionEnd, checkSubscription } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [embeddedSub, setEmbeddedSub] = useState<{
    checked: boolean;
    subscribed: boolean;
    planName: string | null;
    tierName: string | null;
  }>({ checked: false, subscribed: false, planName: null, tierName: null });
  
  const [profile, setProfile] = useState({
    fullName: '',
    email: '',
    avatarUrl: '',
  });
  
  const [brand, setBrand] = useState({
    id: '',
    name: '',
    slug: '',
    logoUrl: '',
  });

  const tierLimits = getTierLimits(tierName);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let resolvedBrandId: string | null = null;

        if (isEmbedded) {
          // No Supabase auth session in embedded mode — use brand_id from context
          // and skip the profiles query (which requires auth.uid()).
          resolvedBrandId = embeddedBrandId;
          if (config?.shop) setProfile(prev => ({ ...prev, email: config.shop }));
        } else {
          if (!user) return;
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url, brand_id')
            .eq('id', user.id)
            .single();
          if (profileData) {
            setProfile({
              fullName: profileData.full_name || '',
              email: profileData.email || '',
              avatarUrl: profileData.avatar_url || '',
            });
            resolvedBrandId = profileData.brand_id ?? null;
          }
        }

        if (resolvedBrandId) {
          const { data: brandData } = await supabase
            .from('brands')
            .select('id, name, slug, logo_url')
            .eq('id', resolvedBrandId)
            .single();
          if (brandData) {
            setBrand({
              id: brandData.id,
              name: brandData.name || '',
              slug: brandData.slug || '',
              logoUrl: brandData.logo_url || '',
            });
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, isEmbedded, embeddedBrandId]);

  useEffect(() => {
    if (!isEmbedded || !config?.shop) return;
    supabase.functions
      .invoke('check-subscription-by-shop', {
        body: { shop_domain: config.shop },
      })
      .then(({ data }) => {
        setEmbeddedSub({
          checked: true,
          subscribed: data?.subscribed ?? false,
          planName: data?.plan_name ?? null,
          tierName: data?.tier_name ?? null,
        });
      })
      .catch(() => setEmbeddedSub(prev => ({ ...prev, checked: true })));
  }, [isEmbedded, config?.shop]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: profile.fullName, avatar_url: profile.avatarUrl }).eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your profile has been saved successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update profile. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!brand.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('brands').update({ name: brand.name, slug: brand.slug, logo_url: brand.logoUrl }).eq('id', brand.id);
      if (error) throw error;
      toast({ title: 'Brand updated', description: 'Your brand settings have been saved successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update brand. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <DashboardLayout title="Settings" description="Manage your account and brand settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings" description="Manage your account and brand settings">
      <div className="max-w-3xl space-y-8">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input id="avatarUrl" value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} placeholder="https://example.com/avatar.jpg" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Brand Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Brand Details</CardTitle>
            <CardDescription>Configure your brand information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input id="brandName" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} placeholder="Your brand name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandSlug">Brand Slug</Label>
                <Input id="brandSlug" value={brand.slug} onChange={(e) => setBrand({ ...brand, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="your-brand" />
                <p className="text-xs text-muted-foreground">Used in URLs and widget embedding</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input id="logoUrl" value={brand.logoUrl} onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })} placeholder="https://example.com/logo.png" />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveBrand} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Brand
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Billing & Subscription</CardTitle>
            <CardDescription>Manage your subscription plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEmbedded ? (() => {
              const pricingUrl = `https://${config?.shop ?? ''}/admin/app/billing`;
              if (!embeddedSub.checked) {
                return (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking subscription...
                  </div>
                );
              }
              if (embeddedSub.subscribed) {
                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Crown className="h-5 w-5 text-amber-500" />
                      <span className="font-semibold text-lg capitalize">
                        {embeddedSub.planName ?? embeddedSub.tierName ?? 'Active'} Plan
                      </span>
                    </div>
                    <Button variant="outline" onClick={() => window.open(pricingUrl, '_blank')}>
                      Manage Plan
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You don't have an active subscription. Choose a plan to get started.
                  </p>
                  <Button onClick={() => window.open(pricingUrl, '_blank')}>
                    <Crown className="h-4 w-4 mr-2" />
                    Choose a Plan
                  </Button>
                </div>
              );
            })() : subLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking subscription...
              </div>
            ) : subscribed ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold text-lg capitalize">{tierName || 'Active'} Plan</span>
                  {isTrialing && <Badge variant="secondary">Trial</Badge>}
                </div>
                {isTrialing && trialEnd && (
                  <p className="text-sm text-muted-foreground">Trial ends {new Date(trialEnd).toLocaleDateString()}</p>
                )}
                {!isTrialing && subscriptionEnd && (
                  <p className="text-sm text-muted-foreground">Renews {new Date(subscriptionEnd).toLocaleDateString()}</p>
                )}

                {/* Tier Features Summary */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold">Your Plan Includes:</h4>
                  <ul className="space-y-1.5">
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Up to {tierLimits.maxProducts} products
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      AI outfit recommendations
                    </li>
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Virtual try-on
                    </li>
                    {hasFeature(tierName, "styling_chatbot") && (
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        AI styling chatbot
                      </li>
                    )}
                    {hasFeature(tierName, "priority_support") && (
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Priority support with live chat
                      </li>
                    )}
                    {hasFeature(tierName, "customer_tracking") && (
                      <li className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Customer preference tracking
                      </li>
                    )}
                  </ul>
                </div>

                <Button variant="outline" onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  const { data, error } = await supabase.functions.invoke('customer-portal', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  if (!error && data?.url) window.open(data.url, '_blank');
                }}>
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">You don't have an active subscription. Choose a plan via Shopify to get started.</p>
                <Button onClick={async () => {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) return;
                  const { data, error } = await supabase.functions.invoke('create-checkout', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  });
                  if (error || data?.error) {
                    toast({ title: 'Subscription Error', description: data?.error || 'Failed to open billing page. Please try again.', variant: 'destructive' });
                    return;
                  }
                  if (data?.url) window.open(data.url, '_blank');
                }}>
                  <Crown className="h-4 w-4 mr-2" />
                  Choose a Plan on Shopify
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shopify Connection */}
        <ShopifyConnection />
        <WidgetStatus />
        <ShopifySyncStatus />

        {isDevUser && (
          <>
            <WebhookStatusIndicator />
            <SyncHistoryLog />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Shopify Setup Guide</CardTitle>
                <CardDescription>Complete step-by-step guide for setting up Shopify OAuth</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild><Link to="/shopify-setup">View Setup Guide</Link></Button>
              </CardContent>
            </Card>
            <ShopifyTestMode />
          </>
        )}

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Account</CardTitle>
            <CardDescription>Sign out of your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
