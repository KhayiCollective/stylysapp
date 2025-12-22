import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Sparkles, Users, TrendingUp, Check, Calendar, CreditCard } from "lucide-react";
import heroModel from "@/assets/hero-model.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-[hsl(35,30%,95%)]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(35,30%,95%)]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight text-foreground">
            STYLYS
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
          </div>
          <Link to="/auth">
            <Button variant="default" className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-28 pb-20 md:pt-32 md:pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-background rounded-full border border-border shadow-sm">
                <Zap className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium">AI-Powered Outfit Builder for E-Commerce</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-[1.1] text-foreground">
                Increase Sales with AI Outfit Recommendations
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
                Add intelligent outfit building to your Shopify or WooCommerce store. Help customers discover complete looks and increase your average order value by 35%.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth">
                  <Button size="lg" className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-8 h-14 text-base font-semibold">
                    Start Free Trial
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href="#pricing">
                  <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base font-semibold border-foreground/20 hover:bg-foreground/5">
                    View Pricing
                  </Button>
                </a>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  3-day free trial
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  No credit card required
                </span>
              </div>
            </div>
            
            <div className="relative lg:justify-self-end">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl max-w-md mx-auto lg:mx-0">
                <img 
                  src={heroModel} 
                  alt="Fashion model showcasing STYLYS AI styling" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Everything You Need to Boost Sales
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed to help fashion and apparel brands sell more
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard 
              icon={<Sparkles className="w-6 h-6" />}
              title="AI-Powered Recommendations"
              description="Our AI creates personalized outfit combinations that increase average order value by 35%"
            />
            <FeatureCard 
              icon={<Calendar className="w-6 h-6" />}
              title="Seamless Integration"
              description="One-click integration with Shopify and WooCommerce. Get up and running in minutes."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="Customer Engagement"
              description="Let customers save outfits, build wish lists, and get personalized style recommendations"
            />
            <FeatureCard 
              icon={<TrendingUp className="w-6 h-6" />}
              title="Analytics Dashboard"
              description="Track which products are trending, outfit performance, and customer preferences"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-[hsl(35,30%,95%)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your business. All plans include a 3-day free trial.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <PricingCard 
              title="Starter"
              subtitle="Perfect for growing brands"
              price="$14.99"
              features={[
                "Up to 500 products",
                "AI outfit recommendations",
                "Basic analytics dashboard",
                "Shopify & WooCommerce integration",
                "Email support"
              ]}
              buttonText="Start Free Trial"
            />
            <PricingCard 
              title="Professional"
              subtitle="For established brands"
              price="$29.99"
              featured
              features={[
                "Up to 1,000 products",
                "Advanced AI outfit generation",
                "Full analytics & insights",
                "Priority integrations",
                "Customer preference tracking",
                "Priority support"
              ]}
              buttonText="Start Free Trial"
            />
            <PricingCard 
              title="Enterprise"
              subtitle="For large-scale operations"
              price="Custom"
              features={[
                "Unlimited products",
                "Custom AI training",
                "White-label options",
                "Dedicated account manager",
                "Custom integrations",
                "24/7 premium support"
              ]}
              buttonText="Contact Sales"
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Install STYLYS on your store and start selling complete outfits today
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-12 max-w-4xl mx-auto">
            <StepCard 
              number="01"
              title="Connect Your Store"
              description="One-click integration with Shopify or WooCommerce. Sync your entire product catalog automatically."
            />
            <StepCard 
              number="02"
              title="AI Does the Work"
              description="Our AI analyzes your products and creates smart outfit combinations based on style, color, and trends."
            />
            <StepCard 
              number="03"
              title="Customers Buy More"
              description="Shoppers discover complete looks and add multiple items to cart. Watch your AOV increase."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-foreground">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-display font-bold text-background mb-6">
            Ready to Boost Your Sales?
          </h2>
          <p className="text-lg text-background/70 mb-10 max-w-2xl mx-auto">
            Join hundreds of fashion brands using AI to sell more and delight customers
          </p>
          <Link to="/auth">
            <Button size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90 px-10 h-14 text-base font-semibold">
              Start Your Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-background/50 mt-6">
            No credit card required • 3-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © 2025 STYLYS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-background border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
    <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center mb-6 text-background">
      {icon}
    </div>
    <h3 className="font-display text-xl font-bold text-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const PricingCard = ({ 
  title, 
  subtitle, 
  price, 
  features, 
  buttonText, 
  featured = false 
}: { 
  title: string; 
  subtitle: string; 
  price: string; 
  features: string[]; 
  buttonText: string; 
  featured?: boolean; 
}) => (
  <div className={`rounded-2xl p-8 ${featured ? 'bg-foreground text-background scale-105 shadow-2xl' : 'bg-background border border-border'}`}>
    {featured && (
      <span className="inline-block px-3 py-1 bg-background/10 rounded-full text-xs font-semibold mb-4">
        Most Popular
      </span>
    )}
    <h3 className={`font-display text-2xl font-bold ${featured ? 'text-background' : 'text-foreground'}`}>{title}</h3>
    <p className={`text-sm mt-1 ${featured ? 'text-background/70' : 'text-muted-foreground'}`}>{subtitle}</p>
    <div className="mt-6 mb-8">
      <span className={`text-5xl font-display font-bold ${featured ? 'text-background' : 'text-foreground'}`}>{price}</span>
      {price !== "Custom" && <span className={`text-sm ${featured ? 'text-background/70' : 'text-muted-foreground'}`}>/month</span>}
    </div>
    <ul className="space-y-4 mb-8">
      {features.map((feature, index) => (
        <li key={index} className="flex items-start gap-3">
          <Check className={`w-5 h-5 mt-0.5 ${featured ? 'text-emerald-400' : 'text-emerald-500'}`} />
          <span className={`text-sm ${featured ? 'text-background/90' : 'text-muted-foreground'}`}>{feature}</span>
        </li>
      ))}
    </ul>
    <Link to={buttonText === "Contact Sales" ? "#" : "/auth"}>
      <Button 
        className={`w-full rounded-xl h-12 font-semibold ${
          featured 
            ? 'bg-background text-foreground hover:bg-background/90' 
            : 'bg-foreground text-background hover:bg-foreground/90'
        }`}
      >
        {buttonText}
      </Button>
    </Link>
  </div>
);

const StepCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="text-center">
    <div className="w-16 h-16 bg-foreground rounded-full flex items-center justify-center mx-auto mb-6">
      <span className="text-background font-display font-bold text-lg">{number}</span>
    </div>
    <h3 className="font-display text-xl font-bold text-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

export default Index;
