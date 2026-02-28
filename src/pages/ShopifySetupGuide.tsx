import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle2, 
  Circle, 
  ExternalLink, 
  Copy, 
  Key,
  Store,
  Code,
  TestTube,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Terminal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StepProps {
  number: number;
  title: string;
  description: string;
  completed?: boolean;
  children: React.ReactNode;
}

function SetupStep({ number, title, description, completed, children }: StepProps) {
  return (
    <div className="relative">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
          completed ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'
        }`}>
          {completed ? <CheckCircle2 className="h-5 w-5" /> : <span className="font-semibold">{number}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-lg">{title}</h3>
            {completed && <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Complete</Badge>}
          </div>
          <p className="text-muted-foreground mb-4">{description}</p>
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };
  
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
      <Copy className="h-3 w-3" />
      Copy
    </Button>
  );
}

export default function ShopifySetupGuide() {
  const { toast } = useToast();
  const { isDevUser, loading: roleLoading } = useUserRole();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResults, setTestResults] = useState<{
    envVars?: boolean;
    authUrl?: boolean;
    error?: string;
  } | null>(null);

  // Get the current origin for redirect URI
  const redirectUri = `${window.location.origin}/connect-shopify`;
  const appUrl = window.location.origin;

  const tomlContent = `client_id = "YOUR_CLIENT_ID_HERE"
name = "AI Stylist Platform"
application_url = "${window.location.origin}"
embedded = false

[access_scopes]
scopes = "read_products,read_product_listings,unauthenticated_read_product_listings,unauthenticated_read_product_tags"

[auth]
redirect_urls = [
  "${window.location.origin}/connect-shopify"
]

[webhooks]
api_version = "2024-10"

  [[webhooks.subscriptions]]
  topics = [
    "products/create",
    "products/update",
    "products/delete",
    "inventory_levels/update",
    "app/uninstalled"
  ]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"

  [[webhooks.subscriptions]]
  compliance_topics = [
    "customers/data_request",
    "customers/redact",
    "shop/redact"
  ]
  uri = "https://mggxvtfgakplzzpcclte.supabase.co/functions/v1/shopify-webhooks"`;

  // Role-based access guard — must be after all hooks
  if (roleLoading) {
    return (
      <DashboardLayout title="Shopify Setup Guide" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isDevUser) {
    return <Navigate to="/settings" replace />;
  }

  const testOAuthSetup = async () => {
    setTestingConnection(true);
    setTestResults(null);

    try {
      // Test 1: Check if edge function responds
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=test`,
        { method: 'GET' }
      );

      const result = await response.json();

      if (result.error === 'Invalid action') {
        // Edge function is working, env vars test next
        const testAuthResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopify-oauth?action=authorize&shop=test-store.myshopify.com&redirect_uri=${encodeURIComponent(redirectUri)}&state=test`,
          { method: 'GET' }
        );

        const authResult = await testAuthResponse.json();

        if (authResult.authUrl) {
          // Check if auth URL contains proper client ID
          const hasClientId = authResult.authUrl.includes('client_id=') && !authResult.authUrl.includes('client_id=&');
          
          setTestResults({
            envVars: hasClientId,
            authUrl: true,
          });

          if (hasClientId) {
            toast({
              title: "OAuth Setup Valid ✓",
              description: "Your Shopify OAuth configuration looks correct!",
            });
          } else {
            toast({
              title: "Missing Client ID",
              description: "SHOPIFY_CLIENT_ID secret may not be set",
              variant: "destructive",
            });
          }
        } else {
          setTestResults({
            envVars: false,
            authUrl: false,
            error: authResult.error,
          });
        }
      } else {
        setTestResults({
          error: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      setTestResults({
        error: error instanceof Error ? error.message : 'Failed to connect to edge function',
      });
      toast({
        title: "Test Failed",
        description: "Could not connect to OAuth edge function",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <DashboardLayout 
      title="Shopify Setup Guide" 
      description="Complete setup guide for connecting your Shopify store"
    >
      <div className="space-y-8 max-w-4xl">
        {/* Prerequisites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Prerequisites
            </CardTitle>
            <CardDescription>
              Before you begin, make sure you have:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                A Shopify Partner account (free at <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">partners.shopify.com</a>)
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                A development store in your Partner account
              </li>
              <li className="flex items-center gap-2">
                <Circle className="h-2 w-2 fill-current" />
                A custom app created in your Partner dashboard
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Step-by-step guide */}
        <div className="space-y-8">
          <SetupStep
            number={1}
            title="Create a Shopify Partner Account"
            description="Sign up for a free Shopify Partner account to access development tools"
          >
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">partners.shopify.com</a></li>
                <li>Click "Join now" and create your account</li>
                <li>Complete the partner registration form</li>
              </ol>
              <Button variant="outline" size="sm" asChild>
                <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="gap-2">
                  Open Shopify Partners <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </SetupStep>

          <SetupStep
            number={2}
            title="Create a Development Store"
            description="Create a test store to develop and test your integration"
          >
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In Partner Dashboard, go to <strong>Stores</strong></li>
                <li>Click <strong>"Add store"</strong> → <strong>"Create development store"</strong></li>
                <li>Choose "Create a store to test and build"</li>
                <li>Enter a store name (e.g., <code className="bg-muted px-1 rounded">my-test-store</code>)</li>
                <li>Select your region and click "Create development store"</li>
              </ol>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Note:</strong> Add some test products to your store for testing outfit generation
                </p>
              </div>
            </div>
          </SetupStep>

          <SetupStep
            number={3}
            title="Create a Custom App"
            description="Set up OAuth credentials for secure store connection"
          >
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In Partner Dashboard, go to <strong>Apps</strong></li>
                <li>Click <strong>"Create app"</strong> → <strong>"Create app manually"</strong></li>
                <li>Enter app name: <code className="bg-muted px-1 rounded">AI Stylist Platform</code></li>
                <li>Set <strong>App URL</strong>:</li>
              </ol>
              
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <code className="text-sm flex-1 truncate">{appUrl}</code>
                <CopyButton text={appUrl} label="App URL" />
              </div>

              <ol className="list-decimal list-inside space-y-2 text-sm" start={5}>
                <li>Add <strong>Allowed redirection URL(s)</strong>:</li>
              </ol>
              
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <code className="text-sm flex-1 truncate">{redirectUri}</code>
                <CopyButton text={redirectUri} label="Redirect URI" />
              </div>

              <ol className="list-decimal list-inside space-y-2 text-sm" start={6}>
                <li>Click "Create app"</li>
              </ol>
            </div>
          </SetupStep>

          <SetupStep
            number={4}
            title="Configure API Scopes"
            description="Set the required permissions for your app"
          >
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In your app settings, go to <strong>"Configuration"</strong></li>
                <li>Under <strong>"Admin API integration"</strong>, click <strong>"Configure"</strong></li>
                <li>Search and select these scopes:</li>
              </ol>
              
              <div className="grid grid-cols-2 gap-2">
                {['read_products', 'read_product_listings', 'unauthenticated_read_product_listings', 'unauthenticated_read_product_tags'].map(scope => (
                  <div key={scope} className="flex items-center gap-2 p-2 bg-muted rounded text-sm">
                    <Code className="h-4 w-4 text-primary" />
                    <code>{scope}</code>
                  </div>
                ))}
              </div>
              
              <ol className="list-decimal list-inside space-y-2 text-sm" start={4}>
                <li>Click <strong>"Save"</strong></li>
              </ol>
            </div>
          </SetupStep>

          <SetupStep
            number={5}
            title="Get API Credentials"
            description="Copy your Client ID and Client Secret"
          >
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>In your app, go to <strong>"Client credentials"</strong></li>
                <li>Copy the <strong>Client ID</strong></li>
                <li>Copy the <strong>Client Secret</strong></li>
              </ol>
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Important:</strong> These credentials need to be added as secrets in your backend settings
                </p>
              </div>
            </div>
          </SetupStep>

          <SetupStep
            number={6}
            title="Add Secrets to Backend"
            description="Configure your API credentials securely"
          >
            <div className="space-y-4">
              <p className="text-sm">Add these secrets in your Cloud backend settings:</p>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Key className="h-4 w-4 text-primary" />
                  <code className="text-sm font-medium">SHOPIFY_CLIENT_ID</code>
                  <span className="text-xs text-muted-foreground">= your Client ID</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Key className="h-4 w-4 text-primary" />
                  <code className="text-sm font-medium">SHOPIFY_CLIENT_SECRET</code>
                  <span className="text-xs text-muted-foreground">= your Client Secret</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                These are already configured in your backend. If you need to update them, contact support.
              </p>
            </div>
          </SetupStep>

          <SetupStep
            number={7}
            title="Register Compliance Webhooks"
            description="Shopify requires 3 mandatory privacy compliance webhooks declared via CLI — this is a one-time step"
          >
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Why?</strong> Shopify removed the compliance webhook UI. You must now declare them in a <code className="bg-muted px-1 rounded">shopify.app.toml</code> file and deploy via Shopify CLI.
                </p>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Install the Shopify CLI globally:</li>
              </ol>

              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <Terminal className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="text-sm flex-1 truncate">npm install -g @shopify/cli @shopify/app</code>
                <CopyButton text="npm install -g @shopify/cli @shopify/app" label="CLI install command" />
              </div>

              <ol className="list-decimal list-inside space-y-2 text-sm" start={2}>
                <li>Create a new folder and save this as <code className="bg-muted px-1 rounded">shopify.app.toml</code> (replace <code className="bg-muted px-1 rounded">YOUR_CLIENT_ID_HERE</code> with your Client ID from Step 5):</li>
              </ol>

              <div className="rounded-lg overflow-hidden border bg-muted/50">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/80">
                  <span className="text-sm font-medium">shopify.app.toml</span>
                  <CopyButton text={tomlContent} label="TOML config" />
                </div>
                <pre className="p-4 overflow-x-auto text-xs leading-relaxed">
                  <code>{tomlContent}</code>
                </pre>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-sm" start={3}>
                <li>From that folder, run:</li>
              </ol>

              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <Terminal className="h-4 w-4 text-primary flex-shrink-0" />
                <code className="text-sm flex-1 truncate">shopify app deploy</code>
                <CopyButton text="shopify app deploy" label="Deploy command" />
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>One-time step:</strong> You only need to do this once. The backend function already handles all 3 compliance webhooks with HMAC signature verification.
                </p>
              </div>
            </div>
          </SetupStep>
        </div>

        <Separator />

        {/* Test Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Test OAuth Configuration
            </CardTitle>
            <CardDescription>
              Verify your Shopify OAuth setup is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={testOAuthSetup} 
              disabled={testingConnection}
              className="gap-2"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Run OAuth Test
                </>
              )}
            </Button>

            {testResults && (
              <div className="space-y-2 p-4 rounded-lg bg-muted">
                <h4 className="font-medium">Test Results:</h4>
                {testResults.error ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">{testResults.error}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      {testResults.authUrl ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">Edge function responding</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResults.envVars ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-sm">
                        {testResults.envVars ? 'Client ID configured' : 'Client ID may be missing'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ready to Connect */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Ready to Connect?
            </CardTitle>
            <CardDescription>
              Once you've completed the setup steps above, you can connect your store
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="gap-2">
              <a href="/connect-shopify">
                Connect Your Store
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
