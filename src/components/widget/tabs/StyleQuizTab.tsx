import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ArrowLeft, Sparkles, ShoppingBag } from "lucide-react";

export interface QuizAnswers {
  occasion: string;
  colorMood: string;
  formality: string;
  budget: string;
}

interface StyleQuizTabProps {
  brandId?: string;
  onComplete?: (answers: QuizAnswers) => void;
}

const OCCASION_OPTIONS = [
  "Work Meeting", "Brunch", "Date Night", "Everyday", "Special Event", "Travel", "Weekend Out", "Workout"
];

const COLOR_MOOD_OPTIONS = [
  "Neutral & Earthy", "Bold & Bright", "Monochrome", "Pastels", "Dark & Moody", "Warm Tones"
];

const FORMALITY_OPTIONS = [
  { label: "Casual", desc: "Relaxed & comfortable" },
  { label: "Smart Casual", desc: "Polished but easy" },
  { label: "Dressy", desc: "Elevated & chic" },
  { label: "Formal", desc: "Event-ready" },
];

const BUDGET_OPTIONS = [
  "Under $100", "$100–$250", "$250–$500", "No limit"
];

export function StyleQuizTab({ brandId, onComplete }: StyleQuizTabProps) {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [colorMood, setColorMood] = useState("");
  const [formality, setFormality] = useState("");
  const [budget, setBudget] = useState("");

  const totalSteps = 4;

  const handleSubmit = () => {
    const answers: QuizAnswers = { occasion, colorMood, formality, budget };
    setCompleted(true);
    onComplete?.(answers);
  };

  if (completed) {
    return (
      <div className="p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">Great choices!</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          We're generating outfits matched to your mood. View them now.
        </p>
        <Button size="sm" className="gap-2" onClick={() => onComplete?.({ occasion, colorMood, formality, budget })}>
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
        {/* Step 0: Occasion */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">What's the occasion?</h3>
              <p className="text-sm text-muted-foreground">What are you dressing for today?</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {OCCASION_OPTIONS.map((occ) => (
                <Badge
                  key={occ}
                  variant={occasion === occ ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                  onClick={() => setOccasion(occ)}
                >
                  {occasion === occ && <Check className="h-3 w-3 mr-1" />}
                  {occ}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Color Mood */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">What color mood are you feeling?</h3>
              <p className="text-sm text-muted-foreground">Pick the palette that matches your vibe.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {COLOR_MOOD_OPTIONS.map((mood) => (
                <Badge
                  key={mood}
                  variant={colorMood === mood ? "default" : "outline"}
                  className="cursor-pointer px-3 py-1.5 text-sm transition-colors"
                  onClick={() => setColorMood(mood)}
                >
                  {colorMood === mood && <Check className="h-3 w-3 mr-1" />}
                  {mood}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Formality */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">How dressed up?</h3>
              <p className="text-sm text-muted-foreground">Set the vibe for your outfit.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FORMALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setFormality(opt.label)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    formality === opt.label
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {formality === opt.label && <Check className="h-3 w-3 inline mr-1" />}
                  <span className="text-sm">{opt.label}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Budget */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-base mb-1">Budget for this outfit?</h3>
              <p className="text-sm text-muted-foreground">We'll match recommendations to your range.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                    budget === b
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {budget === b && <Check className="h-3 w-3 inline mr-1" />}
                  {b}
                </button>
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
