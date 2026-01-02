import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingProgress {
  id: string;
  brand_id: string;
  current_step: number;
  completed_steps: number[];
  completed_at: string | null;
}

export function useOnboarding() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user!.id)
        .maybeSingle();

      if (!profile?.brand_id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("brand_id", profile.brand_id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching onboarding progress:", error);
      }

      setProgress(data as OnboardingProgress | null);
    } catch (error) {
      console.error("Error in fetchProgress:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeOnboarding = async () => {
    if (!user) return null;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("brand_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.brand_id) return null;

      const { data, error } = await supabase
        .from("onboarding_progress")
        .insert({
          brand_id: profile.brand_id,
          current_step: 1,
          completed_steps: [],
        })
        .select()
        .single();

      if (error) throw error;

      setProgress(data as OnboardingProgress);
      return data;
    } catch (error) {
      console.error("Error initializing onboarding:", error);
      return null;
    }
  };

  const updateStep = async (step: number) => {
    if (!progress) return;

    try {
      const { error } = await supabase
        .from("onboarding_progress")
        .update({ current_step: step })
        .eq("id", progress.id);

      if (error) throw error;

      setProgress({ ...progress, current_step: step });
    } catch (error) {
      console.error("Error updating step:", error);
    }
  };

  const completeStep = async (step: number) => {
    if (!progress) return;

    const newCompletedSteps = progress.completed_steps.includes(step)
      ? progress.completed_steps
      : [...progress.completed_steps, step];

    try {
      const { error } = await supabase
        .from("onboarding_progress")
        .update({ completed_steps: newCompletedSteps })
        .eq("id", progress.id);

      if (error) throw error;

      setProgress({ ...progress, completed_steps: newCompletedSteps });
    } catch (error) {
      console.error("Error completing step:", error);
    }
  };

  const completeOnboarding = async () => {
    if (!progress) return;

    try {
      const { error } = await supabase
        .from("onboarding_progress")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", progress.id);

      if (error) throw error;

      setProgress({ ...progress, completed_at: new Date().toISOString() });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const isStepCompleted = (step: number) => {
    return progress?.completed_steps.includes(step) ?? false;
  };

  const isOnboardingComplete = progress?.completed_at !== null;
  
  // Show onboarding if no progress exists or onboarding is not completed
  const showOnboarding = !loading && (!progress || !progress.completed_at);

  return {
    progress,
    loading,
    isLoading: loading,
    showOnboarding,
    initializeOnboarding,
    updateStep,
    completeStep,
    completeOnboarding,
    isStepCompleted,
    isOnboardingComplete,
    refetch: fetchProgress,
  };
}
