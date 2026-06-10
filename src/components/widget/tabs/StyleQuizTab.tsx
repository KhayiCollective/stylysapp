import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowLeft } from "lucide-react";

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

const AUTO_ADVANCE_DELAY = 350; // ms — enough to see the selection highlight

export function StyleQuizTab({ brandId, onComplete }: StyleQuizTabProps) {
  const [step, setStep] = useState(0);
  const [occasion, setOccasion] = useState("");
  const [colorMood, setColorMood] = useState("");
  const [formality, setFormality] = useState("");
  const [budget, setBudget] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const totalSteps = 4;

  const goToStep = (target: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(target);
      setIsTransitioning(false);
    }, 180);
  };

  const handleOccasionSelect = (occ: string) => {
    setOccasion(occ);
    setTimeout(() => goToStep(1), AUTO_ADVANCE_DELAY);
  };

  const handleColorMoodSelect = (mood: string) => {
    setColorMood(mood);
    setTimeout(() => goToStep(2), AUTO_ADVANCE_DELAY);
  };

  const handleFormalitySelect = (label: string) => {
    setFormality(label);
    setTimeout(() => goToStep(3), AUTO_ADVANCE_DELAY);
  };

  const handleBudgetSelect = (b: string) => {
    setBudget(b);
    setTimeout(() => {
      const answers: QuizAnswers = { occasion, colorMood, formality, budget: b };
      onComplete?.(answers);
    }, AUTO_ADVANCE_DELAY);
  };

  const handleBack = () => {
    if (step > 0) {
      goToStep(step - 1);
    }
  };

  const contentClass = `transition-all duration-300 ease-out ${
    isTransitioning ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
  }`;

  return (
    <div className="p-4 flex flex-col min-h-[400px]">
      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors duration-500 ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <div className={`flex-1 ${contentClass}`}>
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
                  className="cursor-pointer px-3 py-1.5 text-sm transition-all duration-200 hover:scale-105"
                  onClick={() => handleOccasionSelect(occ)}
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
                  className="cursor-pointer px-3 py-1.5 text-sm transition-all duration-200 hover:scale-105"
                  onClick={() => handleColorMoodSelect(mood)}
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
                  onClick={() => handleFormalitySelect(opt.label)}
                  className={`p-3 rounded-lg border text-left transition-all duration-200 hover:scale-[1.02] ${
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
                  onClick={() => handleBudgetSelect(b)}
                  className={`p-3 rounded-lg border text-sm text-left transition-all duration-200 hover:scale-[1.02] ${
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
          onClick={handleBack}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="text-xs text-muted-foreground">
          {step + 1} of {totalSteps}
        </span>
      </div>
    </div>
  );
}
