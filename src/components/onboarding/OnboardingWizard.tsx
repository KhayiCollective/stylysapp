import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Store, Package, Eye, Rocket, ArrowRight, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/hooks/useOnboarding";
import { demoProducts, demoOutfits } from "@/data/demoProducts";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 5;

const steps = [
  { id: 1, title: "Welcome", icon: Sparkles },
  { id: 2, title: "Connect Store", icon: Store },
  { id: 3, title: "Sync Catalog", icon: Package },
  { id: 4, title: "Preview Widget", icon: Eye },
  { id: 5, title: "Go Live", icon: Rocket },
];

interface OnboardingWizardProps {
  onClose?: () => void;
  onComplete?: () => void;
}

export function OnboardingWizard({ onClose, onComplete }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { progress, initializeOnboarding, updateStep, completeStep, completeOnboarding, isStepCompleted } = useOnboarding();
  const [currentStep, setCurrentStep] = useState(1);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (progress) {
      setCurrentStep(progress.current_step);
      setInitialized(true);
    } else if (!initialized) {
      initializeOnboarding().then(() => setInitialized(true));
    }
  }, [progress, initialized]);

  const handleNext = async () => {
    await completeStep(currentStep);
    if (currentStep < TOTAL_STEPS) {
      const nextStep = currentStep + 1;
      await updateStep(nextStep);
      setCurrentStep(nextStep);
    } else {
      await completeOnboarding();
      onComplete?.();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      updateStep(prevStep);
      setCurrentStep(prevStep);
    }
  };

  const handleSkip = async () => {
    if (currentStep < TOTAL_STEPS) {
      const nextStep = currentStep + 1;
      await updateStep(nextStep);
      setCurrentStep(nextStep);
    }
  };

  const progressPercent = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader className="relative">
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-4 top-4"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          
          {/* Step Indicators */}
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : isStepCompleted(step.id)
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isStepCompleted(step.id) ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 mx-1",
                      isStepCompleted(step.id) ? "bg-green-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          
          <Progress value={progressPercent} className="mb-4" />
          
          <CardTitle className="text-2xl">{steps[currentStep - 1]?.title}</CardTitle>
          <CardDescription>
            Step {currentStep} of {TOTAL_STEPS}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Content */}
          {currentStep === 1 && <WelcomeStep />}
          {currentStep === 2 && <ConnectStoreStep onNavigate={() => navigate("/connect-shopify")} />}
          {currentStep === 3 && <SyncCatalogStep />}
          {currentStep === 4 && <PreviewWidgetStep />}
          {currentStep === 5 && <GoLiveStep />}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep < TOTAL_STEPS && currentStep !== 2 && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip
                </Button>
              )}
              <Button onClick={handleNext} className="gap-2">
                {currentStep === TOTAL_STEPS ? "Complete" : "Next"}
                {currentStep < TOTAL_STEPS && <ArrowRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center space-y-4">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">Welcome to STYLYS!</h3>
      <p className="text-muted-foreground">
        Let's set up your AI-powered outfit builder in just a few minutes. 
        We'll guide you through connecting your store, syncing your products, 
        and launching your personalized recommendation widget.
      </p>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">5</div>
          <div className="text-sm text-muted-foreground">Minutes Setup</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">∞</div>
          <div className="text-sm text-muted-foreground">Outfit Combinations</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">23%</div>
          <div className="text-sm text-muted-foreground">Avg. AOV Increase</div>
        </div>
      </div>
    </div>
  );
}

function ConnectStoreStep({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-2">Connect Your Shopify Store</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Link your Shopify store to automatically sync your product catalog 
          and enable seamless checkout integration.
        </p>
        <Button onClick={onNavigate} className="gap-2">
          <Store className="w-4 h-4" />
          Connect Shopify
        </Button>
      </div>
      <div className="text-sm text-muted-foreground">
        <strong>What we'll access:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Product catalog (titles, images, prices, variants)</li>
          <li>Collections and tags for smart categorization</li>
          <li>Inventory status for real-time availability</li>
        </ul>
      </div>
    </div>
  );
}

function SyncCatalogStep() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
          <Check className="w-5 h-5" />
          <span className="font-medium">Catalog Sync Ready</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Once connected, your products will be automatically synced. 
          STYLYS will categorize items by type, color, and style for smart outfit matching.
        </p>
      </div>

      <h4 className="font-medium">How sync works:</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-muted rounded-lg">
          <Package className="w-5 h-5 text-primary mb-2" />
          <div className="text-sm font-medium">Initial Sync</div>
          <div className="text-xs text-muted-foreground">All products imported instantly</div>
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <Sparkles className="w-5 h-5 text-primary mb-2" />
          <div className="text-sm font-medium">AI Categorization</div>
          <div className="text-xs text-muted-foreground">Auto-tagged by style attributes</div>
        </div>
      </div>
    </div>
  );
}

function PreviewWidgetStep() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Here's a preview of how the outfit widget will look on your store:
      </p>

      {/* Demo Widget Preview */}
      <div className="border rounded-lg p-4 bg-background">
        <h4 className="font-medium mb-3">Complete the Look</h4>
        <div className="grid grid-cols-3 gap-3">
          {demoProducts.slice(0, 3).map((product) => (
            <div key={product.id} className="space-y-2">
              <div className="aspect-[3/4] bg-muted rounded-md overflow-hidden">
                <img
                  src={product.image}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-xs truncate">{product.title}</div>
              <div className="text-xs font-medium">${product.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
        <Button size="sm" className="w-full mt-3">Add All to Cart</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <strong>Customization options:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Match your brand colors and fonts</li>
          <li>Choose layout: grid, carousel, or list</li>
          <li>Set number of recommendations (1-6)</li>
        </ul>
      </div>
    </div>
  );
}

function GoLiveStep() {
  return (
    <div className="space-y-4">
      <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
        <Rocket className="w-8 h-8 text-green-500" />
      </div>

      <div className="text-center">
        <h3 className="text-xl font-semibold mb-2">You're Ready to Launch!</h3>
        <p className="text-muted-foreground">
          Complete the checklist below to go live with STYLYS on your store.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-sm">Shopify store connected</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-sm">Product catalog synced</span>
        </div>
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-sm">Widget configured</span>
        </div>
        <div className="flex items-center gap-3 p-3 border-2 border-dashed border-primary/50 rounded-lg">
          <div className="w-5 h-5 rounded-full border-2 border-primary" />
          <span className="text-sm">Add embed code to your theme</span>
        </div>
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <h4 className="font-medium mb-2">Next Steps</h4>
        <p className="text-sm text-muted-foreground">
          After completing onboarding, visit the Widget page to get your embed code 
          and installation instructions for your Shopify theme.
        </p>
      </div>
    </div>
  );
}
