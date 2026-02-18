import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ArrowRight, ArrowLeft, Sparkles, ShoppingBag } from "lucide-react";

interface StyleQuizTabProps {
  brandId?: string;
  onComplete?: () => void;
}

const STYLE_OPTIONS = ["Minimalist", "Bohemian", "Classic", "Streetwear", "Romantic", "Edgy", "Preppy", "Athleisure"];
const COLOR_OPTIONS = ["Black", "White", "Navy", "Beige", "Red", "Green", "Pink", "Brown", "Blue", "Gray"];
const BODY_SHAPES = ["Hourglass", "Pear", "Apple", "Rectangle", "Triangle", "Inverted Triangle"];
const OCCASIONS = ["Work", "Casual", "Date Night", "Weekend", "Formal", "Travel", "Workout"];

export function StyleQuizTab({ brandId, onComplete }: StyleQuizTabProps) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [preferredColors, setPreferredColors] = useState<string[]>([]);
  const [avoidedColors, setAvoidedColors] = useState<string[]>([]);
  const [bodyShape, setBodyShape] = useState<string>("");
  const [occasions, setOccasions] = useState<string[]>([]);

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const totalSteps = 5;

  const handleSubmit = () => {
    console.log("Quiz submitted:", { email, selectedStyles, preferredColors, avoidedColors, bodyShape, occasions });
    setCompleted(true);
  };

  if (completed) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">You're all set!</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          We've saved your style profile. View your personalized outfit recommendations now.
        </p>
        <Button size="sm" className="gap-2" onClick={() => onComplete?.()}>
          <ShoppingBag className="h-4 w-4" />
          View My Outfits
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setCompleted(false); setStep(0); }}>
          Retake Quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col min-h-[400px]">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <div className="flex-1">
        {/* Step 0: Email */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">Let's get started</h3>
              <p className="text-sm text-muted-foreground">Enter your email to save your style profile and get personalized recommendations.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-email" className="text-sm">Email</Label>
              <Input
                id="quiz-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 1: Style */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">What's your style?</h3>
              <p className="text-sm text-muted-foreground">Pick all that describe you.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STYLE_OPTIONS.map((style) => (
                <Badge
                  key={style}
                  variant={selectedStyles.includes(style) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                  onClick={() => toggleItem(style, selectedStyles, setSelectedStyles)}
                >
                  {selectedStyles.includes(style) && <Check className="h-3 w-3 mr-1" />}
                  {style}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Colors */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-base mb-1">Colors you love</h3>
              <p className="text-sm text-muted-foreground">Select your preferred colors.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((color) => (
                <Badge
                  key={color}
                  variant={preferredColors.includes(color) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                  onClick={() => toggleItem(color, preferredColors, setPreferredColors)}
                >
                  {preferredColors.includes(color) && <Check className="h-3 w-3 mr-1" />}
                  {color}
                </Badge>
              ))}
            </div>
            <div>
              <h3 className="font-semibold text-base mb-1">Colors to avoid</h3>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <Badge
                    key={color}
                    variant={avoidedColors.includes(color) ? "destructive" : "outline"}
                    className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                    onClick={() => toggleItem(color, avoidedColors, setAvoidedColors)}
                  >
                    {color}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Body Shape */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">Body shape</h3>
              <p className="text-sm text-muted-foreground">This helps us recommend the best fits.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BODY_SHAPES.map((shape) => (
                <button
                  key={shape}
                  onClick={() => setBodyShape(shape)}
                  className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                    bodyShape === shape
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {bodyShape === shape && <Check className="h-3 w-3 inline mr-1" />}
                  {shape}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Occasions */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">What do you dress for?</h3>
              <p className="text-sm text-muted-foreground">Select the occasions you shop for most.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((occ) => (
                <Badge
                  key={occ}
                  variant={occasions.includes(occ) ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                  onClick={() => toggleItem(occ, occasions, setOccasions)}
                >
                  {occasions.includes(occ) && <Check className="h-3 w-3 mr-1" />}
                  {occ}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep(step - 1)}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        {step < totalSteps - 1 ? (
          <Button
            size="sm"
            onClick={() => setStep(step + 1)}
            disabled={step === 0 && !email}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleSubmit}>
            <Sparkles className="h-4 w-4 mr-1" />
            Get My Outfits
          </Button>
        )}
      </div>
    </div>
  );
}
