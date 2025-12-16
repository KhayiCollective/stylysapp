import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, ShoppingBag, BarChart3 } from "lucide-react";
const Index = () => {
  return <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="editorial-container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-sm flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-background" />
            </div>
            <span className="font-display text-xl font-semibold">STYLS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link to="/widget">
              <Button variant="editorial-outline" size="sm">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="editorial-container">
          <div className="max-w-4xl mx-auto text-center">
            <p className="uppercase tracking-[0.3em] text-xs text-muted-foreground mb-6 animate-fade-in">
              For Fashion E-Commerce Brands
            </p>
            <h1 className="text-5xl lg:text-8xl leading-[0.95] mb-8 animate-slide-up md:text-6xl font-serif font-light">STYLS
AI-Powered
Outfit Styling<br />
              <span className="italic">Outfit Styling</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-slide-up opacity-0 stagger-2">
              Automatically generate complete outfits from your product catalog. 
              Increase average order value and reduce returns with intelligent styling recommendations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up opacity-0 stagger-3">
              <Link to="/dashboard">
                <Button variant="editorial" size="xl" className="group">
                  Get Started
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/widget">
                <Button variant="editorial-outline" size="xl">
                  See Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="editorial-spacing bg-muted/30">
        <div className="editorial-container">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard icon={<ShoppingBag className="w-6 h-6" />} title="Catalog Integration" description="Upload your product catalog and let our AI understand your inventory, styles, and color palettes." delay={1} />
            <FeatureCard icon={<Sparkles className="w-6 h-6" />} title="Smart Outfit Generation" description="Rule-based styling that considers category balance, color harmony, and fit compatibility." delay={2} />
            <FeatureCard icon={<BarChart3 className="w-6 h-6" />} title="Increase AOV" description="Complete-the-look recommendations that drive higher cart values and customer satisfaction." delay={3} />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="editorial-spacing">
        <div className="editorial-container">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <StatCard value="35%" label="Higher AOV" />
            <StatCard value="22%" label="Fewer Returns" />
            <StatCard value="3x" label="Faster Styling" />
            <StatCard value="100%" label="On-Brand" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="editorial-spacing bg-foreground text-background">
        <div className="editorial-container text-center">
          <h2 className="font-display text-4xl md:text-5xl font-medium mb-6">
            Ready to transform your store?
          </h2>
          <p className="text-background/70 max-w-xl mx-auto mb-10">
            Join leading fashion brands using AI-powered outfit recommendations to boost sales and delight customers.
          </p>
          <Link to="/dashboard">
            <Button variant="outline" size="xl" className="border-background/30 text-background hover:bg-background hover:text-foreground rounded-none uppercase tracking-widest text-xs font-semibold">
              Start Building Outfits
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="editorial-container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-background" />
            </div>
            <span className="font-display text-sm">STYLS</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 STYLS. Built for fashion e-commerce.</p>
        </div>
      </footer>
    </div>;
};
const FeatureCard = ({
  icon,
  title,
  description,
  delay
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) => <div className={`card-editorial p-8 animate-slide-up opacity-0 stagger-${delay}`}>
    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-6">
      {icon}
    </div>
    <h3 className="font-display text-xl font-medium mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>;
const StatCard = ({
  value,
  label
}: {
  value: string;
  label: string;
}) => <div className="py-6">
    <p className="font-display text-4xl md:text-5xl font-medium mb-2">{value}</p>
    <p className="text-muted-foreground uppercase tracking-widest text-xs">{label}</p>
  </div>;
export default Index;