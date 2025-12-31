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
  Link2,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'pending' | 'warning';
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
  const [functionVersion, setFunctionVersion] = useState<string | null>(null);

  const runTests = async () => {
    setRunning(true);
    setResults([]);
    setFunctionVersion(null);

    const tests: TestResult[] = [];

    // Test 1: User Authentication
    tests.push({
      name: 'User Authentication',
      status: user ? 'pass' : 'fail',
      message: user ? 'User is authenticated' : 'No user session found',
      details: user ? `User: ${user.email}` : 'Please sign in to test OAuth flow',
    });
    setResults([...tests]);

    // Test 2: Profile & Brand ID
    let brandId: string | null = null;
    if (user) {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('brand_id')
          .eq('id', user.id)
          .single();

        brandId = profile?.brand_id || null;
        tests.push({
          name: 'Profile & Brand',
          status: profile?.brand_id ? 'pass' : 'fail',
          message: profile?.brand_id ? 'Brand ID found' : 'No brand associated',
          details: profile?.brand_id ? `Brand ID: ${profile.brand_id.substring(0, 8)}...` : error?.message,
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

    // Test 3: Edge Function Health Check
    let edgeFunctionHealthy = false;
    try {
      const healthResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=health`,
        { method: 'GET' }
      );

      if (healthResponse.status === 404) {
        tests.push({
          name: 'Edge Function Health',
          status: 'fail',
          message: 'Function not found (404)',
          details: 'The shopify-oauth function may not be deployed. Try redeploying.',
        });
      } else if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        edgeFunctionHealthy = healthData.status === 'ok';
        setFunctionVersion(healthData.version || null);
        tests.push({
          name: 'Edge Function Health',
          status: 'pass',
          message: 'Function is deployed and responding',
          details: `Version: ${healthData.version || 'unknown'}, Timestamp: ${healthData.timestamp}`,
        });
      } else {
        tests.push({
          name: 'Edge Function Health',
          status: 'warning',
          message: `Unexpected status: ${healthResponse.status}`,
          details: await healthResponse.text(),
        });
      }
    } catch (e) {
      tests.push({
        name: 'Edge Function Health',
        status: 'fail',
        message: 'Could not reach edge function',
        details: e instanceof Error ? e.message : 'Network error',
      });
    }
    setResults([...tests]);

    // Test 4: Edge Function Test Endpoint
    if (edgeFunctionHealthy) {
      try {
        const testResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=test`,
          { method: 'GET' }
        );

        const testData = await testResponse.json();
        
        const hasSecrets = testData.hasClientId && testData.hasClientSecret;
        tests.push({
          name: 'Shopify Credentials',
          status: hasSecrets ? 'pass' : 'fail',
          message: hasSecrets ? 'Client ID and Secret are configured' : 'Missing Shopify credentials',
          details: `Client ID: ${testData.hasClientId ? '✓' : '✗'}, Client Secret: ${testData.hasClientSecret ? '✓' : '✗'}`,
        });
      } catch (e) {
        tests.push({
          name: 'Shopify Credentials',
          status: 'fail',
          message: 'Could not verify credentials',
          details: e instanceof Error ? e.message : 'Unknown error',
        });
      }
      setResults([...tests]);
    }

    // Test 5: OAuth URL Generation
    try {
      const redirectUri = `${window.location.origin}/connect-shopify`;
      const state = btoa(JSON.stringify({ brand_id: brandId || 'test-brand-id' }));
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=authorize&shop=${mockShop}.myshopify.com&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
        { method: 'GET' }
      );

      if (response.status === 404) {
        tests.push({
          name: 'OAuth URL Generation',
          status: 'fail',
          message: 'Edge function not found',
          details: 'The function needs to be deployed',
        });
      } else {
        const result = await response.json();

        if (result.authUrl) {
          const hasClientId = result.authUrl.includes('client_id=') && !result.authUrl.includes('client_id=&');
          tests.push({
            name: 'OAuth URL Generation',
            status: hasClientId ? 'pass' : 'fail',
            message: hasClientId ? 'OAuth URL generated successfully' : 'Client ID missing in OAuth URL',
            details: hasClientId 
              ? `URL points to: ${mockShop}.myshopify.com` 
              : 'Check SHOPIFY_CLIENT_ID secret',
          });
        } else {
          tests.push({
            name: 'OAuth URL Generation',
            status: 'fail',
            message: result.error || 'Failed to generate OAuth URL',
            details: JSON.stringify(result).substring(0, 100),
          });
        }
      }
    } catch (e) {
      tests.push({
        name: 'OAuth URL Generation',
        status: 'fail',
        message: 'Error testing OAuth URL generation',
        details: e instanceof Error ? e.message : 'Unknown error',
      });
    }
    setResults([...tests]);

    // Test 6: Database Connection Status
    if (user && brandId) {
      try {
        const { data: brand, error } = await supabase
          .from('brands')
          .select('shopify_store_domain, shopify_connected_at, shopify_access_token, shopify_storefront_token')
          .eq('id', brandId)
          .single();

        if (error) throw error;

        const hasConnection = !!brand?.shopify_connected_at;
        const hasTokens = !!brand?.shopify_access_token && !!brand?.shopify_storefront_token;
        
        tests.push({
          name: 'Shopify Connection Status',
          status: hasConnection ? (hasTokens ? 'pass' : 'warning') : 'pending',
          message: hasConnection 
            ? `Connected to ${brand.shopify_store_domain}` 
            : 'No Shopify connection yet',
          details: hasConnection 
            ? `Access Token: ${brand.shopify_access_token ? '✓' : '✗'}, Storefront Token: ${brand.shopify_storefront_token ? '✓' : '✗'}`
            : 'Complete OAuth flow to connect',
        });
      } catch (e) {
        tests.push({
          name: 'Shopify Connection Status',
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

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-600 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-0.5" />;
    }
  };

  const getStatusBg = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'fail':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'pending':
        return 'bg-muted';
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
              {functionVersion && (
                <Badge variant="outline" className="text-xs ml-2">
                  v{functionVersion}
                </Badge>
              )}
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
            <span className="text-sm text-muted-foreground">
              Tests edge function, secrets, and database
            </span>
          </div>

          {/* Test Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${getStatusBg(result.status)}`}
                >
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{result.name}</span>
                      <Badge 
                        variant={result.status === 'pass' ? 'secondary' : result.status === 'warning' ? 'outline' : 'destructive'} 
                        className="text-xs"
                      >
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
                    <Zap className="h-4 w-4 mr-1" />
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
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Edge Function:</span>
              <code className="bg-muted px-2 py-0.5 rounded text-xs">
                shopify-oauth
              </code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
