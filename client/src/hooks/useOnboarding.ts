import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  completedSteps: string[];
  skippedAt?: string;
  completedAt?: string;
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>({
    hasSeenOnboarding: false,
    completedSteps: []
  });

  // Get user data to check onboarding status
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Update state when user data changes
  useEffect(() => {
    if (user && !isLoading) {
      setState({
        hasSeenOnboarding: user.hasSeenHomeOnboarding || false,
        completedSteps: [] // We're simplifying to just track completion
      });
    }
  }, [user, isLoading]);

  const shouldShowOnboarding = () => {
    if (isLoading) return false; // Don't show while loading
    return !state.hasSeenOnboarding;
  };

  const completeOnboarding = async () => {
    try {
      await apiRequest('/api/onboarding/home', { method: 'POST' });
      setState(prevState => ({
        ...prevState,
        hasSeenOnboarding: true,
        completedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const skipOnboarding = async () => {
    try {
      await apiRequest('/api/onboarding/home', { method: 'POST' });
      setState(prevState => ({
        ...prevState,
        hasSeenOnboarding: true,
        skippedAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  const resetOnboarding = () => {
    // For development/testing purposes only
    setState({
      hasSeenOnboarding: false,
      completedSteps: []
    });
  };

  const markStepCompleted = (stepId: string) => {
    if (!state.completedSteps.includes(stepId)) {
      setState(prevState => ({
        ...prevState,
        completedSteps: [...prevState.completedSteps, stepId]
      }));
    }
  };

  return {
    state,
    isLoading,
    shouldShowOnboarding,
    completeOnboarding,
    skipOnboarding,
    resetOnboarding,
    markStepCompleted
  };
}