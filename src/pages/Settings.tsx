import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ShopifyConnection } from '@/components/ShopifyConnection';
import { User, Building2, Loader2, Save, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch profile
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

          // Fetch brand
          if (profileData.brand_id) {
            const { data: brandData } = await supabase
              .from('brands')
              .select('id, name, slug, logo_url')
              .eq('id', profileData.brand_id)
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
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.fullName,
          avatar_url: profile.avatarUrl,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBrand = async () => {
    if (!brand.id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('brands')
        .update({
          name: brand.name,
          slug: brand.slug,
          logo_url: brand.logoUrl,
        })
        .eq('id', brand.id);

      if (error) throw error;

      toast({
        title: 'Brand updated',
        description: 'Your brand settings have been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update brand. Please try again.',
        variant: 'destructive',
      });
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
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.fullName}
                  onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Avatar URL</Label>
              <Input
                id="avatarUrl"
                value={profile.avatarUrl}
                onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Brand Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Brand Details
            </CardTitle>
            <CardDescription>
              Configure your brand information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  value={brand.name}
                  onChange={(e) => setBrand({ ...brand, name: e.target.value })}
                  placeholder="Your brand name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandSlug">Brand Slug</Label>
                <Input
                  id="brandSlug"
                  value={brand.slug}
                  onChange={(e) => setBrand({ ...brand, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="your-brand"
                />
                <p className="text-xs text-muted-foreground">Used in URLs and widget embedding</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={brand.logoUrl}
                onChange={(e) => setBrand({ ...brand, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveBrand} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Brand
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Shopify Connection */}
        <ShopifyConnection />

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Account</CardTitle>
            <CardDescription>
              Sign out of your account
            </CardDescription>
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
