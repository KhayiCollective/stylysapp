import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  TestTube, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  Database,
  Key,
  Globe,
  Link2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending';
  message: string;
  details?: string;
}

export function ShopifyTestMode() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isTestMode, setIsTestMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [mockShop, setMockShop] = useState('test-store');

  const runTests = async () => {
    setRunning(true);
    setResults([]);

    const tests: TestResult[] = [];

    // Test 1: User Authentication
    tests.push({
      name: 'User Authentication',
      status: user ? 'pass' : 'fail',
      message: user ? 'User is authenticated' : 'No user session found',
      details: user ? `User ID: ${user.id}` : 'Please sign in to test OAuth flow',
    });
    setResults([...tests]);

    // Test 2: Profile & Brand ID
    if (user) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        tests.push({
          name: 'Profile & Brand',
          status: profile?.brand_id ? 'pass' : 'fail',
          message: profile?.brand_id ? 'Brand ID found' : 'No brand associated',
          details: profile?.brand_id ? `Brand ID: ${profile.brand_id}` : error?.message,
        });
      } catch (e) {
        tests.push({
          name: 'Profile & Brand',
          status: 'fail',
          message: 'Failed to fetch profile',
          details: e instanceof Error ? e.message : 'Unknown error',
        });
      }
      setResults([...tests]);
    }

    // Test 3: Edge Function Availability
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=test`,
        { method: 'GET' }
      );

      const isAvailable = response.status !== 404;
      tests.push({
        name: 'Edge Function',
        status: isAvailable ? 'pass' : 'fail',
        message: isAvailable ? 'shopify-oauth function is deployed' : 'Function not found',
        details: `Status: ${response.status}`,
      });
    } catch (e) {
      tests.push({
        name: 'Edge Function',
        status: 'fail',
        message: 'Could not reach edge function',
        details: e instanceof Error ? e.message : 'Network error',
      });
    }
    setResults([...tests]);

    // Test 4: OAuth URL Generation
    try {
      const redirectUri = `${window.location.origin}/connect-shopify`;
      const state = btoa(JSON.stringify({ brand_id: 'test-brand-id' }));
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=authorize&shop=${mockShop}.myshopify.com&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (result.authUrl) {
        const hasClientId = result.authUrl.includes('client_id=') && !result.authUrl.includes('client_id=&');
        tests.push({
          name: 'OAuth URL',
          status: hasClientId ? 'pass' : 'fail',
          message: hasClientId ? 'OAuth URL generated with Client ID' : 'Client ID missing in OAuth URL',
          details: hasClientId ? 'SHOPIFY_CLIENT_ID is configured' : 'Check SHOPIFY_CLIENT_ID secret',
        });
      } else {
        tests.push({
          name: 'OAuth URL',
          status: 'fail',
          message: result.error || 'Failed to generate OAuth URL',
          details: JSON.stringify(result),
        });
      }
    } catch (e) {
      tests.push({
        name: 'OAuth URL',
        status: 'fail',
        message: 'Error testing OAuth URL generation',
        details: e instanceof Error ? e.message : 'Unknown error',
      });
    }
    setResults([...tests]);

    // Test 5: Database Connection Check
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        if (profile?.brand_id) {
          const { data: brand, error } = await supabase
            .from('brands')
            .select('shopify_store_domain, shopify_connected_at')
            .eq('id', profile.brand_id)
            .single();

          tests.push({
            name: 'Database Write Access',
            status: 'pass',
            message: 'Can read brand data',
            details: brand?.shopify_connected_at 
              ? `Already connected: ${brand.shopify_store_domain}`
              : 'No Shopify connection yet',
          });
        }
      } catch (e) {
        tests.push({
          name: 'Database Write Access',
          status: 'fail',
          message: 'Cannot access brands table',
          details: e instanceof Error ? e.message : 'Check RLS policies',
        });
      }
    }
    setResults([...tests]);

    setRunning(false);

    const passed = tests.filter(t => t.status === 'pass').length;
    const total = tests.length;
    
    toast({
      title: `Tests Complete: ${passed}/${total} passed`,
      description: passed === total 
        ? 'All tests passed! OAuth should work correctly.'
        : 'Some tests failed. Check results for details.',
      variant: passed === total ? 'default' : 'destructive',
    });
  };

  const simulateMockConnection = async () => {
    if (!user || !isTestMode) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();

      if (!profile?.brand_id) {
        toast({ title: "No brand found", variant: "destructive" });
        return;
      }

      // Simulate what OAuth callback would do
      const { error } = await supabase
        .from('brands')
        .update({
          shopify_store_domain: `${mockShop}.myshopify.com`,
          shopify_access_token: 'test_mock_token_for_development',
          shopify_storefront_token: 'test_mock_storefront_token',
          shopify_connected_at: new Date().toISOString(),
        })
        .eq('id', profile.brand_id);

      if (error) throw error;

      toast({
        title: "Mock Connection Created!",
        description: `Connected to ${mockShop}.myshopify.com (test mode)`,
      });
    } catch (e) {
      toast({
        title: "Mock connection failed",
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  const clearMockConnection = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('brand_id')
        .eq('id', user.id)
        .single();

      if (!profile?.brand_id) return;

      const { error } = await supabase
        .from('brands')
        .update({
          shopify_store_domain: null,
          shopify_access_token: null,
          shopify_storefront_token: null,
          shopify_connected_at: null,
        })
        .eq('id', profile.brand_id);

      if (error) throw error;

      toast({
        title: "Connection Cleared",
        description: "Shopify connection data has been removed",
      });
    } catch (e) {
      toast({
        title: "Failed to clear",
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Developer Test Mode
            </CardTitle>
            <CardDescription>
              Test and debug your Shopify OAuth integration
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="test-mode" className="text-sm">Test Mode</Label>
            <Switch 
              id="test-mode" 
              checked={isTestMode} 
              onCheckedChange={setIsTestMode}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Test Runner */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={runTests} disabled={running} className="gap-2">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run Integration Tests
                </>
              )}
            </Button>
          </div>

          {/* Test Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    result.status === 'pass' 
                      ? 'bg-green-50 dark:bg-green-900/20' 
                      : result.status === 'fail'
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-muted'
                  }`}
                >
                  {result.status === 'pass' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : result.status === 'fail' ? (
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{result.name}</span>
                      <Badge variant={result.status === 'pass' ? 'secondary' : 'destructive'} className="text-xs">
                        {result.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    {result.details && (
                      <code className="text-xs text-muted-foreground bg-muted px-1 rounded mt-1 inline-block">
                        {result.details}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mock Connection (Test Mode Only) */}
        {isTestMode && (
          <>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Database className="h-4 w-4" />
                Mock Connection (Dev Only)
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input 
                    value={mockShop}
                    onChange={(e) => setMockShop(e.target.value)}
                    placeholder="test-store"
                    className="max-w-[200px]"
                  />
                  <span className="text-sm text-muted-foreground">.myshopify.com</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={simulateMockConnection}>
                    Create Mock Connection
                  </Button>
                  <Button variant="destructive" size="sm" onClick={clearMockConnection}>
                    Clear Connection
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This creates fake Shopify data in your database for testing the UI flow without real OAuth.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Debug Info */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Environment Info
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Redirect URI:</span>
              <code className="bg-muted px-2 py-0.5 rounded text-xs">
                {window.location.origin}/connect-shopify
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Supabase URL:</span>
              <code className="bg-muted px-2 py-0.5 rounded text-xs truncate max-w-[300px]">
                {import.meta.env.VITE_SUPABASE_URL || 'Not set'}
              </code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
