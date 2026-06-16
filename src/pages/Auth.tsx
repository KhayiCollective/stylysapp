import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAccountBootstrap } from '@/hooks/useAccountBootstrap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, ArrowRight, Mail, Lock, User, Store, CheckCircle, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { TIERS, TierKey } from '@/lib/tiers';

type AuthView = 'login' | 'signup' | 'forgot' | 'select-plan';

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword } = useAuth();
  const { bootstrap } = useAccountBootstrap();
  const navigate = useNavigate();
  
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (view === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
          toast({ title: "Check your email", description: "We sent you a password reset link." });
          setView('login');
        }
        return;
      }

      if (view === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast({ title: "Login failed", description: error.message, variant: "destructive" });
        } else {
          const result = await bootstrap();
          if (!result.ok) console.warn('[Auth] Bootstrap warning:', result.error);
          navigate('/dashboard');
        }
      } else {
        const { error } = await signUp(email, password, fullName, brandName);
        if (error) {
          toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
        } else {
          const bootstrapResult = await bootstrap();
          if (!bootstrapResult.ok) console.warn('[Auth] Bootstrap warning:', bootstrapResult.error);

          toast({ title: "Account created!", description: "Choose your plan to get started." });
          setView('select-plan');
        }
      }
    } finally {
      setLoading(false);
    }
  };
  const handleSelectPlan = (plan: TierKey) => {
    sessionStorage.setItem('selectedPlan', plan);
    navigate(`/connect-shopify?plan=${plan}`);
  };

  // Plan selection screen
  if (view === 'select-plan') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground">Choose Your Plan</h2>
            <p className="mt-2 text-muted-foreground">
              Start with a 3-day free trial. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {(Object.entries(TIERS) as [TierKey, typeof TIERS[TierKey]][]).map(([key, tier]) => (
              <Card
                key={key}
                className={`relative cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg ${
                  key === 'professional' ? 'border-primary/30 ring-1 ring-primary/20' : ''
                }`}
                onClick={() => handleSelectPlan(key)}
              >
                {key === 'professional' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                      <Crown className="w-3 h-3" /> Recommended
                    </span>
                  </div>
                )}
                <CardContent className="pt-6">
                  <h3 className="text-xl font-display font-semibold">{tier.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-3xl font-display font-bold">{tier.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">Up to {tier.maxProducts} products</p>
                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                        <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={key === 'professional' ? 'default' : 'outline'}>
                    Start Free Trial
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            {/* Enterprise — Contact Sales */}
            <Card
              className="relative cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
              onClick={() => {
                window.location.href = 'mailto:support@stylysapp.com?subject=Enterprise%20Plan%20Inquiry';
              }}
            >
              <CardContent className="pt-6">
                <h3 className="text-xl font-display font-semibold">Enterprise</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-display font-bold">Custom</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Unlimited products</p>
                <ul className="space-y-2 mb-6">
                  {[
                    'All Professional features',
                    'Custom AI training',
                    'White-label options',
                    'Dedicated account manager',
                    'Custom integrations',
                    '24/7 premium support',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline">
                  Contact Sales
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Your card will be charged after the 3-day trial ends. You can cancel anytime from your Shopify admin.
          </p>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-primary-foreground">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm">
              <Sparkles className="h-8 w-8" />
            </div>
            <span className="text-2xl font-display font-semibold">AI Stylist</span>
          </div>
          
          <h1 className="text-5xl font-display font-bold leading-tight mb-6">
            Transform Your
            <br />
            E-commerce with
            <br />
            AI Styling
          </h1>
          
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Personalized outfit recommendations that increase conversions and delight your customers.
          </p>

          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>AI-powered style quiz for customers</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Embeddable widget for your store</span>
            </div>
            <div className="flex items-center gap-3 text-primary-foreground/70">
              <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50" />
              <span>Analytics & customer insights</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-display font-semibold">STYLYS</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-foreground">
              {view === 'login' ? 'Welcome back' : view === 'signup' ? 'Create your account' : 'Reset your password'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {view === 'login' ? 'Sign in to access your dashboard' : view === 'signup' ? 'Start building AI-powered outfits today' : 'Enter your email and we\'ll send you a reset link'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {view === 'signup' && <>
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brandName" className="text-sm font-medium">Brand Name</Label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="brandName" type="text" placeholder="My Fashion Brand" value={brandName} onChange={e => setBrandName(e.target.value)} className="pl-10" />
                  </div>
                </div>
              </>}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="pl-10" />
              </div>
            </div>

            {view !== 'forgot' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  {view === 'login' && (
                    <button type="button" onClick={() => setView('forgot')} className="text-xs text-primary hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="pl-10" />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
              {loading ? <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {view === 'login' ? 'Signing in...' : view === 'signup' ? 'Creating account...' : 'Sending link...'}
                </span> : <span className="flex items-center gap-2">
                  {view === 'login' ? 'Sign in' : view === 'signup' ? 'Create account' : 'Send reset link'}
                  <ArrowRight className="h-4 w-4" />
                </span>}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            {view === 'forgot' ? (
              <button type="button" onClick={() => setView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Back to <span className="text-primary font-medium">Sign in</span>
              </button>
            ) : (
              <button type="button" onClick={() => setView(view === 'login' ? 'signup' : 'login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {view === 'login' ? <>Don't have an account? <span className="text-primary font-medium">Sign up</span></> : <>Already have an account? <span className="text-primary font-medium">Sign in</span></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>;
}